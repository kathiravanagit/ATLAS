import { PredictionLocation } from '../types';
import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Popup, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin, Filter, ChevronDown, ChevronUp, AlertTriangle,
  Clock, Shield, Crosshair, RotateCcw, X, Info
} from 'lucide-react';
import GlobeTransition from './globe/GlobeTransition';

interface MapViewProps {
  locations: PredictionLocation[];
  selectedLocation: PredictionLocation | null;
  onSelectLocation: (loc: PredictionLocation) => void;
  cityCenter?: [number, number];
}

function riskColor(score: number): string {
  if (score > 70) return '#ef4444';
  if (score > 45) return '#f59e0b';
  return '#3b82f6';
}

function riskLabel(score: number): string {
  if (score > 70) return 'Critical';
  if (score > 45) return 'Elevated';
  return 'Normal';
}

function createPinIcon(score: number, isSelected: boolean): L.DivIcon {
  const color = riskColor(score);
  const size = isSelected ? 40 : 34;
  const stroke = isSelected ? '#ffffff' : color;
  const strokeW = isSelected ? 3 : 2;

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
          ${Math.round(score)}
        </text>
        <text x="${size / 2}" y="${size / 2 + 9}" text-anchor="middle" fill="${color}" font-size="6" font-weight="600" font-family="sans-serif" letter-spacing="0.5">
          ${score > 70 ? 'CRIT' : score > 45 ? 'ELEV' : 'NORM'}
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
      map.flyTo(center, 15, { duration: 1.2 });
    }
  }, [center, map]);
  return null;
}

function ZoomControls({ onRecenter }: { onRecenter: () => void }) {
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
    </div>
  );
}

type RiskFilterType = 'all' | 'critical' | 'elevated' | 'normal';
type TimeFilterType = 'all' | '17:00-19:00' | '18:00-20:00' | '19:00-21:00' | '20:00-22:00';

