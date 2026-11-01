import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import MapView from '../components/MapView';
import { zoneStyle, zoneTooltip } from '../components/RiskZoneLayer';
import type { InterventionZone, InterventionZones } from '../types';

// Same split as the surface tests: the Leaflet drawing is verified by hand
// against the real backend, the panel and tooltip are what these cover.
vi.mock('../components/RiskZoneLayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/RiskZoneLayer')>()),
  default: () => null,
}));
vi.mock('../components/RiskSurfaceLayer', () => ({ default: () => null }));
vi.mock('../components/globe/GlobeTransition', () => ({ default: () => null }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null, Circle: () => null, Popup: () => null, Marker: () => null,
  useMap: () => ({ invalidateSize: vi.fn(), flyTo: vi.fn(), removeLayer: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn() }),
  useMapEvents: () => null,
}));

function zone(overrides: Partial<InterventionZone>): InterventionZone {
  return {
    zone_id: 'Z1',
    level: 'priority',
    cells: 14,
    priority_cells: 6,
    watch_cells: 8,
    score_mean: 50.0,
    score_max: 62.9,
    top_atm: 'PNY-005',
    atm_count: 7,
    center: [11.94, 79.8],
    h3_cells: ['88618cb6d9fffff'],
    boundary: [[11.93, 79.79], [11.96, 79.79], [11.96, 79.82], [11.93, 79.82]],
    ...overrides,
  };
}

const zones: InterventionZones = {
  zones: [
    zone({}),
    zone({ zone_id: 'Z2', level: 'watch', priority_cells: 0, cells: 9, score_mean: 18.4 }),
  ],
  summary: { zones: 2, clustered_cells: 23, noise_cells: 3, priority_cells: 6, watch_cells: 17 },
  eps_hops: 1,
  min_samples: 3,
  method: 'DBSCAN on H3 k-ring adjacency',
  note: 'Zones group adjacent priority/watch cells.',
};

describe('zone tooltip', () => {
  it('counts what the zone contains and calls the score uncalibrated', () => {
    const text = zoneTooltip(zone({}));
    expect(text).toContain('Z1');
    expect(text).toContain('Priority zone');
    expect(text).toContain('14 H3 cells');
    expect(text).toContain('6 priority');
    expect(text).toContain('uncalibrated');
    expect(text).toContain('PNY-005');
    expect(text).toContain('not a predicted crime location');
  });

  it('does not invent a precision for a zone with no ATM inside', () => {
    const text = zoneTooltip(zone({ atm_count: 0 }));
    expect(text).not.toContain('0 ATMs');
  });
});

describe('zone style', () => {
  it('separates priority and watch outlines without filling the surface', () => {
    expect(zoneStyle('priority').color).not.toBe(zoneStyle('watch').color);
    // A fill on top of the cell fill would read as a third risk level.
    expect(zoneStyle('priority').fillOpacity).toBeLessThan(0.1);
    expect(zoneStyle('priority').dashArray).toBeDefined();
  });
});

describe('zone panel', () => {
  it('lists each zone with its cell count and flags unclustered cells', () => {
    const { container } = render(
      <MapView locations={[]} selectedLocation={null} onSelectLocation={vi.fn()} zones={zones} />,
    );
    expect(screen.getByText(/Intervention zones · 2/)).toBeDefined();
    expect(container.textContent).toContain('Z1 · 14 cells');
    expect(container.textContent).toContain('Z2 · 9 cells');
    expect(container.textContent).toContain('2 zones from 23 adjacent cells');
    expect(container.textContent).toContain('3 isolated cells not in a zone');
    expect(container.textContent).toContain('not a predicted crime location');
  });

  it('says nothing about zones when the payload has none, as in local fixtures', () => {
    render(<MapView locations={[]} selectedLocation={null} onSelectLocation={vi.fn()} />);
    expect(screen.queryByText(/Intervention zones/)).toBeNull();
  });
});
