import { Case } from '../types';
import { Eye, CheckCircle, Circle, AlertTriangle, Search, ChevronDown, ChevronUp, UserPlus, ShieldAlert, FileSearch, X, FolderOpen } from 'lucide-react';
import { useState, useMemo } from 'react';
import { authFetch } from '../lib/auth';
import { can } from '../lib/roles';

interface CasesTableProps {
  cases: Case[];
  onSelectCase?: (caseId: string) => void;
  onResolveCase?: (caseId: string) => void;
  onCaseUpdated?: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: "New", color: "bg-[#1D4ED8]/10 text-[#1D4ED8]", icon: <Circle size={10} /> },
  investigating: { label: "Investigating", color: "bg-[#B45309]/10 text-[#B45309]", icon: <AlertTriangle size={10} /> },
  resolved: { label: "Resolved", color: "bg-[#15803D]/10 text-[#15803D]", icon: <CheckCircle size={10} /> },
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
    return matchesSearch && matchesStatus && matchesCrime;
  }), [cases, search, statusFilter, crimeFilter]);

  const crimeCounts = useMemo(() => cases.reduce((acc, c) => {
    acc[c.crime_type] = (acc[c.crime_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [cases]);

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
      <div className="p-4 border-b border-[#D1D5DB]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg text-[#1F2937]">Case Registry</h3>
            <p className="text-base text-[#6B7280] mt-0.5">
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
                  ? "bg-[#1D4ED8]/10 border-[#1D4ED8]/30 text-[#1D4ED8]"
                  : "border-[#D1D5DB] text-[#6B7280] hover:text-[#1F2937] hover:border-[#9CA3AF]"
              }`}
            >
              {cat}
              {cat !== "All" && crimeCounts[cat] && (
                <span className="ml-1 opacity-60">({crimeCounts[cat]})</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Case ID, Crime Type, or Victim..."
              className="w-full pl-7 pr-2 py-1.5 bg-white border border-[#D1D5DB] rounded-lg text-base text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#1D4ED8]"
            />
          </div>
          <div className="flex items-center gap-1 bg-[#F3F4F6] border border-[#D1D5DB] rounded-lg p-0.5">
            {["all", "new", "investigating", "resolved"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  statusFilter === s
                    ? "bg-white text-[#1F2937] shadow-sm"
                    : "text-[#6B7280] hover:text-[#1F2937]"
                }`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto sticky-table-container" style={{ maxHeight: 600 }}>
        <table className="w-full text-lg">
          <thead>
            <tr className="text-xs text-[#6B7280] uppercase border-b border-[#D1D5DB]">
              <th scope="col" className="text-left px-4 py-2 font-medium">Case ID</th>
              <th scope="col" className="text-left px-4 py-2 font-medium">Crime Type</th>
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
                <td colSpan={8} className="px-4 py-8 text-center">
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-3">
                      <FolderOpen size={20} className="text-[#9CA3AF]" />
                    </div>
                    <p className="text-[#4B5563] font-medium text-sm">No cases found</p>
                    <p className="text-[#9CA3AF] text-[11px] mt-1">Try adjusting your filters or search terms</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.case_id}
                  className={`border-b border-[#D1D5DB] last:border-0 hover:bg-[#EFF6FF] transition-colors duration-150 cursor-pointer ${
                    c.status === 'resolved' ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-base font-mono font-medium text-[#1F2937]">
                      <button onClick={() => toggleExpand(c.case_id)} className="flex items-center gap-1 hover:text-[#1D4ED8]">
                        <span className={`transition-transform duration-200 inline-block ${expandedCase === c.case_id ? 'rotate-180' : ''}`}>
                          <ChevronDown size={12} />
                        </span>
                        {c.case_id}
                      </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#4B5563]">
                      {c.crime_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-base text-[#4B5563]">{c.victim_name || '—'}</td>
                  <td className="px-4 py-3 text-base font-medium text-[#1F2937]">₹{c.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-base text-center text-[#4B5563]">{c.linked_accounts}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      c.current_risk === "High" ? "bg-[#B91C1C]/10 text-[#B91C1C]" :
                      c.current_risk === "Medium" ? "bg-[#B45309]/10 text-[#B45309]" :
                      c.current_risk === "Low" ? "bg-[#9CA3AF]/10 text-[#6B7280]" :
                      c.current_risk === "Resolved" ? "bg-[#15803D]/10 text-[#15803D]" :
                      "bg-[#F3F4F6] text-[#6B7280]"
                    }`}>
                      {c.current_risk}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-1 w-fit ${statusConfig[c.status]?.color || "bg-[#F3F4F6] text-[#6B7280]"}`}>
                      {statusConfig[c.status]?.icon} {statusConfig[c.status]?.label || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 relative">
                      {c.status !== 'resolved' && actionLoading !== c.case_id && (
                        <>
                          {c.status === 'new' && can('case.acknowledge') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCaseAction(c.case_id, 'acknowledge'); }}
                              className="p-1.5 rounded hover:bg-[#F3F4F6] transition-colors"
                              title="Acknowledge"
                              aria-label={`Acknowledge case ${c.case_id}`}
                            >
                              <Eye size={14} className="text-[#1D4ED8]" />
                            </button>
                          )}
                          {can('case.assign') && (
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setAssignDropdown(assignDropdown === c.case_id ? null : c.case_id); }}
                              className="p-1.5 rounded hover:bg-[#F3F4F6] transition-colors"
                              title="Assign Officer"
                              aria-label={`Assign officer to case ${c.case_id}`}
                              aria-expanded={assignDropdown === c.case_id}
                            >
                              <UserPlus size={14} className="text-[#B45309]" />
                            </button>
                            {assignDropdown === c.case_id && (
                              <div className="absolute right-0 top-8 z-50 bg-white border border-[#D1D5DB] rounded-lg shadow-lg py-1 min-w-[120px]" onClick={e => e.stopPropagation()}>
                                {OFFICER_IDS.map(id => (
                                  <button
                                    key={id}
                                    onClick={() => handleCaseAction(c.case_id, 'assign', '', id)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-[#1F2937] hover:bg-[#F3F4F6]"
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
                              onClick={(e) => { e.stopPropagation(); handleCaseAction(c.case_id, 'escalate'); }}
                              className="p-1.5 rounded hover:bg-[#F3F4F6] transition-colors"
                              title="Escalate Risk"
                              aria-label={`Escalate risk for case ${c.case_id}`}
                            >
                              <ShieldAlert size={14} className="text-[#B91C1C]" />
                            </button>
                          )}
                          {can('case.resolve') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setCloseReasonModal(c.case_id); }}
                              className="p-1.5 rounded hover:bg-[#F3F4F6] transition-colors"
                              title="Close Case"
                              aria-label={`Close case ${c.case_id}`}
                            >
                              <CheckCircle size={14} className="text-[#15803D]" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectCase?.(c.case_id); }}
                            className="p-1.5 rounded hover:bg-[#F3F4F6] transition-colors"
                            title="View Prediction"
                            aria-label={`View prediction for case ${c.case_id}`}
                          >
                            <FileSearch size={14} className="text-[#6B7280]" />
                          </button>
                        </>
                      )}
                      {actionLoading === c.case_id && (
                        <span className="text-[11px] text-[#6B7280]">Saving...</span>
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
        <div className="border-t border-[#D1D5DB] bg-[#F8F9FA] p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[#1F2937]">Prediction Details &mdash; {expandedCase}</h4>
            <button onClick={() => setExpandedCase(null)} className="text-[#6B7280] hover:text-[#1F2937]">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-white rounded-lg p-3 border border-[#D1D5DB]">
              <div className="text-[11px] text-[#6B7280] uppercase">Primary Location</div>
              <div className="text-sm font-medium text-[#1F2937]">{expandedData[expandedCase].primary_location?.atm_id} &mdash; {expandedData[expandedCase].primary_location?.location_name}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-[#D1D5DB]">
              <div className="text-[11px] text-[#6B7280] uppercase">Risk Score</div>
              <div className="text-sm font-medium text-[#B91C1C]">{expandedData[expandedCase].primary_location?.risk_score}%</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-[#D1D5DB]">
              <div className="text-[11px] text-[#6B7280] uppercase">Time Window</div>
              <div className="text-sm font-medium text-[#1F2937]">{expandedData[expandedCase].primary_location?.expected_window}</div>
            </div>
          </div>
          {expandedData[expandedCase].ranked_locations && (
            <div className="bg-white rounded-lg border border-[#D1D5DB] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#D1D5DB] text-[#6B7280]">
                    <th scope="col" className="text-left px-3 py-2">Rank</th>
                    <th scope="col" className="text-left px-3 py-2">ATM ID</th>
                    <th scope="col" className="text-left px-3 py-2">Location</th>
                    <th scope="col" className="text-right px-3 py-2">Risk Score</th>
                    <th scope="col" className="text-left px-3 py-2">Window</th>
                    <th scope="col" className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expandedData[expandedCase].ranked_locations.slice(0, 5).map((loc: any) => (
                    <tr key={loc.rank} className="border-b border-[#D1D5DB] last:border-0">
                      <td className="px-3 py-2 font-mono">#{loc.rank}</td>
                      <td className="px-3 py-2 font-mono font-medium">{loc.atm_id}</td>
                      <td className="px-3 py-2 text-[#4B5563]">{loc.location_name}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium" style={{ color: loc.risk_score > 70 ? '#B91C1C' : loc.risk_score > 45 ? '#B45309' : '#6B7280' }}>{loc.risk_score}%</td>
                      <td className="px-3 py-2 text-[#4B5563]">{loc.expected_window}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[11px] px-1 py-0.5 rounded ${loc.status === 'High' ? 'bg-[#B91C1C]/10 text-[#B91C1C]' : loc.status === 'Medium' ? 'bg-[#B45309]/10 text-[#B45309]' : 'bg-[#6B7280]/10 text-[#6B7280]'}`}>{loc.status}</span>
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
          <div className="bg-white rounded-xl p-5 border border-[#D1D5DB] shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[#1F2937]">Close Case {closeReasonModal}</h4>
              <button onClick={() => setCloseReasonModal(null)} className="text-[#6B7280] hover:text-[#1F2937]"><X size={14} /></button>
            </div>
            <p className="text-xs text-[#6B7280] mb-3">Provide a reason for closing this case. This will be logged to the audit trail.</p>
            <textarea
              value={closeReason}
              onChange={e => setCloseReason(e.target.value)}
              placeholder="Reason for closing..."
              className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#1D4ED8] resize-none"
              rows={3}
            />
            <div className="flex items-center gap-2 mt-3 justify-end">
              <button onClick={() => setCloseReasonModal(null)} className="px-3 py-1.5 text-xs bg-[#F3F4F6] text-[#6B7280] rounded-lg hover:bg-[#E5E7EB]">Cancel</button>
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
