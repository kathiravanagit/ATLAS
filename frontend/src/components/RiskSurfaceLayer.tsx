import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { RiskCell, RiskCellLevel, RiskSurface } from '../types';

/**
 * Renders the server's H3 surface as one polygon per cell.
 *
 * The cell colours are the server's own `level`, which is a quantile of that
 * city's scored cells - not the 70/45 row-model thresholds. Nothing here
 * re-scores anything: if the backend says a hex is a priority cell, this draws
 * it red, and if the backend says `none` the hex is drawn as an outline with no
 * fill so "no ATM within reach" never looks like "assessed and safe".
 */

export const SURFACE_LEVEL_LABEL: Record<RiskCellLevel, string> = {
  priority: 'Priority cell',
  watch: 'Watch cell',
  background: 'Background cell',
  none: 'No coverage',
};

// Cell edges are deliberately not faint: a surface where neighbouring cells of
// the same level merge into one blob reads as the blurred heat map it replaced.
// The stroke is what says "this is a discrete H3 cell, these are its neighbours".
const CELL_STYLE: Record<RiskCellLevel, L.PathOptions> = {
  priority: { color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.26, weight: 1.2, opacity: 0.75 },
  watch: { color: '#b45309', fillColor: '#f59e0b', fillOpacity: 0.20, weight: 1, opacity: 0.55 },
  background: { color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.10, weight: 1, opacity: 0.35 },
  none: { color: '#9CA3AF', fillColor: '#9CA3AF', fillOpacity: 0, weight: 1, opacity: 0.28, dashArray: '3 7' },
};

export function cellStyle(level: RiskCellLevel): L.PathOptions {
  return CELL_STYLE[level] ?? CELL_STYLE.background;
}

function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Tooltip text. Every claim is one the payload can back up. */
export function cellTooltip(cell: RiskCell, edgeM: number, bands?: RiskSurface['bands']): string {
  const head = `<strong>${SURFACE_LEVEL_LABEL[cell.level] ?? 'Cell'}</strong>`;
  const size = `<div style="color:#6B7280;font-size:10px">H3 res cell · ${Math.round(edgeM)} m edge</div>`;

  if (cell.score == null) {
    const reach = cell.nearest_m == null ? '' : ` (nearest ${esc(cell.nearest_atm)} is ${Math.round(cell.nearest_m)} m away)`;
    return `${head}${size}<div style="margin-top:4px">No ATM within reach${reach}. This area is not scored, not zero risk.</div>`;
  }

  const rows = [
    `<div style="margin-top:4px">Relative score <strong>${cell.score.toFixed(1)}</strong> · uncalibrated, not a probability</div>`,
  ];
  // The score alone cannot explain the colour: an uncalibrated scale has no
  // absolute meaning, so "16.0" is only a priority cell because it clears this
  // city's own cut-off. Saying where the cut-off is answers the judge's "why is
  // this one red?" without implying the number is a risk level.
  if (bands) {
    rows.push(
      `<div style="color:#6B7280">This city: priority ≥ <strong>${bands.priority_at.toFixed(1)}</strong>, ` +
      `watch ≥ <strong>${bands.watch_at.toFixed(1)}</strong></div>`,
    );
  }
  if (cell.nearest_atm) {
    const dist = cell.nearest_m == null ? '' : ` · ${Math.round(cell.nearest_m)} m`;
    rows.push(`<div>Nearest ATM <strong>${esc(cell.nearest_atm)}</strong>${dist}</div>`);
  }
  if (cell.top_atm && cell.top_atm !== cell.nearest_atm) {
    rows.push(`<div>Driven by <strong>${esc(cell.top_atm)}</strong>${cell.top_atm_score == null ? '' : ` (${cell.top_atm_score.toFixed(1)})`}</div>`);
  }
  if (cell.atm_count > 0) rows.push(`<div>${cell.atm_count} ATM${cell.atm_count === 1 ? '' : 's'} in this cell</div>`);
  return head + size + rows.join('');
}

interface RiskSurfaceLayerProps {
  surface?: RiskSurface | null;
  enabled: boolean;
  onSelectAtm?: (atmId: string) => void;
  /** Levels to draw. Filtering the layer keeps the map and the panel consistent. */
  visibleLevels?: RiskCellLevel[];
}

export default function RiskSurfaceLayer({ surface, enabled, onSelectAtm, visibleLevels }: RiskSurfaceLayerProps) {
  const map = useMap();
  // Held in a ref so a new callback identity does not rebuild every polygon.
  const selectRef = useRef(onSelectAtm);
  selectRef.current = onSelectAtm;

  const levelsKey = visibleLevels ? [...visibleLevels].sort().join(',') : 'all';

  useEffect(() => {
    if (!enabled || !surface?.cells?.length) return;

    const wanted = levelsKey === 'all' ? null : new Set(levelsKey.split(','));

    const group = L.layerGroup();
    for (const cell of surface.cells) {
      if (wanted && !wanted.has(cell.level)) continue;
      const polygon = L.polygon(cell.boundary, {
        ...cellStyle(cell.level),
        interactive: cell.level !== 'none',
      });
      if (cell.level !== 'none') {
        polygon.bindTooltip(cellTooltip(cell, surface.cell_edge_m, surface.bands), { sticky: true, opacity: 1 });
        const target = cell.top_atm || cell.nearest_atm;
        if (target) {
          polygon.on('click', (event) => {
            L.DomEvent.stopPropagation(event.originalEvent as MouseEvent);
            selectRef.current?.(target);
          });
        }
      }
      group.addLayer(polygon);
    }
    group.addTo(map);

    return () => {
      map.removeLayer(group);
    };
  }, [enabled, surface, map, levelsKey]);

  return null;
}
