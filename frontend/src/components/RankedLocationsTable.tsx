import { PredictionLocation, RiskFilter, TimeFilter } from '../types';
import { riskArea, SCORE_TOOLTIP, CASE_SEVERITY_NOTE } from '../lib/riskAreas';
import { TIME_BUCKETS, OBSERVED_HOURS_TIP, matchesTimeBucket } from '../lib/observedHours';
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

  const filtered = useMemo(() => locations.filter(loc => {
    const matchesRisk = riskFilter === "all" || loc.status === riskFilter;
    const matchesTime = matchesTimeBucket(loc.observed_window?.hours, timeFilter);
    const matchesSearch = search === "" ||
      loc.atm_id.toLowerCase().includes(search.toLowerCase()) ||
      loc.location_name.toLowerCase().includes(search.toLowerCase());
    return matchesRisk && matchesTime && matchesSearch;
  }), [locations, riskFilter, timeFilter, search]);

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-[#D2D1CA]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1A1C1F]">Ranked locations</h3>
            <p className="mt-0.5 text-[12px] text-[#5F6368]">
              Risk-ranked ATMs; the times shown are cash-out records on file
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5F6368]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ATM ID or Location..."
              className="w-full pl-7 pr-2 py-1.5 bg-white border border-[#D2D1CA] rounded-lg text-sm text-[#1A1C1F] placeholder-[#8A8D90] focus:outline-none focus:border-[#17406F]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#EFEFEA] border border-[#D2D1CA] rounded-lg p-0.5">
            {(["all", "High", "Medium", "Watch"] as RiskFilter[]).map(r => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  riskFilter === r ? "bg-white text-[#1A1C1F]" : "text-[#5F6368] hover:text-[#1A1C1F]"
                }`}
              >
                {r === "all" ? "All Risk" : r}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[#EFEFEA] border border-[#D2D1CA] rounded-lg p-0.5" title={OBSERVED_HOURS_TIP}>
            {TIME_BUCKETS.map(bucket => (
              <button
                key={bucket.id}
                onClick={() => setTimeFilter(bucket.id)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  timeFilter === bucket.id ? "bg-white text-[#1A1C1F]" : "text-[#5F6368] hover:text-[#1A1C1F]"
                }`}
              >
                {bucket.id === "all" ? "All Times" : bucket.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto sticky-table-container" style={{ maxHeight: 600 }}>
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr className="text-xs text-[#5F6368]  border-b border-[#D2D1CA]">
              <th className="text-left px-4 py-2 font-medium">Zone · Rank</th>
              <th className="text-left px-4 py-2 font-medium">ATM ID</th>
              <th className="text-left px-4 py-2 font-medium">Location</th>
              <th className="text-center px-4 py-2 font-medium" title={SCORE_TOOLTIP}>Display</th>
              <th className="text-left px-4 py-2 font-medium" title={OBSERVED_HOURS_TIP}>Records</th>
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
                    <div className="w-12 h-12 bg-[#EFEFEA] rounded-full flex items-center justify-center mx-auto mb-3">
                      <MapPin size={20} className="text-[#8A8D90]" />
                    </div>
                    <p className="text-[#43474C] font-medium text-sm">No locations match your filters</p>
                    <p className="text-[#8A8D90] text-[11px] mt-1">Try adjusting your search or risk level</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((loc) => {
                const total = filtered.length;
                const area = riskArea(loc.rank, total, loc.risk_area);
                return (
                <tr
                  key={loc.atm_id}
                  onClick={() => onSelect(loc)}
                  tabIndex={0} aria-label={`Select ${loc.atm_id} for explanation`}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(loc); } }}
                  className="border-b border-[#D2D1CA] last:border-0 hover:bg-[#FAFAF7] transition-colors duration-150 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="num text-[13px] font-medium text-[#1A1C1F]">
                      #{loc.rank} <span className="text-[#8A8D90]">of {total}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#5F6368]">
                      {area === "priority" ? "Priority zone" : area === "watch" ? "Watch zone" : "Background"}
                    </div>
                  </td>
                  <td className="num px-4 py-3 text-[13px] font-medium text-[#1A1C1F]">{loc.atm_id}</td>
                  <td className="px-4 py-3 text-sm text-[#43474C]">{loc.location_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="num text-[13px] text-[#43474C]" title={SCORE_TOOLTIP}>
                      {loc.display_score ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#43474C]" title={OBSERVED_HOURS_TIP}>{loc.observed_window?.label ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#43474C]">{loc.distance}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${
                      loc.status === "High" ? "text-[#B91C1C]" :
                      loc.status === "Medium" ? "text-[#B45309]" :
                      "text-[#5F6368]"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        loc.status === "High" ? "bg-[#B91C1C]" :
                        loc.status === "Medium" ? "bg-[#B45309]" :
                        "bg-[#8A8D90]"
                      }`} aria-hidden="true" />
                      {loc.status}
                    </span>
                   </td>
                   <td className="px-4 py-3 text-sm text-[#5F6368] max-w-[240px] truncate" title={loc.reason}>
                     {loc.reason}
                   </td>
                 </tr>
               );
             })
           )
           }
          </tbody>
         </table>
       </div>
       <div className="border-t border-[#D2D1CA] px-4 py-2.5 text-[11px] text-[#8A8D90]">
         {CASE_SEVERITY_NOTE}. Rows are ordered by rank; every row opens its evidence.
       </div>
     </div>
   );
 }

 export function RankedLocationsTableSkeleton() {
   return (
     <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#D2D1CA]">
          <div className="h-4 w-48 bg-[#E2E1DB] rounded animate-pulse mb-1" />
          <div className="h-3 w-64 bg-[#E2E1DB] rounded animate-pulse" />
       </div>
       <div className="p-4 space-y-3">
         {Array.from({ length: 5 }).map((_, i) => (
           <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-8 bg-[#E2E1DB] rounded animate-pulse" />
              <div className="h-4 w-20 bg-[#E2E1DB] rounded animate-pulse" />
              <div className="h-4 w-24 bg-[#E2E1DB] rounded animate-pulse" />
              <div className="h-4 w-12 bg-[#E2E1DB] rounded animate-pulse" />
              <div className="h-4 w-20 bg-[#E2E1DB] rounded animate-pulse" />
              <div className="h-4 w-16 bg-[#E2E1DB] rounded animate-pulse" />
              <div className="h-4 w-16 bg-[#E2E1DB] rounded animate-pulse" />
           </div>
         ))}
       </div>
     </div>
   );
 }