export default function MapView({ locations, selectedLocation, onSelectLocation, cityCenter }: MapViewProps) {
  const [showFilters, setShowFilters] = useState(true);
  const [riskFilter, setRiskFilter] = useState<RiskFilterType>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('all');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [hoveredAtm, setHoveredAtm] = useState<string | null>(null);
  const [globeDone, setGlobeDone] = useState(false);

  const center: [number, number] = useMemo(() => {
    if (selectedLocation) return [selectedLocation.latitude, selectedLocation.longitude];
    if (locations.length > 0) {
      const highest = locations.reduce((max, loc) => loc.risk_score > max.risk_score ? loc : max, locations[0]);
      return [highest.latitude, highest.longitude];
    }
    return cityCenter || [11.9416, 79.8083];
  }, [selectedLocation, locations, cityCenter]);

  const filtered = useMemo(() => locations.filter(loc => {
    const matchRisk = riskFilter === 'all' ||
      (riskFilter === 'critical' && loc.risk_score > 70) ||
      (riskFilter === 'elevated' && loc.risk_score > 45 && loc.risk_score <= 70) ||
      (riskFilter === 'normal' && loc.risk_score <= 45);
    const matchTime = timeFilter === 'all' || loc.expected_window.includes(timeFilter.split('-')[0].slice(0, 2));
    return matchRisk && matchTime;
  }), [locations, riskFilter, timeFilter]);

  const stats = useMemo(() => ({
    total: filtered.length,
    critical: filtered.filter(l => l.risk_score > 70).length,
    elevated: filtered.filter(l => l.risk_score > 45 && l.risk_score <= 70).length,
    normal: filtered.filter(l => l.risk_score <= 45).length,
    avgRisk: filtered.length > 0 ? Math.round(filtered.reduce((s, l) => s + l.risk_score, 0) / filtered.length) : 0,
  }), [filtered]);

  return (
    <div className="relative w-full h-[calc(100vh-180px)] min-h-[500px] rounded-xl overflow-hidden border border-[#D1D5DB]">
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
        <MapEvents onClick={() => onSelectLocation(null as any)} />

        {showHeatmap && filtered.map((loc) => {
          const r = loc.risk_score > 70 ? 200 : loc.risk_score > 45 ? 150 : 100;
          const c = riskColor(loc.risk_score);
          return (
            <React.Fragment key={`heat-${loc.atm_id}`}>
              <Circle
                center={[loc.latitude, loc.longitude]}
                radius={r}
                pathOptions={{ color: c, fillColor: c, fillOpacity: 0.04, weight: 0 }}
              />
              <Circle
                center={[loc.latitude, loc.longitude]}
                radius={r * 0.55}
                pathOptions={{ color: c, fillColor: c, fillOpacity: 0.08, weight: 0 }}
              />
              <Circle
                center={[loc.latitude, loc.longitude]}
                radius={r * 0.25}
                pathOptions={{ color: c, fillColor: c, fillOpacity: 0.15, weight: 0 }}
              />
            </React.Fragment>
          );
        })}

        {filtered.map((loc) => (
          <Marker
            key={loc.atm_id}
            position={[loc.latitude, loc.longitude]}
            icon={createPinIcon(loc.risk_score, selectedLocation?.atm_id === loc.atm_id)}
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
              <div style={{ color: '#18181b', fontSize: '12px', padding: '4px', minWidth: '150px' }}>
                <strong style={{ fontSize: '14px' }}>{loc.atm_id}</strong><br />
                <span>{loc.location_name}</span><br />
                <span style={{ fontWeight: 'bold', color: riskColor(loc.risk_score) }}>
                  Risk: {loc.risk_score}%
                </span><br />
                <span>Window: {loc.expected_window}</span>
              </div>
            </Popup>
          </Marker>
        ))}
        <ZoomControls onRecenter={() => {
          const highest = locations.reduce((max, loc) => loc.risk_score > max.risk_score ? loc : max, locations[0]);
          if (highest) onSelectLocation(highest);
        }} />
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
            <p className="text-[10px] text-[#6B7280]">
              {stats.total} locations | {stats.critical} critical
            </p>
          </div>

          {/* Filter Toggle */}
          <div className="px-4 pt-3">
            <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-[#D1D5DB]">
              {(['all', 'critical', 'elevated', 'normal'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setRiskFilter(f)}
                  className={`flex-1 py-1.5 text-[10px] rounded-md transition-all ${
                    riskFilter === f
                      ? f === 'critical' ? 'bg-[#ef4444]/15 text-[#ef4444]' :
                        f === 'elevated' ? 'bg-[#f59e0b]/15 text-[#f59e0b]' :
                        f === 'normal' ? 'bg-[#3b82f6]/15 text-[#3b82f6]' :
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
              {/* Time Window */}
              <div>
                <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1.5 block">Time Window</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', '17:00-19:00', '18:00-20:00', '19:00-21:00', '20:00-22:00'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTimeFilter(t)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                        timeFilter === t
                          ? 'border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#3b82f6]'
                          : 'border-[#D1D5DB] text-[#6B7280] hover:border-[#9CA3AF]'
                      }`}
                    >
                      {t === 'all' ? 'Any' : t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Heatmap Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6B7280]">Risk Heatmap</span>
                <button
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`relative w-8 h-[18px] rounded-full transition-colors ${
                    showHeatmap ? 'bg-[#3b82f6]' : 'bg-[#F3F4F6]'
                  }`}
                >
                  <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all ${
                    showHeatmap ? 'left-[14px]' : 'left-[2px]'
                  }`} />
                </button>
              </div>

              {/* Risk Legend */}
              <div className="pt-2 border-t border-[#D1D5DB]">
                <div className="text-[10px] text-[#6B7280] uppercase mb-2">Risk Levels</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                    <span className="text-[10px] text-[#374151]">Critical ({'>'}70%)</span>
                    <span className="text-[10px] text-[#6B7280] ml-auto">{stats.critical}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                    <span className="text-[10px] text-[#374151]">Elevated (45-70%)</span>
                    <span className="text-[10px] text-[#6B7280] ml-auto">{stats.elevated}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                    <span className="text-[10px] text-[#374151]">Normal ({'<'}45%)</span>
                    <span className="text-[10px] text-[#6B7280] ml-auto">{stats.normal}</span>
                  </div>
                </div>
              </div>

              {/* Zone Radius */}
              <div className="pt-2 border-t border-[#D1D5DB]">
                <div className="text-[10px] text-[#6B7280]">Heatmap Zones</div>
                <div className="text-[10px] text-[#6B7280] mt-0.5">200m / 150m / 100m radius</div>
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
                    style={{ backgroundColor: riskColor(selectedLocation.risk_score) }}
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
              {/* Risk Score */}
              <div className="bg-white rounded-lg p-3 border border-[#D1D5DB]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#6B7280] uppercase tracking-wider">Risk Score</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    selectedLocation.risk_score > 70 ? 'bg-[#ef4444]/10 text-[#ef4444]' :
                    selectedLocation.risk_score > 45 ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                    'bg-[#3b82f6]/10 text-[#3b82f6]'
                  }`}>
                    {riskLabel(selectedLocation.risk_score)}
                  </span>
                </div>
                <div className={`text-3xl font-bold ${
                  selectedLocation.risk_score > 70 ? 'text-[#ef4444]' :
                  selectedLocation.risk_score > 45 ? 'text-[#f59e0b]' :
                  'text-[#3b82f6]'
                }`}>
                  {selectedLocation.risk_score}%
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${selectedLocation.risk_score}%`,
                      background: `linear-gradient(90deg, ${riskColor(selectedLocation.risk_score)}, ${riskColor(selectedLocation.risk_score)}aa)`,
                    }}
                  />
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-lg p-2.5 border border-[#D1D5DB]">
                  <div className="flex items-center gap-1 mb-1">
                    <Clock size={10} className="text-[#6B7280]" />
                    <span className="text-[11px] text-[#6B7280] uppercase">Window</span>
                  </div>
                  <div className="text-sm font-medium text-[#1F2937]">{selectedLocation.expected_window}</div>
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
                <p className="text-[11px] text-[#374151] leading-relaxed">{selectedLocation.reason}</p>
              </div>

              {/* Rank */}
              <div className="flex items-center justify-between text-[10px] text-[#6B7280]">
                <span>Rank #{selectedLocation.rank} of {locations.length}</span>
                <span className="font-mono">{selectedLocation.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Stats Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-white/90 backdrop-blur-xl rounded-full border border-[#D1D5DB] px-5 py-2 flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-[10px] text-[#374151]">LIVE</span>
          </div>
          <div className="text-[10px] text-[#6B7280]">
            <span className="text-[#1F2937] font-medium">{stats.total}</span> locations
          </div>
          <div className="text-[10px] text-[#6B7280]">
            <span className="text-[#ef4444] font-medium">{stats.critical}</span> critical
          </div>
          <div className="text-[10px] text-[#6B7280]">
            Avg risk <span className="text-[#1F2937] font-medium">{stats.avgRisk}%</span>
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
          </div>
        </div>
      )}

      {/* Provenance label */}
      <div className="absolute bottom-1 right-2 z-[999] text-[8px] text-[#52525b] bg-[#09090b]/60 px-1.5 py-0.5 rounded">
        Synthetic | 8 cities | 64 ATMs | Updated: {new Date().toLocaleDateString('en-IN')}
      </div>
    </div>
  );
}
