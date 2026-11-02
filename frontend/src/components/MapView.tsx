import { PredictionLocation, RiskArea, RiskSurface, RiskCellLevel, InterventionZones } from '../types';
import { areaPrimary, areaSecondary, riskArea, SCORE_TOOLTIP, AREA_LABEL } from '../lib/riskAreas';
import { TIME_BUCKETS, OBSERVED_HOURS_TIP, matchesTimeBucket, type TimeBucket } from '../lib/observedHours';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, Popup, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin, Filter, ChevronDown, ChevronUp, AlertTriangle,
  Clock, Shield, Crosshair, RotateCcw, X, Info, Maximize2, Minimize2
} from 'lucide-react';
import GlobeTransition from './globe/GlobeTransition';
import RiskSurfaceLayer from './RiskSurfaceLayer';
import RiskZoneLayer from './RiskZoneLayer';

interface MapViewProps {
  locations: PredictionLocation[];
  selectedLocation: PredictionLocation | null;
  onSelectLocation: (loc: PredictionLocation) => void;
  cityCenter?: [number, number];
  /** Server-built H3 surface. Absent in local demo fixtures, where no overlay is drawn. */
  surface?: RiskSurface | null;
  /** Adjacent priority/watch cells grouped by the server into areas to check. */
  zones?: InterventionZones | null;
}

function areaColor(area: RiskArea): string {
  if (area === 'priority') return '#ef4444';
  if (area === 'watch') return '#f59e0b';
  return '#3b82f6';
}

function locArea(loc: PredictionLocation, total: number): RiskArea {
  return riskArea(loc.rank, total, loc.risk_area);
}

function locTotal(loc: PredictionLocation, total: number): number {
  return loc.rank_total ?? total;
}

function createPinIcon(area: RiskArea, rank: number, isSelected: boolean): L.DivIcon {
  const color = areaColor(area);
  const size = isSelected ? 40 : 34;
  const stroke = isSelected ? '#ffffff' : color;
  const strokeW = isSelected ? 3 : 2;
  const code = area === 'priority' ? 'PRI' : area === 'watch' ? 'WAT' : 'BKG';

  return L.divIcon({
    className: 'leaflet-custom-pin',
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, size + 10],
    popupAnchor: [0, -size - 5],
    html: `
      <svg width="${size}" height="${size + 10}" viewBox="0 0 ${size} ${size + 10}" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
        <path d="M${size / 2} ${size + 8}L${size / 2 - 3} ${size + 3}L${size / 2 + 3} ${size + 3}Z" fill="${color}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - strokeW}" fill="#18181b" stroke="${stroke}" stroke-width="${strokeW}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - strokeW - 4}" fill="${color}" opacity="0.15"/>
        <text x="${size / 2}" y="${size / 2 - 1}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="10" font-weight="bold" font-family="'JetBrains Mono', monospace">
          ${rank}
        </text>
        <text x="${size / 2}" y="${size / 2 + 9}" text-anchor="middle" fill="${color}" font-size="6" font-weight="600" font-family="sans-serif" letter-spacing="0.5">
          ${code}
        </text>
      </svg>
    `,
  });
}

function MapEvents({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: () => onClick() });
  return null;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  const prevCenter = React.useRef<string>('');

  React.useEffect(() => {
    const key = `${center[0].toFixed(5)},${center[1].toFixed(5)}`;
    if (key !== prevCenter.current) {
      prevCenter.current = key;
      map.invalidateSize();
      map.flyTo(center, 15, { duration: 1.2 });
    }
  }, [center, map]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const update = () => map.invalidateSize();
    document.addEventListener('fullscreenchange', update);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      window.removeEventListener('resize', update);
    };
  }, [map]);
  return null;
}

