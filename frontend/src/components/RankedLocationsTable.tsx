import { PredictionLocation, RiskFilter, TimeFilter } from '../types';
import { MapPin, Clock, AlertTriangle, ChevronDown, Search } from 'lucide-react';
import { useState, useMemo } from 'react';

interface RankedLocationsTableProps {
  locations: PredictionLocation[];
  onSelect: (loc: PredictionLocation) => void;
}

export default function RankedLocationsTable({ locations, onSelect }: RankedLocationsTableProps) {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [search, setSearch] = useState("");

  const timeWindows = ["17:00-19:00", "18:00-20:00", "18:30-20:30", "19:00-21:00", "19:30-21:30", "20:00-22:00"];

  const filtered = useMemo(() => locations.filter(loc => {
    const matchesRisk = riskFilter === "all" || loc.status === riskFilter;
    const matchesTime = timeFilter === "all" || loc.expected_window === timeFilter;
    const matchesSearch = search === "" ||
      loc.atm_id.toLowerCase().includes(search.toLowerCase()) ||
      loc.location_name.toLowerCase().includes(search.toLowerCase());
    return matchesRisk && matchesTime && matchesSearch;
  }), [locations, riskFilter, timeFilter, search]);

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-[#27272a]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg text-white">Prediction Ranking — Top Locations</h3>
            <p className="text-base text-[#d4d4d8] mt-0.5">
              Risk-ranked ATM locations with expected cash-out windows
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#d4d4d8]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ATM ID or Location..."
              className="w-full pl-7 pr-2 py-1.5 bg-[#0a0a0f] border border-[#27272a] rounded-lg text-base text-white placeholder-[#d4d4d8] focus:outline-none focus:border-[#71717a]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#0a0a0f] border border-[#27272a] rounded-lg p-0.5">
            {(["all", "High", "Medium", "Watch"] as RiskFilter[]).map(r => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  riskFilter === r ? "bg-[#27272a] text-white" : "text-[#d4d4d8] hover:text-white"
                }`}
              >
                {r === "all" ? "All Risk" : r}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[#0a0a0f] border border-[#27272a] rounded-lg p-0.5">
            {(["all", ...timeWindows] as TimeFilter[]).map(t => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  timeFilter === t ? "bg-[#27272a] text-white" : "text-[#d4d4d8] hover:text-white"
                }`}
              >
                {t === "all" ? "All Time" : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto sticky-table-container" style={{ maxHeight: 600 }}>
        <table className="w-full text-lg">
          <thead>
            <tr className="text-xs text-[#d4d4d8] uppercase border-b border-[#27272a]">
              <th className="text-left px-4 py-2 font-medium">Rank</th>
              <th className="text-left px-4 py-2 font-medium">ATM ID</th>
              <th className="text-left px-4 py-2 font-medium">Location</th>
              <th className="text-center px-4 py-2 font-medium">Risk Score</th>
              <th className="text-left px-4 py-2 font-medium">Window</th>
              <th className="text-left px-4 py-2 font-medium">Distance</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <div className="text-[#d4d4d8] text-base">No locations match filters</div>
                </td>
              </tr>
            ) : (
              filtered.map((loc) => (
                <tr
                  key={loc.atm_id}
                  onClick={() => onSelect(loc)}
                  className="border-b border-[#27272a] last:border-0 hover:bg-[#18181b] transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-base text-[#e4e4e7] font-mono">#{loc.rank}</td>
                  <td className="px-4 py-3 text-base font-mono font-medium text-white">{loc.atm_id}</td>
                  <td className="px-4 py-3 text-base text-[#e4e4e7]">{loc.location_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-lg font-bold ${
                      loc.risk_score > 70 ? "text-[#ef4444]" :
                      loc.risk_score > 45 ? "text-[#f59e0b]" :
                      "text-[#d4d4d8]"
                    }`}>
                      {loc.risk_score}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-base text-[#e4e4e7]">{loc.expected_window}</td>
                  <td className="px-4 py-3 text-base text-[#e4e4e7]">{loc.distance}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      loc.status === "High" ? "bg-[#ef4444]/10 text-[#ef4444]" :
                      loc.status === "Medium" ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                      "bg-[#27272a] text-[#d4d4d8]"
                    }`}>
                      {loc.status}
                    </span>
                   </td>
                   <td className="px-4 py-3 text-base text-[#d4d4d8] max-w-[240px] truncate" title={loc.reason}>
                     {loc.reason}
                   </td>
                 </tr>
               ))
             )}
           </tbody>
         </table>
       </div>
     </div>
   );
 }

 export function RankedLocationsTableSkeleton() {
   return (
     <div className="card overflow-hidden">
       <div className="p-4 border-b border-[#27272a]">
         <div className="h-4 w-48 bg-[#27272a] rounded animate-pulse mb-1" />
         <div className="h-3 w-64 bg-[#27272a] rounded animate-pulse" />
       </div>
       <div className="p-4 space-y-3">
         {Array.from({ length: 5 }).map((_, i) => (
           <div key={i} className="flex items-center gap-4">
             <div className="h-4 w-8 bg-[#27272a] rounded animate-pulse" />
             <div className="h-4 w-20 bg-[#27272a] rounded animate-pulse" />
             <div className="h-4 w-24 bg-[#27272a] rounded animate-pulse" />
             <div className="h-4 w-12 bg-[#27272a] rounded animate-pulse" />
             <div className="h-4 w-20 bg-[#27272a] rounded animate-pulse" />
             <div className="h-4 w-16 bg-[#27272a] rounded animate-pulse" />
             <div className="h-4 w-16 bg-[#27272a] rounded animate-pulse" />
           </div>
         ))}
       </div>
     </div>
   );
 }
