import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { InterventionZone, InterventionZones } from '../types';

/**
 * Draws the server's DBSCAN zones as convex-hull outlines over the H3 surface.
 *
 * The surface already colours individual cells, so this layer deliberately does
 * not fill anything: a zone is a *grouping* of cells, and a second fill on top
 * of the first would read as a third level of risk that does not exist. The
 * outline answers the operational question the cells cannot - "how many separate
 * places do we have to send people to?" - and the hull is the footprint of one.
 */

export const ZONE_LABEL: Record<InterventionZone['level'], string> = {
  priority: 'Priority zone',
  watch: 'Watch zone',
};

const ZONE_STYLE: Record<InterventionZone['level'], L.PathOptions> = {
  priority: { color: '#991b1b', fillColor: '#ef4444', fillOpacity: 0.03, weight: 1.8, opacity: 0.8, dashArray: '8 7' },
  watch: { color: '#92400e', fillColor: '#f59e0b', fillOpacity: 0.02, weight: 1.6, opacity: 0.7, dashArray: '5 7' },
};

export function zoneStyle(level: InterventionZone['level']): L.PathOptions {
  return ZONE_STYLE[level] ?? ZONE_STYLE.watch;
}

/** Badge at the zone centre: a hull with no label reads as "the city is one zone". */
export function zoneBadgeHtml(zone: InterventionZone): string {
  const bg = zone.level === 'priority' ? '#991b1b' : '#92400e';
  return (
    `<span style="display:inline-block;padding:1px 6px;border-radius:999px;` +
    `font:600 10px/1.5 system-ui,sans-serif;color:#fff;background:${bg};` +
    `border:1px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35)">${esc(zone.zone_id)}</span>`
  );
}

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Tooltip text: counts and the ordering score, never a probability. */
export function zoneTooltip(zone: InterventionZone): string {
  const head = `<strong>${zone.zone_id} · ${ZONE_LABEL[zone.level] ?? 'Zone'}</strong>`;
  const rows = [
    `<div style="margin-top:4px">${zone.cells} H3 cells · ${zone.priority_cells} priority · ${zone.watch_cells} watch</div>`,
    `<div>Relative score mean <strong>${zone.score_mean.toFixed(1)}</strong> · max <strong>${zone.score_max.toFixed(1)}</strong> · uncalibrated, not a probability</div>`,
  ];
  if (zone.top_atm) {
    rows.push(`<div>Top ATM <strong>${esc(zone.top_atm)}</strong>${zone.atm_count > 0 ? ` · ${zone.atm_count} ATM${zone.atm_count === 1 ? '' : 's'} in zone` : ''}</div>`);
  }
  rows.push('<div style="color:#6B7280;font-size:10px;margin-top:4px">Adjacent priority/watch cells. An area to check, not a predicted crime location.</div>');
  return head + rows.join('');
}

interface RiskZoneLayerProps {
  zones?: InterventionZones | null;
  enabled: boolean;
  onSelectAtm?: (atmId: string) => void;
}

export default function RiskZoneLayer({ zones, enabled, onSelectAtm }: RiskZoneLayerProps) {
  const map = useMap();
  const selectRef = useRef(onSelectAtm);
  selectRef.current = onSelectAtm;

  useEffect(() => {
    if (!enabled || !zones?.zones?.length) return;

    const group = L.layerGroup();
    for (const zone of zones.zones) {
      if (!zone.boundary?.length) continue;
      const polygon = L.polygon(zone.boundary, zoneStyle(zone.level));
      polygon.bindTooltip(zoneTooltip(zone), { sticky: true, opacity: 1 });
      if (zone.top_atm) {
        polygon.on('click', (event) => {
          L.DomEvent.stopPropagation(event.originalEvent as MouseEvent);
          selectRef.current?.(zone.top_atm);
        });
      }
      group.addLayer(polygon);

      const [lat, lng] = zone.center;
      group.addLayer(L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'atlas-zone-badge',
          html: zoneBadgeHtml(zone),
          iconSize: [26, 16],
          iconAnchor: [13, 8],
        }),
        interactive: false,
        keyboard: false,
      }));
    }
    group.addTo(map);

    return () => {
      map.removeLayer(group);
    };
  }, [enabled, zones, map]);

  return null;
}