function ZoomControls({ onRecenter, isFullscreen, onToggleFullscreen }: {
  onRecenter: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-1">
      <button
        onClick={() => map.zoomIn()}
        className="w-8 h-8 bg-white/90 backdrop-blur border border-[#D1D5DB] rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#1F2937] hover:border-[#9CA3AF] transition-colors"
      >
        <span className="text-lg leading-none">+</span>
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="w-8 h-8 bg-white/90 backdrop-blur border border-[#D1D5DB] rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#1F2937] hover:border-[#9CA3AF] transition-colors"
      >
        <span className="text-lg leading-none">−</span>
      </button>
      <button
        onClick={onRecenter}
        className="w-8 h-8 bg-white/90 backdrop-blur border border-[#D1D5DB] rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#1F2937] hover:border-[#9CA3AF] transition-colors mt-1"
        title="Recenter"
      >
        <Crosshair size={14} />
      </button>
      <button
        onClick={onToggleFullscreen}
        className="w-8 h-8 bg-white/90 backdrop-blur border border-[#D1D5DB] rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#1F2937] hover:border-[#9CA3AF] transition-colors"
        title={isFullscreen ? 'Exit full screen' : 'Full screen map'}
        aria-pressed={isFullscreen}
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );
}

type RiskFilterType = 'all' | 'priority' | 'watch' | 'background';
type TimeFilterType = TimeBucket;

