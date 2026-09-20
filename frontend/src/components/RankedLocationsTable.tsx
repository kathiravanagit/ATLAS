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
      <div className="p-4 border-b border-[#D1D5DB]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg text-[#1F2937]">Risk Assessment — Ranked Locations</h3>
            <p className="text-base text-[#6B7280] mt-0.5">
              Risk-ranked ATM locations with expected cash-out windows
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ATM ID or Location..."
              className="w-full pl-7 pr-2 py-1.5 bg-white border border-[#D1D5DB] rounded-lg text-base text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1D4ED8]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#F3F4F6] border border-[#D1D5DB] rounded-lg p-0.5">
            {(["all", "High", "Medium", "Watch"] as RiskFilter[]).map(r => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  riskFilter === r ? "bg-white text-[#1F2937] shadow-sm" : "text-[#6B7280] hover:text-[#1F2937]"
                }`}
              >
                {r === "all" ? "All Risk" : r}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[#F3F4F6] border border-[#D1D5DB] rounded-lg p-0.5">
            {(["all", ...timeWindows] as TimeFilter[]).map(t => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  timeFilter === t ? "bg-white text-[#1F2937] shadow-sm" : "text-[#6B7280] hover:text-[#1F2937]"
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
            <tr className="text-xs text-[#6B7280] uppercase border-b border-[#D1D5DB]">
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
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-3">
                      <MapPin size={20} className="text-[#9CA3AF]" />
                    </div>
                    <p className="text-[#4B5563] font-medium text-sm">No locations match your filters</p>
                    <p className="text-[#9CA3AF] text-[11px] mt-1">Try adjusting your search or risk level</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((loc) => (
                <tr
                  key={loc.atm_id}
                  onClick={() => onSelect(loc)}
                  className="border-b border-[#D1D5DB] last:border-0 hover:bg-[#EFF6FF] transition-colors duration-150 cursor-pointer"
                >
                  <td className="px-4 py-3 text-base text-[#6B7280] font-mono">#{loc.rank}</td>
                  <td className="px-4 py-3 text-base font-mono font-medium text-[#1F2937]">{loc.atm_id}</td>
                  <td className="px-4 py-3 text-base text-[#4B5563]">{loc.location_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-lg font-bold ${
                      loc.risk_score > 70 ? "text-[#B91C1C]" :
                      loc.risk_score > 45 ? "text-[#B45309]" :
                      "text-[#6B7280]"
                    }`}>
                      {loc.risk_score}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-base text-[#4B5563]">{loc.expected_window}</td>
                  <td className="px-4 py-3 text-base text-[#4B5563]">{loc.distance}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      loc.status === "High" ? "bg-[#B91C1C]/10 text-[#B91C1C]" :
                      loc.status === "Medium" ? "bg-[#B45309]/10 text-[#B45309]" :
                      "bg-[#F3F4F6] text-[#6B7280]"
                    }`}>
                      {loc.status}
                    </span>
                   </td>
                   <td className="px-4 py-3 text-base text-[#6B7280] max-w-[240px] truncate" title={loc.reason}>
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
        <div className="p-4 border-b border-[#D1D5DB]">
          <div className="h-4 w-48 bg-[#E5E7EB] rounded animate-pulse mb-1" />
          <div className="h-3 w-64 bg-[#E5E7EB] rounded animate-pulse" />
       </div>
       <div className="p-4 space-y-3">
         {Array.from({ length: 5 }).map((_, i) => (
           <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-8 bg-[#E5E7EB] rounded animate-pulse" />
              <div className="h-4 w-20 bg-[#E5E7EB] rounded animate-pulse" />
              <div className="h-4 w-24 bg-[#E5E7EB] rounded animate-pulse" />
              <div className="h-4 w-12 bg-[#E5E7EB] rounded animate-pulse" />
              <div className="h-4 w-20 bg-[#E5E7EB] rounded animate-pulse" />
              <div className="h-4 w-16 bg-[#E5E7EB] rounded animate-pulse" />
              <div className="h-4 w-16 bg-[#E5E7EB] rounded animate-pulse" />
           </div>
         ))}
       </div>
     </div>
   );
 }
