import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import MapView from '../components/MapView';
import { cellStyle, cellTooltip } from '../components/RiskSurfaceLayer';
import type { RiskCell, RiskSurface } from '../types';

// The layer's Leaflet work is exercised by hand against the real backend; here
// the concern is that the panel and the tooltip say the same true thing.
vi.mock('../components/RiskSurfaceLayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/RiskSurfaceLayer')>()),
  default: () => null,
}));

vi.mock('../components/globe/GlobeTransition', () => ({ default: () => null }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null, Circle: () => null, Popup: () => null, Marker: () => null,
  useMap: () => ({ invalidateSize: vi.fn(), flyTo: vi.fn(), removeLayer: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn() }),
  useMapEvents: () => null,
}));

function cell(overrides: Partial<RiskCell>): RiskCell {
  return {
    h3: '88618cb6d9fffff',
    center: [11.94, 79.8],
    boundary: [[11.94, 79.8], [11.95, 79.8], [11.95, 79.81], [11.94, 79.81]],
    score: 62.9,
    level: 'priority',
    atm_count: 0,
    nearest_atm: 'PNY-005',
    nearest_m: 905,
    top_atm: 'PNY-005',
    top_atm_score: 88.7,
    ...overrides,
  };
}

const surface: RiskSurface = {
  cells: [cell({}), cell({ h3: 'b', level: 'watch', score: 44 }), cell({ h3: 'c', level: 'none', score: null })],
  summary: { cells: 3, scored: 2, priority: 1, watch: 1, background: 0 },
  resolution: 8,
  sigma_m: 800,
  cell_edge_m: 461.4,
  reach_m: 1600,
  bands: { priority_at: 52, watch_at: 42.4 },
  flat: false,
  method: 'gaussian-weighted mean of per-ATM ranker scores',
  basis: 'ranker_score',
  calibrated: false,
  note: 'Uncalibrated relative ordering.',
};

describe('risk surface legend', () => {
  it('shows the cell counts and the coverage rule rather than a probability', () => {
    const { container } = render(
      <MapView locations={[]} selectedLocation={null} onSelectLocation={vi.fn()} surface={surface} />,
    );
    expect(screen.getByText(/Risk surface · H3 res 8/)).toBeDefined();
    expect(screen.getByText('Priority cell')).toBeDefined();
    expect(screen.getByText('No coverage')).toBeDefined();
    expect(container.textContent).toContain('not probabilities');
    expect(container.textContent).toContain('1600 m');
    expect(container.textContent).toContain('461 m edge');
    // A relative score is only a priority cell because it clears this city's own
    // cut-off, so the cut-off has to be on screen next to it.
    expect(container.textContent).toContain('priority ≥ 52.0');
    expect(container.textContent).toContain('watch ≥ 42.4');
  });

  it('offers no surface toggle when the payload has none, as in local fixtures', () => {
    render(<MapView locations={[]} selectedLocation={null} onSelectLocation={vi.fn()} />);
    expect(screen.queryByText(/Risk surface · H3 res/)).toBeNull();
  });
});

describe('cell tooltip', () => {
  it('says an uncovered cell is unscored, not zero risk', () => {
    const text = cellTooltip(cell({ level: 'none', score: null, nearest_m: 2400 }), 461.4);
    expect(text).toContain('No ATM within reach');
    expect(text).toContain('not zero risk');
    expect(text).not.toContain('Relative score');
  });

  it('names the driving ATM and calls the score uncalibrated', () => {
    const text = cellTooltip(cell({}), 461.4);
    expect(text).toContain('62.9');
    expect(text).toContain('uncalibrated');
    expect(text).toContain('PNY-005');
  });

  it('says which cut-off makes the colour, so a low number on red is explained', () => {
    // The city-overview surface tops out at 18.5; a cell at 16.0 is still a
    // priority cell there, and without the cut-off the colour looks arbitrary.
    const text = cellTooltip(cell({ score: 16.0 }), 461.4, { priority_at: 14.7, watch_at: 6.8 });
    expect(text).toContain('16.0');
    expect(text).toContain('priority ≥ <strong>14.7</strong>');
    expect(text).toContain('watch ≥ <strong>6.8</strong>');
  });

  it('never renders a null cut-off as "priority ≥ null"', () => {
    // A flat field carries no bands; the tooltip must say that instead.
    const text = cellTooltip(cell({ score: 0 }), 461.4, { priority_at: null, watch_at: null });
    expect(text).not.toContain('null');
    expect(text).toContain('scores do not separate');
  });

  it('explains a hot cell that contains no ATM of its own', () => {
    const text = cellTooltip(cell({ atm_count: 0, nearest_m: 905 }), 461.4);
    expect(text).toContain('905 m');
  });
});

describe('cell colours', () => {
  it('draws uncovered cells as an outline with no fill', () => {
    expect(cellStyle('none').fillOpacity).toBe(0);
    expect(cellStyle('none').dashArray).toBeTruthy();
  });

  it('keeps priority, watch and background visually ordered by opacity', () => {
    const p = cellStyle('priority').fillOpacity ?? 0;
    const w = cellStyle('watch').fillOpacity ?? 0;
    const b = cellStyle('background').fillOpacity ?? 0;
    expect(p).toBeGreaterThan(w);
    expect(w).toBeGreaterThan(b);
  });
});
