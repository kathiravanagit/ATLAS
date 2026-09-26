import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, MapPin, User, LogOut, HelpCircle, ShieldCheck, Clock, Wifi, WifiOff } from 'lucide-react';
import GovtBadge from './GovtBadge';
import { authFetch, getUser, logout } from '@/lib/auth';

interface City {
  id: string;
  name: string;
  state: string;
  center: [number, number];
}

interface TopNavProps {
  selectedCity: string;
  onCityChange: (cityId: string) => void;
  usingFallback: boolean;
  lastUpdated: Date;
}

const DEFAULT_CITIES: City[] = [
  { id: "puducherry", name: "Puducherry", state: "Puducherry", center: [11.9416, 79.8083] },
  { id: "chennai", name: "Chennai", state: "Tamil Nadu", center: [13.0827, 80.2707] },
  { id: "delhi", name: "Delhi", state: "Delhi", center: [28.7041, 77.1025] },
  { id: "mumbai", name: "Mumbai", state: "Maharashtra", center: [19.0760, 72.8777] },
  { id: "bangalore", name: "Bangalore", state: "Karnataka", center: [12.9716, 77.5946] },
  { id: "kolkata", name: "Kolkata", state: "West Bengal", center: [22.5726, 88.3639] },
  { id: "hyderabad", name: "Hyderabad", state: "Telangana", center: [17.3850, 78.4867] },
  { id: "ahmedabad", name: "Ahmedabad", state: "Gujarat", center: [23.0225, 72.5714] },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST';
}

