import { Case } from '../types';
import { Eye, CheckCircle, Search, ChevronDown, ChevronUp, UserPlus, ShieldAlert, FileSearch, X, FolderOpen } from 'lucide-react';
import { useState, useMemo } from 'react';
import { areaPrimary, riskArea, SCORE_TOOLTIP } from '../lib/riskAreas';
import { authFetch, isDemoRoute } from '../lib/auth';
import { can } from '../lib/roles';

interface CasesTableProps {
  cases: Case[];
  onSelectCase?: (caseId: string) => void;
  onResolveCase?: (caseId: string) => void;
  onCaseUpdated?: () => void;
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  new: { label: "New", color: "text-[#17406F]", dot: "bg-[#17406F]" },
  investigating: { label: "Investigating", color: "text-[#B45309]", dot: "bg-[#B45309]" },
  resolved: { label: "Resolved", color: "text-[#15803D]", dot: "bg-[#15803D]" },
};

const CRIME_CATEGORIES = [
  "All", "UPI Fraud", "Card Cloning", "Phishing", "Investment Fraud",
  "Identity Theft", "SIM Swap", "QR Code Fraud", "Loan App Fraud", "Card Skimming"
];

const OFFICER_IDS = ["INS-001", "INS-002", "ANL-001", "ANL-002", "BKO-001"];

