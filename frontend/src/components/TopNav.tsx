import { useNavigate } from 'react-router-dom';
import { Clock, LogOut, MapPin, User, Wifi, WifiOff } from 'lucide-react';
import GovtBadge from './GovtBadge';
import { getUser, logout } from '@/lib/auth';

interface City {
  id: string;
  name: string;
  state: string;
  center: [number, number];
}

interface TopNavProps {
  selectedCity: string;
  onCityChange: (cityId: string) => void;
  dataMode: 'live' | 'demo' | 'unavailable';
  lastUpdated: Date;
  demoMode?: boolean;
}

export const CITIES: City[] = [
  { id: 'puducherry', name: 'Puducherry', state: 'Puducherry', center: [11.9416, 79.8083] },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', center: [13.0827, 80.2707] },
  { id: 'delhi', name: 'Delhi', state: 'Delhi', center: [28.7041, 77.1025] },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', center: [19.076, 72.8777] },
  { id: 'bangalore', name: 'Bangalore', state: 'Karnataka', center: [12.9716, 77.5946] },
  { id: 'kolkata', name: 'Kolkata', state: 'West Bengal', center: [22.5726, 88.3639] },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', center: [17.385, 78.4867] },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', center: [23.0225, 72.5714] },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

export default function TopNav({ selectedCity, onCityChange, dataMode, lastUpdated, demoMode = false }: TopNavProps) {
  const navigate = useNavigate();
  const user = getUser() as Record<string, string> | null;
  const userName = user?.name || 'Inspector Demo';
  const userRole = user?.role || 'Cybercrime division';

  const handleLogout = async () => {
    if (!demoMode) await logout();
    navigate('/login');
  };

  const modeLabel =
    dataMode === 'unavailable' ? 'Unavailable' : dataMode === 'demo' ? 'Local fixtures' : 'API-connected synthetic';

  return (
    <header className="sticky top-0 z-[1100] bg-white">
      <div className="border-b border-[#E8E2D0] bg-[#FBF7EC] px-4 py-1">
        <p className="text-center text-[11px] leading-snug text-[#6B5B2E]">
          Demonstration portal · synthetic data · not connected to live crime, banking or government systems
        </p>
      </div>
      <div className="border-b border-[#E2E1DB]">
        <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 lg:hidden">
          <GovtBadge size={22} />
          <span className="text-[13px] font-semibold">ATLAS</span>
        </div>

        <div className="hidden min-w-0 items-center gap-2 text-[12px] text-[#5F6368] md:flex">
          {dataMode === 'unavailable' ? (
            <WifiOff size={14} className="text-[#B91C1C]" aria-hidden="true" />
          ) : (
            <Wifi size={14} className="text-[#15803D]" aria-hidden="true" />
          )}
          <span>{modeLabel}</span>
          <span className="text-[#D2D1CA]">/</span>
          <span className="inline-flex items-center gap-1">
            <Clock size={13} aria-hidden="true" />
            <span className="num">{formatTime(lastUpdated)} IST</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 rounded-lg border border-[#D2D1CA] bg-white px-2 py-1.5 text-[12px] text-[#43474C]">
            <MapPin size={13} className="text-[#8A8D90]" aria-hidden="true" />
            <span className="sr-only">Jurisdiction</span>
            <select
              value={selectedCity}
              onChange={e => onCityChange(e.target.value)}
              className="max-w-[130px] bg-transparent pr-1 text-[12px] font-medium text-[#1A1C1F] focus:outline-none"
            >
              {CITIES.map(city => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          <div className="hidden items-center gap-2 border-l border-[#E2E1DB] pl-3 sm:flex">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-[#EFEFEA] text-[#43474C]">
              <User size={14} strokeWidth={1.6} aria-hidden="true" />
            </div>
            <div className="hidden leading-tight md:block">
              <div className="text-[12px] font-medium text-[#1A1C1F]">{userName}</div>
              <div className="text-[11px] text-[#8A8D90]">{userRole}</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#5F6368] transition-colors hover:bg-[#EFEFEA] hover:text-[#1A1C1F]"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={15} strokeWidth={1.6} />
          </button>
        </div>
      </div>
      </div>

      {dataMode === 'unavailable' && (
        <div className="border-t border-[#B91C1C]/20 bg-[#B91C1C]/5 px-4 py-1.5" role="alert">
          <p className="text-center text-[12px] font-medium text-[#B91C1C]">
            API data unavailable — no substitute predictions are shown
          </p>
        </div>
      )}
    </header>
  );
}