export default function TopNav({ selectedCity, onCityChange, usingFallback, lastUpdated }: TopNavProps) {
  const navigate = useNavigate();
  const [cities, setCities] = useState<City[]>(DEFAULT_CITIES);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const user = getUser() as Record<string, string> | null;

  useEffect(() => {
    authFetch('/api/cities')
      .then(res => res.json())
      .then(data => { if (data.length > 0) setCities(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setShowCityDropdown(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const currentCity = cities.find(c => c.id === selectedCity) || cities[0];
  const userName = user?.name || 'Inspector Demo';
  const userRole = user?.role || 'Cybercrime Division';

  return (
    <header className="sticky top-0 z-[1100]">
      {/* ── Section 1: Demo Notice ─────────────────────────────────── */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-1.5">
        <p className="text-center text-[10px] md:text-[11px] text-amber-800">
          <span className="font-semibold">Demonstration Portal — Hackathon demo, synthetic data</span>
          {' — '}
          <span className="hidden sm:inline">This system uses synthetic data generated for SIH 2026 evaluation. Not connected to any live crime, banking, or government databases.</span>
          <span className="sm:hidden">Synthetic data only. Not connected to live systems.</span>
        </p>
      </div>
      {usingFallback && (
        <div className="bg-[#B91C1C] px-4 md:px-6 py-1.5" role="alert">
          <p className="text-center text-[10px] md:text-[11px] text-white font-semibold">
            DEMO DATA — backend unavailable, showing cached fallback. No live decisions permitted.
          </p>
        </div>
      )}

      {/* ── Section 2: Institutional Header ────────────────────────── */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 md:px-6 py-2">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <GovtBadge size={24} className="flex-shrink-0 hidden sm:block" />
            <div className="leading-tight min-w-0">
              <div className="text-[10px] md:text-[11px] text-[#6B7280] font-medium truncate">SIH 2026 Prototype — Demonstration Portal</div>
              <div className="text-xs md:text-sm font-semibold text-[#1F2937] tracking-tight truncate">ATLAS — Advanced Threat Location & Alert System</div>
            </div>
          </div>

          {/* Right: Status + Utility Links — desktop only */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
              {usingFallback ? <WifiOff size={11} className="text-[#B91C1C]" /> : <Wifi size={11} className="text-[#15803D]" />}
              <span>{usingFallback ? 'Offline' : 'Connected'}</span>
            </div>
            <div className="w-px h-3.5 bg-[#E5E7EB]" />
            <span className="text-[11px] text-[#6B7280]">Synthetic data</span>
            <div className="w-px h-3.5 bg-[#E5E7EB]" />
            <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
              <Clock size={10} />
              <span>{formatTime(lastUpdated)}</span>
            </div>
            <div className="w-px h-3.5 bg-[#E5E7EB]" />
            <div className="flex items-center gap-2.5 text-[11px]">
              <button className="text-[#6B7280] hover:text-[#1F2937] transition-colors flex items-center gap-1"><HelpCircle size={11} /> Help</button>
              <button onClick={() => navigate('/real/data-privacy')} className="text-[#6B7280] hover:text-[#1F2937] transition-colors flex items-center gap-1"><ShieldCheck size={11} /> Privacy</button>
              <button onClick={handleLogout} className="text-[#B91C1C] hover:text-[#991B1B] transition-colors flex items-center gap-1 font-medium"><LogOut size={11} /> Logout</button>
            </div>
          </div>

          {/* Mobile: compact status */}
          <div className="flex lg:hidden items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 text-[10px] text-[#6B7280]">
              {usingFallback ? <WifiOff size={10} className="text-[#B91C1C]" /> : <Wifi size={10} className="text-[#15803D]" />}
            </div>
            <button onClick={handleLogout} className="text-[10px] text-[#B91C1C] font-medium">Logout</button>
          </div>
        </div>
      </div>

      {/* ── Section 3: Navy Bar — Jurisdiction + Profile ───────────── */}
      <div className="bg-[#12355B] px-4 md:px-6">
        <div className="flex items-center justify-end h-9 gap-3">
          {/* Jurisdiction Selector */}
          <div className="relative" ref={cityRef}>
            <button
              onClick={() => setShowCityDropdown(!showCityDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 border border-white/20 rounded text-[11px] text-white hover:bg-white/15 transition-colors"
            >
              <MapPin size={10} className="text-[#93c5fd]" />
              <span className="font-medium">{currentCity.name}</span>
              <span className="text-[#93c5fd] text-[10px]">{currentCity.state}</span>
              <ChevronDown size={10} className={`text-[#93c5fd] transition-transform ${showCityDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showCityDropdown && (
              <>
                <div className="fixed inset-0 z-[1101]" onClick={() => setShowCityDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#D1D5DB] rounded-lg shadow-lg z-[1102] overflow-hidden">
                  <div className="p-1.5 border-b border-[#E5E7EB]">
                    <span className="text-[10px] text-[#6B7280] uppercase px-2 font-medium">Select Jurisdiction</span>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto p-1">
                    {cities.map(city => (
                      <button
                        key={city.id}
                        onClick={() => { onCityChange(city.id); setShowCityDropdown(false); }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-[12px] transition-colors ${
                          selectedCity === city.id
                            ? 'bg-[#1D4ED8]/10 text-[#1D4ED8] font-medium'
                            : 'text-[#1F2937] hover:bg-[#F3F4F6]'
                        }`}
                      >
                        <MapPin size={12} className={selectedCity === city.id ? 'text-[#1D4ED8]' : 'text-[#9CA3AF]'} />
                        <div>
                          <div>{city.name}</div>
                          <div className="text-[10px] text-[#9CA3AF]">{city.state}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="w-px h-4 bg-white/20" />

          {/* User Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10 transition-colors"
            >
              <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
                <User size={12} className="text-white" />
              </div>
              <div className="text-left hidden md:block">
                <div className="text-[11px] font-medium text-white leading-tight">{userName}</div>
                <div className="text-[10px] text-[#93c5fd] leading-tight">{userRole}</div>
              </div>
              <ChevronDown size={10} className={`text-[#93c5fd] transition-transform hidden md:block ${showProfile ? 'rotate-180' : ''}`} />
            </button>
            {showProfile && (
              <>
                <div className="fixed inset-0 z-[1101]" onClick={() => setShowProfile(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-[#D1D5DB] rounded-lg shadow-lg z-[1102] overflow-hidden">
                  <div className="p-2.5 border-b border-[#E5E7EB]">
                    <div className="text-[12px] font-medium text-[#1F2937]">{userName}</div>
                    <div className="text-[10px] text-[#6B7280]">{user?.email}</div>
                  </div>
                  <div className="p-1">
                    <button onClick={() => { setShowProfile(false); navigate('/real/profile'); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937] transition-colors">
                      <User size={12} /> Profile Settings
                    </button>
                    <button onClick={() => { setShowProfile(false); navigate('/real/audit'); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1F2937] transition-colors">
                      <ShieldCheck size={12} /> Activity Log
                    </button>
                  </div>
                  <div className="p-1 border-t border-[#E5E7EB]">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#B91C1C] hover:bg-red-50 transition-colors">
                      <LogOut size={12} /> Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