export default function CasesTable({ cases, onSelectCase, onResolveCase, onCaseUpdated }: CasesTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [crimeFilter, setCrimeFilter] = useState<string>("All");
  const [districtFilter, setDistrictFilter] = useState<string>("All");
  const [confirmResolve, setConfirmResolve] = useState<string | null>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Record<string, any>>({});
  const [assignDropdown, setAssignDropdown] = useState<string | null>(null);
  const [closeReasonModal, setCloseReasonModal] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = useMemo(() => cases.filter(c => {
    const matchesSearch = search === "" ||
      c.case_id.toLowerCase().includes(search.toLowerCase()) ||
      c.crime_type.toLowerCase().includes(search.toLowerCase()) ||
      (c.victim_name && c.victim_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesCrime = crimeFilter === "All" || c.crime_type === crimeFilter;
    const matchesDistrict = districtFilter === "All" || (c.district || "") === districtFilter;
    return matchesSearch && matchesStatus && matchesCrime && matchesDistrict;
  }), [cases, search, statusFilter, crimeFilter, districtFilter]);

  const crimeCounts = useMemo(() => cases.reduce((acc, c) => {
    acc[c.crime_type] = (acc[c.crime_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [cases]);

  // Jurisdictions present in the loaded set, so the control never offers a
  // district with no cases behind it.
  const districts = useMemo(
    () => Array.from(new Set(cases.map(c => c.district || "").filter(Boolean))).sort(),
    [cases],
  );

  const handleCaseAction = async (caseId: string, type: string, reason?: string, assignedTo?: string) => {
    setActionLoading(caseId);
    try {
      const res = await authFetch(`/api/cases/${caseId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, reason: reason || "", assigned_to: assignedTo || "" }),
      });
      if (res.ok) {
        onCaseUpdated?.();
      }
    } catch {}
    setActionLoading(null);
    setCloseReasonModal(null);
    setCloseReason("");
    setAssignDropdown(null);
  };

  const toggleExpand = async (caseId: string) => {
    if (expandedCase === caseId) {
      setExpandedCase(null);
      return;
    }
    setExpandedCase(caseId);
    if (!expandedData[caseId]) {
      try {
        const res = await authFetch(`/api/predictions/${caseId}`);
        if (res.ok) {
          const data = await res.json();
          setExpandedData(prev => ({ ...prev, [caseId]: data }));
        }
      } catch {}
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-[#D2D1CA]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-[15px] text-[#1A1C1F]">All cases</h3>
            <p className="text-sm text-[#5F6368] mt-0.5">
              {filtered.length} of {cases.length} cases | Crime category drill-down
            </p>
          </div>
        </div>

        {/* Crime Category Filter */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {CRIME_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCrimeFilter(cat)}
              className={`px-2 py-1 text-xs rounded-md transition-colors border ${
                crimeFilter === cat
                  ? "bg-[#17406F]/10 border-[#17406F]/30 text-[#17406F]"
                  : "border-[#D2D1CA] text-[#5F6368] hover:text-[#1A1C1F] hover:border-[#8A8D90]"
              }`}
            >
              {cat}
              {cat !== "All" && crimeCounts[cat] && (
                <span className="ml-1 opacity-60">({crimeCounts[cat]})</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5F6368]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search case ID, crime type or victim"
              className="w-full rounded-lg border border-[#D2D1CA] bg-white py-1.5 pl-7 pr-2 text-sm text-[#1A1C1F] placeholder-[#5F6368] focus:border-[#17406F] focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-[#D2D1CA] bg-[#EFEFEA] p-0.5">
              {["all", "new", "investigating", "resolved"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    statusFilter === s ? "bg-white text-[#1A1C1F]" : "text-[#5F6368] hover:text-[#1A1C1F]"
                  }`}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <select
              value={districtFilter}
              onChange={e => setDistrictFilter(e.target.value)}
              aria-label="Filter by district"
              className="rounded-lg border border-[#D2D1CA] bg-white px-2 py-1.5 text-xs text-[#1A1C1F] focus:border-[#17406F] focus:outline-none"
            >
              <option value="All">All districts</option>
              {districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto sticky-table-container" style={{ maxHeight: 600 }}>
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr className="text-xs text-[#5F6368]  border-b border-[#D2D1CA]">
              <th scope="col" className="text-left px-4 py-2 font-medium">Case ID</th>
              <th scope="col" className="text-left px-4 py-2 font-medium">Crime Type</th>
              <th scope="col" className="text-left px-4 py-2 font-medium">District</th>
              <th scope="col" className="text-left px-4 py-2 font-medium">Victim</th>
              <th scope="col" className="text-left px-4 py-2 font-medium">Amount</th>
              <th scope="col" className="text-center px-4 py-2 font-medium">Accounts</th>
              <th scope="col" className="text-left px-4 py-2 font-medium">Risk Level</th>
              <th scope="col" className="text-left px-4 py-2 font-medium">Status</th>
              <th scope="col" className="text-center px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center">
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-[#EFEFEA] rounded-full flex items-center justify-center mx-auto mb-3">
                      <FolderOpen size={20} className="text-[#8A8D90]" />
                    </div>
                    <p className="text-[#43474C] font-medium text-sm">No cases found</p>
                    <p className="text-[#8A8D90] text-[11px] mt-1">Try adjusting your filters or search terms</p>
                    <button
                      onClick={() => { setSearch(""); setStatusFilter("all"); setCrimeFilter("All"); setDistrictFilter("All"); }}
                      className="mt-3 px-4 py-1.5 text-xs font-medium rounded-lg border border-[#17406F]/40 bg-[#17406F]/10 text-[#17406F] hover:bg-[#17406F]/20 transition-colors"
                    >
                      Reset Filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.case_id}
                  className="border-b border-[#D2D1CA] last:border-0 hover:bg-[#FAFAF7] transition-colors duration-150 cursor-pointer"
                >
                  <td className="num px-4 py-3 text-[13px] font-medium text-[#1A1C1F]">
                      <button onClick={() => toggleExpand(c.case_id)} className="flex items-center gap-1 hover:text-[#17406F]">
                        <span className={`transition-transform duration-200 inline-block ${expandedCase === c.case_id ? 'rotate-180' : ''}`}>
                          <ChevronDown size={12} />
                        </span>
                        {c.case_id}
                      </button>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#43474C]">
                    {c.crime_type}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#43474C]">{c.district || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[#43474C]">{c.victim_name || '—'}</td>
                  <td className="num px-4 py-3 text-[13px] font-medium text-[#1A1C1F]">₹{c.amount.toLocaleString()}</td>
                  <td className="num px-4 py-3 text-center text-[13px] text-[#43474C]">{c.linked_accounts}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${
                      c.current_risk === "High" ? "text-[#B91C1C]" :
                      c.current_risk === "Medium" ? "text-[#B45309]" :
                      c.current_risk === "Low" ? "text-[#5F6368]" :
                      c.current_risk === "Resolved" ? "text-[#15803D]" :
                      "text-[#5F6368]"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        c.current_risk === "High" ? "bg-[#B91C1C]" :
                        c.current_risk === "Medium" ? "bg-[#B45309]" :
                        c.current_risk === "Low" ? "bg-[#8A8D90]" :
                        c.current_risk === "Resolved" ? "bg-[#15803D]" :
                        "bg-[#8A8D90]"
                      }`} aria-hidden="true" />
                      {c.current_risk}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${statusConfig[c.status]?.color || "text-[#5F6368]"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusConfig[c.status]?.dot || "bg-[#8A8D90]"}`} aria-hidden="true" />
                      {statusConfig[c.status]?.label || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 relative">
                      {c.status !== 'resolved' && actionLoading !== c.case_id && (
                        <>
                          {c.status === 'new' && can('case.acknowledge') && (
                            <button
                              disabled={isDemoRoute()}
                                                            onClick={(e) => { e.stopPropagation(); handleCaseAction(c.case_id, 'acknowledge'); }}
                              className="p-1.5 rounded hover:bg-[#EFEFEA] transition-colors"
                              title="Acknowledge"
                              aria-label={`Acknowledge case ${c.case_id}`}
                            >
                              <Eye size={14} className="text-[#17406F]" />
                            </button>
                          )}
                          {can('case.assign') && (
                          <div className="relative">
                            <button
                              disabled={isDemoRoute()}
                                                            onClick={(e) => { e.stopPropagation(); setAssignDropdown(assignDropdown === c.case_id ? null : c.case_id); }}
                              className="p-1.5 rounded hover:bg-[#EFEFEA] transition-colors"
                              title="Assign Officer"
                              aria-label={`Assign officer to case ${c.case_id}`}
                              aria-expanded={assignDropdown === c.case_id}
                            >
                              <UserPlus size={14} className="text-[#B45309]" />
                            </button>
                            {assignDropdown === c.case_id && (
                              <div className="absolute right-0 top-8 z-50 bg-white border border-[#D2D1CA] rounded-lg shadow-lg py-1 min-w-[120px]" onClick={e => e.stopPropagation()}>
                                {OFFICER_IDS.map(id => (
                                  <button
                                    key={id}
                                    onClick={() => handleCaseAction(c.case_id, 'assign', '', id)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-[#1A1C1F] hover:bg-[#EFEFEA]"
                                  >
                                    {id}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          )}
                          {c.current_risk !== "High" && c.current_risk !== "Resolved" && can('case.escalate') && (
                            <button
                              disabled={isDemoRoute()}
                                                            onClick={(e) => { e.stopPropagation(); handleCaseAction(c.case_id, 'escalate'); }}
                              className="p-1.5 rounded hover:bg-[#EFEFEA] transition-colors"
                              title="Escalate Risk"
                              aria-label={`Escalate risk for case ${c.case_id}`}
                            >
                              <ShieldAlert size={14} className="text-[#B91C1C]" />
                            </button>
                          )}
                          {can('case.resolve') && (
                            <button
                              disabled={isDemoRoute()}
                                                            onClick={(e) => { e.stopPropagation(); setCloseReasonModal(c.case_id); }}
                              className="p-1.5 rounded hover:bg-[#EFEFEA] transition-colors"
                              title="Close Case"
                              aria-label={`Close case ${c.case_id}`}
                            >
                              <CheckCircle size={14} className="text-[#15803D]" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectCase?.(c.case_id); }}
                            className="p-1.5 rounded hover:bg-[#EFEFEA] transition-colors"
                            title="View Prediction"
                            aria-label={`View prediction for case ${c.case_id}`}
                          >
                            <FileSearch size={14} className="text-[#5F6368]" />
                          </button>
                        </>
                      )}
                      {actionLoading === c.case_id && (
                        <span className="text-[11px] text-[#5F6368]">Saving...</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Expanded prediction details */}
      {expandedCase && expandedData[expandedCase] && (
        <div className="border-t border-[#D2D1CA] bg-[#F6F6F3] p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[#1A1C1F]">Prediction Details &mdash; {expandedCase}</h4>
            <button onClick={() => setExpandedCase(null)} className="text-[#5F6368] hover:text-[#1A1C1F]">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-white rounded-lg p-3 border border-[#D2D1CA]">
              <div className="text-[11px] text-[#5F6368] ">Primary Location</div>
              <div className="text-sm font-medium text-[#1A1C1F]">{expandedData[expandedCase].primary_location?.atm_id} &mdash; {expandedData[expandedCase].primary_location?.location_name}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-[#D2D1CA]" title={SCORE_TOOLTIP}>
              <div className="text-[11px] text-[#5F6368] ">Priority Rank</div>
              {(() => {
                const pl = expandedData[expandedCase].primary_location;
                if (!pl) return <div className="text-sm font-medium text-[#1A1C1F]">—</div>;
                const t = expandedData[expandedCase].ranked_locations?.length ?? pl.rank_total ?? pl.rank;
                return <div className="text-sm font-medium text-[#1A1C1F]">{areaPrimary(riskArea(pl.rank, t, pl.risk_area), pl.rank, t)}</div>;
              })()}
            </div>
            <div className="bg-white rounded-lg p-3 border border-[#D2D1CA]">
              <div className="text-[11px] text-[#5F6368] ">Cash-out Records</div>
              <div className="text-sm font-medium text-[#1A1C1F]">{expandedData[expandedCase].primary_location?.observed_window?.label ?? '—'}</div>
            </div>
          </div>
          {expandedData[expandedCase].ranked_locations && (
            <div className="bg-white rounded-lg border border-[#D2D1CA] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#D2D1CA] text-[#5F6368]">
                    <th scope="col" className="text-left px-3 py-2">Zone · Rank</th>
                    <th scope="col" className="text-left px-3 py-2">ATM ID</th>
                    <th scope="col" className="text-left px-3 py-2">Location</th>
                    <th scope="col" className="text-right px-3 py-2" title={SCORE_TOOLTIP}>Display</th>
                    <th scope="col" className="text-left px-3 py-2">Records</th>
                    <th scope="col" className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expandedData[expandedCase].ranked_locations.slice(0, 5).map((loc: any) => (
                    <tr key={loc.rank} className="border-b border-[#D2D1CA] last:border-0">
                      <td className="px-3 py-2 font-mono" title={SCORE_TOOLTIP}>{areaPrimary(riskArea(loc.rank, expandedData[expandedCase].ranked_locations.length, loc.risk_area), loc.rank, expandedData[expandedCase].ranked_locations.length)}</td>
                      <td className="px-3 py-2 font-mono font-medium">{loc.atm_id}</td>
                      <td className="px-3 py-2 text-[#43474C]">{loc.location_name}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium" style={{ color: riskArea(loc.rank, expandedData[expandedCase].ranked_locations.length, loc.risk_area) === 'priority' ? '#B91C1C' : riskArea(loc.rank, expandedData[expandedCase].ranked_locations.length, loc.risk_area) === 'watch' ? '#B45309' : '#5F6368' }} title={SCORE_TOOLTIP}>{loc.display_score ?? '—'}</td>
                      <td className="px-3 py-2 text-[#43474C]">{loc.observed_window?.label ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[11px] px-1 py-0.5 rounded ${loc.status === 'High' ? 'bg-[#B91C1C]/10 text-[#B91C1C]' : loc.status === 'Medium' ? 'bg-[#B45309]/10 text-[#B45309]' : 'bg-[#5F6368]/10 text-[#5F6368]'}`}>{loc.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Close reason modal */}
      {closeReasonModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40" onClick={() => setCloseReasonModal(null)}>
          <div className="bg-white rounded-xl p-5 border border-[#D2D1CA] shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[#1A1C1F]">Close Case {closeReasonModal}</h4>
              <button onClick={() => setCloseReasonModal(null)} className="text-[#5F6368] hover:text-[#1A1C1F]"><X size={14} /></button>
            </div>
            <p className="text-xs text-[#5F6368] mb-3">Provide a reason for closing this case. This will be logged to the audit trail.</p>
            <textarea
              value={closeReason}
              onChange={e => setCloseReason(e.target.value)}
              placeholder="Reason for closing..."
              className="w-full px-3 py-2 bg-white border border-[#D2D1CA] rounded-lg text-sm text-[#1A1C1F] placeholder-[#5F6368] focus:outline-none focus:border-[#17406F] resize-none"
              rows={3}
            />
            <div className="flex items-center gap-2 mt-3 justify-end">
              <button onClick={() => setCloseReasonModal(null)} className="px-3 py-1.5 text-xs bg-[#EFEFEA] text-[#5F6368] rounded-lg hover:bg-[#E2E1DB]">Cancel</button>
              <button
                onClick={() => handleCaseAction(closeReasonModal, 'close', closeReason)}
                disabled={!closeReason.trim()}
                className="px-3 py-1.5 text-xs bg-[#15803D] text-white rounded-lg hover:bg-[#14732d] disabled:opacity-50"
              >
                Close Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