export default function MapView({ locations, selectedLocation, onSelectLocation, cityCenter, surface, zones }: MapViewProps) {
  const [showFilters, setShowFilters] = useState(true);
  const [riskFilter, setRiskFilter] = useState<RiskFilterType>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('all');
  const [showSurface, setShowSurface] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [hoveredAtm, setHoveredAtm] = useState<string | null>(null);
  const [globeDone, setGlobeDone] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasSurface = Boolean(surface?.cells?.length);
  const hasZones = Boolean(zones?.zones?.length);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen?.();
    }
  }, []);

  const handleSelectAtm = useCallback((atmId: string) => {
    const match = locations.find((loc) => loc.atm_id === atmId);
    if (match) onSelectLocation(match);
  }, [locations, onSelectLocation]);

  const center: [number, number] = useMemo(() => {
    if (selectedLocation) return [selectedLocation.latitude, selectedLocation.longitude];
    if (locations.length > 0) {
      const top = locations.reduce((best, loc) => loc.rank < best.rank ? loc : best, locations[0]);
      return [top.latitude, top.longitude];
    }
    return cityCenter || [11.9416, 79.8083];
  }, [selectedLocation, locations, cityCenter]);

  const filtered = useMemo(() => locations.filter(loc => {
    const matchRisk = riskFilter === 'all' ||
      locArea(loc, locations.length) === riskFilter;
    const matchTime = matchesTimeBucket(loc.observed_window?.hours, timeFilter);
    return matchRisk && matchTime;
  }), [locations, riskFilter, timeFilter]);

  const stats = useMemo(() => ({
    total: filtered.length,
    priority: filtered.filter(l => locArea(l, locations.length) === 'priority').length,
    watch: filtered.filter(l => locArea(l, locations.length) === 'watch').length,
    background: filtered.filter(l => locArea(l, locations.length) === 'background').length,
  }), [filtered, locations]);

  const selectedArea: RiskArea = selectedLocation
    ? locArea(selectedLocation, locations.length) : 'background';
  const selectedTotal = selectedLocation
    ? locTotal(selectedLocation, locations.length) : 0;

  const surfaceLevels: RiskCellLevel[] | undefined = riskFilter === 'all'
    ? undefined
    : [riskFilter as RiskCellLevel];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-180px)] min-h-[500px] rounded-xl overflow-hidden border border-[#D1D5DB]"
    >
      {!globeDone && (
        <GlobeTransition locations={locations} onComplete={() => setGlobeDone(true)} />
      )}
      {/* Map */}
      <MapContainer
        key={`${center[0].toFixed(2)}-${center[1].toFixed(2)}`}
        center={center}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
          subdomains="abc"
        />
        <MapUpdater center={center} />
        <MapResizer />
        <MapEvents onClick={() => onSelectLocation(null as any)} />

        <RiskSurfaceLayer
          surface={surface}
          enabled={showSurface}
          onSelectAtm={handleSelectAtm}
          visibleLevels={surfaceLevels}
        />
        <RiskZoneLayer zones={zones} enabled={showZones} onSelectAtm={handleSelectAtm} />

        {filtered.filter(loc => locArea(loc, locations.length) === 'priority').map((loc) => (
          <Circle
            key={`critical-zone-${loc.atm_id}`}
            center={[loc.latitude, loc.longitude]}
            radius={220}
            pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.08, weight: 2, opacity: 0.75 }}
          />
        ))}

        {filtered.map((loc) => (
          <Marker
            key={loc.atm_id}
            position={[loc.latitude, loc.longitude]}
            icon={createPinIcon(locArea(loc, locations.length), loc.rank, selectedLocation?.atm_id === loc.atm_id)}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
                onSelectLocation(loc);
              },
              mouseover: () => setHoveredAtm(loc.atm_id),
              mouseout: () => setHoveredAtm(null),
            }}
          >
            <Popup>
              <div style={{ color: '#18181b', fontSize: '12px', padding: '4px', minWidth: '150px' }} title={SCORE_TOOLTIP}>
                <strong style={{ fontSize: '14px' }}>{loc.atm_id}</strong><br />
                <span>{loc.location_name}</span><br />
                <span style={{ fontWeight: 'bold', color: areaColor(locArea(loc, locations.length)) }}>
                  {areaPrimary(locArea(loc, locations.length), loc.rank, locTotal(loc, locations.length))}
                </span><br />
                <span>Records: {loc.observed_window?.label ?? '—'}</span>
              </div>
            </Popup>
          </Marker>
        ))}
        <ZoomControls
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onRecenter={() => {
            const top = locations.reduce((best, loc) => loc.rank < best.rank ? loc : best, locations[0]);
            if (top) onSelectLocation(top);
          }}
        />
      </MapContainer>

      {/* Left Filter Panel */}
      <div className="absolute top-4 left-4 z-[1000] w-72">
        <div className="bg-white/95 backdrop-blur-xl rounded-xl border border-[#D1D5DB] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-[#D1D5DB]">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-[#1F2937]">Predicted Cash-Out Locations</h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-1 rounded hover:bg-[#E5E7EB] transition-colors"
              >
                {showFilters ? <ChevronUp size={14} className="text-[#6B7280]" /> : <ChevronDown size={14} className="text-[#6B7280]" />}
              </button>
            </div>
            <p className="text-sm text-[#4B5563]" title={SCORE_TOOLTIP}>
              {stats.total} locations | {stats.priority} priority · {stats.watch} watch · {stats.background} background
            </p>
          </div>

          {/* Filter Toggle */}
          <div className="px-4 pt-3">
            <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-[#D1D5DB]">
              {(['all', 'priority', 'watch', 'background'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setRiskFilter(f)}
                  className={`flex-1 py-1.5 text-[10px] rounded-md transition-all ${
                    riskFilter === f
                      ? f === 'priority' ? 'bg-[#ef4444]/15 text-[#ef4444]' :
                        f === 'watch' ? 'bg-[#f59e0b]/15 text-[#f59e0b]' :
                        f === 'background' ? 'bg-[#3b82f6]/15 text-[#3b82f6]' :
                        'bg-[#F3F4F6] text-[#1F2937]'
                      : 'text-[#6B7280] hover:text-[#1F2937]'
                  }`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="p-4 space-y-3">
              {/* Observed hours */}
              <div>
                <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5 block" title={OBSERVED_HOURS_TIP}>Observed Hours</label>
                <div className="flex flex-wrap gap-1.5">
                  {TIME_BUCKETS.map(bucket => (
                    <button
                      key={bucket.id}
                      onClick={() => setTimeFilter(bucket.id)}
                      title={OBSERVED_HOURS_TIP}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                        timeFilter === bucket.id
                          ? 'border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#3b82f6]'
                          : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#9CA3AF]'
                      }`}
                    >
                      {bucket.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk surface toggle */}
              {hasSurface && surface && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6B7280]">
                    Risk surface · H3 res {surface.resolution}
                  </span>
                  <button
                    onClick={() => setShowSurface(!showSurface)}
                    aria-pressed={showSurface}
                    className={`relative w-8 h-[18px] rounded-full transition-colors ${
                      showSurface ? 'bg-[#3b82f6]' : 'bg-[#F3F4F6]'
                    }`}
                  >
                    <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all ${
                      showSurface ? 'left-[14px]' : 'left-[2px]'
                    }`} />
                  </button>
                </div>
              )}

              {/* Intervention-zone toggle */}
              {hasZones && zones && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6B7280]">
                    Intervention zones · {zones.summary.zones}
                  </span>
                  <button
                    onClick={() => setShowZones(!showZones)}
                    aria-pressed={showZones}
                    className={`relative w-8 h-[18px] rounded-full transition-colors ${
                      showZones ? 'bg-[#3b82f6]' : 'bg-[#F3F4F6]'
                    }`}
                  >
                    <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all ${
                      showZones ? 'left-[14px]' : 'left-[2px]'
                    }`} />
                  </button>
                </div>
              )}

              {/* Risk Legend */}
              <div className="pt-2 border-t border-[#D1D5DB]" title={SCORE_TOOLTIP}>
                <div className="text-[10px] text-[#6B7280] uppercase mb-2">Rank Zones</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                    <span className="text-[10px] text-[#374151]">Priority (top ranks)</span>
                    <span className="text-[10px] text-[#6B7280] ml-auto">{stats.priority}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                    <span className="text-[10px] text-[#374151]">Watch (mid ranks)</span>
                    <span className="text-[10px] text-[#6B7280] ml-auto">{stats.watch}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                    <span className="text-[10px] text-[#374151]">Background (rest)</span>
                    <span className="text-[10px] text-[#6B7280] ml-auto">{stats.background}</span>
                  </div>
                </div>
              </div>

              {/* Risk surface legend */}
              {hasSurface && surface && (
                <div className="pt-2 border-t border-[#D1D5DB]">
                  <div className="text-[10px] text-[#6B7280] uppercase mb-2">
                    Risk surface cells
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-[#ef4444]/60 border border-[#ef4444]" />
                      <span className="text-[10px] text-[#374151]">Priority cell</span>
                      <span className="text-[10px] text-[#6B7280] ml-auto">{surface.summary.priority}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-[#f59e0b]/50 border border-[#f59e0b]" />
                      <span className="text-[10px] text-[#374151]">Watch cell</span>
                      <span className="text-[10px] text-[#6B7280] ml-auto">{surface.summary.watch}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-[#3b82f6]/25 border border-[#3b82f6]" />
                      <span className="text-[10px] text-[#374151]">Background cell</span>
                      <span className="text-[10px] text-[#6B7280] ml-auto">{surface.summary.background}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm border border-dashed border-[#9CA3AF]" />
                      <span className="text-[10px] text-[#374151]">No coverage</span>
                      <span className="text-[10px] text-[#6B7280] ml-auto">
                        {surface.summary.cells - surface.summary.scored}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#6B7280] mt-2 leading-snug">
                    {surface.summary.cells} cells · {Math.round(surface.cell_edge_m)} m edge ·
                    smoothed at σ {Math.round(surface.sigma_m)} m from{' '}
                    {surface.basis === 'ranker_score' ? 'ranker scores' : 'row-model scores'}.
                    {surface.flat ? (
                      <> Scores do not separate this city&apos;s cells, so nothing is banded
                      priority or watch.</>
                    ) : (
                      <> Bands are quantiles of this city&apos;s own cells, not probabilities:
                      priority ≥ {surface.bands.priority_at?.toFixed(1)} · watch ≥{' '}
                      {surface.bands.watch_at?.toFixed(1)}.</>
                    )}{' '}
                    Dashed cells have no ATM within {Math.round(surface.reach_m)} m and are not scored.
                  </div>
                </div>
              )}

              {/* Intervention zones: the operational read of the surface */}
              {hasZones && zones && (
                <div className="pt-2 border-t border-[#D1D5DB]">
                  <div className="text-[10px] text-[#6B7280] uppercase mb-2">
                    Intervention zones
                  </div>
                  <div className="space-y-1.5">
                    {zones.zones.map((zone) => (
                      <div key={zone.zone_id} className="flex items-center gap-2">
                        <div className={`w-3 h-2 border border-dashed ${
                          zone.level === 'priority' ? 'border-[#991b1b]' : 'border-[#92400e]'
                        }`} />
                        <span className="text-[10px] text-[#374151]">
                          {zone.zone_id} · {zone.cells} cells
                        </span>
                        <span className="text-[10px] text-[#6B7280] ml-auto">
                          {zone.priority_cells} priority
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-[#6B7280] mt-2 leading-snug">
                    {zones.summary.zones} zone{zones.summary.zones === 1 ? '' : 's'} from{' '}
                    {zones.summary.clustered_cells} adjacent cells · DBSCAN over H3
                    neighbourhoods (eps {zones.eps_hops} cell
                    {zones.eps_hops === 1 ? '' : 's'}, min {zones.min_samples}).{' '}
                    {zones.summary.noise_cells > 0
                      ? `${zones.summary.noise_cells} isolated cell${zones.summary.noise_cells === 1 ? '' : 's'} not in a zone. `
                      : ''}
                    An area to check, not a predicted crime location.
                  </div>
                </div>
              )}

              {/* Rank zone explanation */}
              <div className="pt-2 border-t border-[#D1D5DB]">
                <div className="text-[10px] text-[#6B7280]">Pin colour</div>
                <div className="text-[10px] text-[#6B7280] mt-0.5">Blue = background · amber = watch · red = priority zone</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Detail Panel */}
      {selectedLocation && (
        <div className="absolute top-4 right-4 z-[1000] w-72">
          <div className="bg-white/95 backdrop-blur-xl rounded-xl border border-[#D1D5DB] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#D1D5DB]">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full animate-pulse"
                    style={{ backgroundColor: areaColor(selectedArea) }}
                  />
                  <span className="font-mono font-bold text-[#1F2937] text-base">{selectedLocation.atm_id}</span>
                </div>
                <button
                  onClick={() => onSelectLocation(null as any)}
                  className="p-1 rounded hover:bg-[#E5E7EB] transition-colors"
                >
                  <X size={14} className="text-[#6B7280]" />
                </button>
              </div>
              <p className="text-sm text-[#374151]">{selectedLocation.location_name}</p>
            </div>

            <div className="p-4 space-y-3">
              {/* Rank Zone */}
              <div className="bg-white rounded-lg p-3 border border-[#D1D5DB]" title={SCORE_TOOLTIP}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#6B7280] uppercase tracking-wider">Rank Zone</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    selectedArea === 'priority' ? 'bg-[#ef4444]/10 text-[#ef4444]' :
                    selectedArea === 'watch' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                    'bg-[#3b82f6]/10 text-[#3b82f6]'
                  }`}>
                    {AREA_LABEL[selectedArea]}
                  </span>
                </div>
                <div className={`text-3xl font-bold ${
                  selectedArea === 'priority' ? 'text-[#ef4444]' :
                  selectedArea === 'watch' ? 'text-[#f59e0b]' :
                  'text-[#3b82f6]'
                }`}>
                  #{selectedLocation.rank} <span className="text-base font-medium text-[#6B7280]">of {selectedTotal}</span>
                </div>
                <div className="text-[11px] text-[#4B5563] mt-1">
                  {areaPrimary(selectedArea, selectedLocation.rank, selectedTotal)}
                </div>
                <div className="text-[10px] text-[#6B7280] mt-0.5">
                  {areaSecondary(selectedArea, selectedLocation.display_score, selectedLocation.risk_score)}
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${selectedLocation.display_score ?? 0}%`,
                      background: `linear-gradient(90deg, ${areaColor(selectedArea)}, ${areaColor(selectedArea)}aa)`,
                    }}
                  />
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-lg p-2.5 border border-[#D1D5DB]">
                  <div className="flex items-center gap-1 mb-1">
                    <Clock size={10} className="text-[#6B7280]" />
                    <span className="text-[11px] text-[#6B7280] uppercase" title={OBSERVED_HOURS_TIP}>Cash-out records</span>
                  </div>
                  <div className="text-sm font-medium text-[#1F2937]">{selectedLocation.observed_window?.label ?? '—'}</div>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-[#D1D5DB]">
                  <div className="flex items-center gap-1 mb-1">
                    <MapPin size={10} className="text-[#6B7280]" />
                    <span className="text-[11px] text-[#6B7280] uppercase">Distance</span>
                  </div>
                  <div className="text-sm font-medium text-[#1F2937]">{selectedLocation.distance}</div>
                </div>
              </div>

              {/* Reason */}
              <div className="bg-white rounded-lg p-3 border border-[#D1D5DB]">
                <div className="flex items-center gap-1 mb-1.5">
                  <Shield size={10} className="text-[#6B7280]" />
                  <span className="text-[11px] text-[#6B7280] uppercase">AI Reasoning</span>
                </div>
                <p className="text-sm text-[#374151] leading-relaxed">{selectedLocation.reason}</p>
              </div>

              {/* Rank */}
              <div className="flex items-center justify-between text-[10px] text-[#6B7280]">
                <span>{areaPrimary(selectedArea, selectedLocation.rank, selectedTotal)}</span>
                <span className="font-mono">{selectedLocation.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Stats Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-white/95 backdrop-blur-xl rounded-xl border border-[#D1D5DB] px-4 py-2 flex flex-wrap justify-center items-center gap-x-4 gap-y-1 w-max max-w-[90vw]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#1D4ED8]" />
            <span className="text-xs font-medium text-[#374151]">Synthetic predictions</span>
          </div>
          <div className="text-[10px] text-[#6B7280]" title={SCORE_TOOLTIP}>
            <span className="text-[#1F2937] font-medium">{stats.total}</span> locations
          </div>
          <div className="text-[10px] text-[#6B7280]">
            <span className="text-[#ef4444] font-medium">{stats.priority}</span> priority ·{' '}
            <span className="text-[#f59e0b] font-medium">{stats.watch}</span> watch ·{' '}
            <span className="text-[#3b82f6] font-medium">{stats.background}</span> background
          </div>
        </div>
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-xl rounded-xl border border-[#D1D5DB] px-6 py-4 text-center">
            <Info size={20} className="text-[#6B7280] mx-auto mb-2" />
            <p className="text-base text-[#6B7280]">No locations match filters</p>
            <p className="text-[10px] text-[#6B7280] mt-1">Try adjusting risk or time filters</p>
            <button
              onClick={() => { setRiskFilter('all'); setTimeFilter('all'); }}
              className="pointer-events-auto mt-3 px-4 py-1.5 text-xs font-medium rounded-lg border border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Provenance label */}
      <div className="absolute top-2 right-2 z-[999] text-xs text-[#374151] bg-white/95 border border-gray-300 px-2 py-1 rounded">
        Synthetic prediction snapshot · not live operational data
      </div>
    </div>
  );
}
