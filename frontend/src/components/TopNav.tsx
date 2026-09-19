import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Wifi, ChevronDown, MapPin, User, LogOut, Shield, Settings, AlertTriangle, Play, Zap } from 'lucide-react';
import GovtBadge from './GovtBadge';
import { authFetch, getUser, logout } from '@/lib/auth';
import { useDashboard } from '../context/DashboardContext';

interface City {
  id: string;
  name: string;
  state: string;
  center: [number, number];
}

interface TopNavProps {
  selectedCity: string;
  onCityChange: (cityId: string) => void;
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

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  inspector: 'Inspector',
  analyst: 'Analyst',
  bank_officer: 'Bank Officer',
};

export default function TopNav({ selectedCity, onCityChange }: TopNavProps) {
  const navigate = useNavigate();
  const { usingFallback, setSelectedCaseId, setPrediction } = useDashboard();
  const [cities, setCities] = useState<City[]>(DEFAULT_CITIES);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [scenarios, setScenarios] = useState<{ id: string; name: string; description: string }[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);
  const scenarioRef = useRef<HTMLDivElement>(null);
  const user = getUser() as Record<string, string> | null;

  useEffect(() => {
    authFetch('/api/cities')
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) setCities(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
      if (scenarioRef.current && !scenarioRef.current.contains(e.target as Node)) {
        setShowScenarios(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    authFetch('/api/scenarios')
      .then(r => r.json())
      .then(data => setScenarios(data))
      .catch(() => {});
  }, []);

  const loadScenario = async (scenarioId: string) => {
    try {
      const res = await authFetch(`/api/scenarios/${scenarioId}`);
      const data = await res.json();
      if (data.prediction) {
        setSelectedCaseId(data.case_id);
        setPrediction(data.prediction);
        onCityChange(data.city);
      }
      setShowScenarios(false);
      navigate('/real/predictions');
    } catch {}
  };

  const currentCity = cities.find(c => c.id === selectedCity) || cities[0];
  const userName = user?.name || 'User';
  const userRole = ROLE_LABELS[user?.role || ''] || user?.role || 'analyst';
  const userBadge = user?.badge || '';
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-14 bg-[#0a0a0f] border-b border-[#27272a] flex items-center px-6 sticky top-0 z-[1100]">
      <div className="flex items-center gap-2.5 text-base">
        <GovtBadge size={32} />
        <span className="text-white font-semibold">ATLAS</span>
      </div>

      <div className="ml-6 relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#18181b] border border-[#27272a] rounded-lg hover:border-[#71717a] transition-colors"
        >
          <MapPin size={12} className="text-[#3b82f6]" />
          <span className="text-sm font-medium text-white">{currentCity.name}</span>
          <span className="text-[10px] text-[#d4d4d8]">{currentCity.state}</span>
          <ChevronDown size={12} className={`text-[#d4d4d8] transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <>
            <div className="fixed inset-0 z-[1101]" onClick={() => setShowDropdown(false)} />
            <div className="absolute top-full left-0 mt-1 w-64 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl z-[1102] overflow-hidden">
              <div className="p-2 border-b border-[#27272a]">
                <div className="text-[10px] text-[#d4d4d8] uppercase px-2 py-1">Select City</div>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-1">
                {cities.map(city => (
                  <button
                    key={city.id}
                    onClick={() => {
                      onCityChange(city.id);
                      setShowDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedCity === city.id
                        ? 'bg-[#3b82f6]/10 text-[#3b82f6]'
                        : 'text-white hover:bg-[#27272a]'
                    }`}
                  >
                    <MapPin size={14} className={selectedCity === city.id ? 'text-[#3b82f6]' : 'text-[#d4d4d8]'} />
                    <div>
                      <div className="text-sm font-medium">{city.name}</div>
                      <div className="text-[10px] text-[#d4d4d8]">{city.state}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-4">
        {usingFallback ? (
          <div className="flex items-center gap-2 text-sm text-[#ef4444] bg-[#ef4444]/10 px-3 py-1.5 rounded-lg border border-[#ef4444]/30 shadow-lg shadow-[#ef4444]/10" title="Backend offline — showing cached demo data. All data is synthetic.">
            <AlertTriangle size={14} />
            <span className="font-semibold">Backend Offline — Demo Data</span>
            <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse"></span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-[#d4d4d8]">
            <Wifi size={12} />
            <span>Live</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"></span>
          </div>
        )}

        <div className="w-px h-4 bg-[#27272a]" />

        {/* Scenario Runner */}
        <div className="relative" ref={scenarioRef}>
          <button
            onClick={() => setShowScenarios(!showScenarios)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8b5cf6] text-white text-xs font-semibold rounded-lg hover:bg-[#7c3aed] transition-colors shadow-lg shadow-[#8b5cf6]/20"
          >
            <Zap size={12} />
            <span>Run Demo</span>
          </button>

          {showScenarios && (
            <>
              <div className="fixed inset-0 z-[1101]" onClick={() => setShowScenarios(false)} />
              <div className="absolute right-0 top-full mt-1 w-72 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl z-[1102] overflow-hidden">
                <div className="p-2 border-b border-[#27272a]">
                  <div className="text-[10px] text-[#d4d4d8] uppercase px-2 py-1 flex items-center gap-1">
                    <Zap size={10} className="text-[#8b5cf6]" />
                    Pre-Baked Demo Scenarios
                  </div>
                </div>
                <div className="p-1">
                  {scenarios.map(scenario => (
                    <button
                      key={scenario.id}
                      onClick={() => loadScenario(scenario.id)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-[#27272a] transition-colors"
                    >
                      <Play size={12} className="text-[#8b5cf6] mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-white">{scenario.name}</div>
                        <div className="text-[10px] text-[#d4d4d8] mt-0.5">{scenario.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-px h-4 bg-[#27272a]" />

        {/* Global Synthetic Data Indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#27272a]/50 rounded-lg" title="All data in this system is synthetic. No real PII or financial data.">
          <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
          <span className="text-[10px] text-[#d4d4d8] font-medium">Demo Mode</span>
        </div>

        <div className="w-px h-4 bg-[#27272a]" />

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#18181b] transition-colors"
          >
            <div className="w-8 h-8 bg-[#3b82f6]/20 border border-[#3b82f6]/30 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-[#3b82f6]">{userInitials}</span>
            </div>
            <div className="text-sm text-left hidden md:block">
              <div className="font-medium text-white">{userName}</div>
              <div className="text-[10px] text-[#d4d4d8] flex items-center gap-1">
                <Shield size={8} />
                {userRole}
              </div>
            </div>
            <ChevronDown size={12} className={`text-[#d4d4d8] transition-transform hidden md:block ${showProfile ? 'rotate-180' : ''}`} />
          </button>

          {showProfile && (
            <>
              <div className="fixed inset-0 z-[1101]" onClick={() => setShowProfile(false)} />
              <div className="absolute right-0 top-full mt-1 w-64 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl z-[1102] overflow-hidden">
                <div className="p-3 border-b border-[#27272a]">
                  <div className="text-sm font-medium text-white">{userName}</div>
                  <div className="text-[10px] text-[#d4d4d8] mt-0.5">{user?.email}</div>
                  {userBadge && (
                    <div className="text-[10px] text-[#3b82f6] mt-1 font-mono">Badge: {userBadge}</div>
                  )}
                </div>
                <div className="p-1">
                  <button
                    onClick={() => { setShowProfile(false); navigate('/real/profile'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#d4d4d8] hover:bg-[#27272a] hover:text-white transition-colors"
                  >
                    <User size={14} />
                    Profile Settings
                  </button>
                  <button
                    onClick={() => { setShowProfile(false); navigate('/real/audit'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#d4d4d8] hover:bg-[#27272a] hover:text-white transition-colors"
                  >
                    <Settings size={14} />
                    Activity Log
                  </button>
                </div>
                <div className="p-1 border-t border-[#27272a]">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
