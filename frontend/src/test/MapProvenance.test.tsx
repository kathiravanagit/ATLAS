import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import MapView from '../components/MapView';

vi.mock('../components/globe/GlobeTransition', () => ({ default: () => null }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null, Circle: () => null, Popup: () => null, Marker: () => null,
  useMap: () => ({ invalidateSize: vi.fn(), flyTo: vi.fn(), removeLayer: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn() }),
  useMapEvents: () => null,
}));

describe('map provenance', () => {
  it('labels synthetic snapshots and counts zones without probability averages', () => {
    const { container } = render(<MapView locations={[]} selectedLocation={null} onSelectLocation={vi.fn()} />);
    expect(screen.getByText('Synthetic predictions')).toBeDefined();
    expect(screen.queryByText('LIVE', { exact: true })).toBeNull();
    expect(container.textContent).toContain('0 locations');
    expect(container.textContent).toContain('priority');
    expect(container.textContent).not.toMatch(/Avg risk|Critical \(>|Elevated \(45|Normal \(</);
    expect(screen.getByText(/not live operational data/)).toBeDefined();
  });
});
