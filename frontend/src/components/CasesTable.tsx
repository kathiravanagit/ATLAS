import { Case } from '../types';
import { Eye, CheckCircle, Circle, AlertTriangle, Search } from 'lucide-react';
import { useState, useMemo } from 'react';

interface CasesTableProps {
  cases: Case[];
  onSelectCase?: (caseId: string) => void;
  onResolveCase?: (caseId: string) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: "New", color: "bg-[#3b82f6]/10 text-[#3b82f6]", icon: <Circle size={10} /> },
  investigating: { label: "Investigating", color: "bg-[#f59e0b]/10 text-[#f59e0b]", icon: <AlertTriangle size={10} /> },
  resolved: { label: "Resolved", color: "bg-[#22c55e]/10 text-[#22c55e]", icon: <CheckCircle size={10} /> },
};

const CRIME_CATEGORIES = [
  "All", "UPI Fraud", "Card Cloning", "Phishing", "Investment Fraud",
  "Identity Theft", "SIM Swap", "QR Code Fraud", "Loan App Fraud", "Card Skimming"
];

export default function CasesTable({ cases, onSelectCase, onResolveCase }: CasesTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [crimeFilter, setCrimeFilter] = useState<string>("All");
  const [confirmResolve, setConfirmResolve] = useState<string | null>(null);

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

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-[#27272a]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg text-white">Case Registry</h3>
            <p className="text-base text-[#d4d4d8] mt-0.5">
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
                  ? "bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]"
                  : "border-[#27272a] text-[#d4d4d8] hover:text-white hover:border-[#71717a]"
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
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#d4d4d8]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Case ID, Crime Type, or Victim..."
              className="w-full pl-7 pr-2 py-1.5 bg-[#0a0a0f] border border-[#27272a] rounded-lg text-base text-white placeholder-[#d4d4d8] focus:outline-none focus:border-[#71717a]"
            />
          </div>
          <div className="flex items-center gap-1 bg-[#0a0a0f] border border-[#27272a] rounded-lg p-0.5">
            {["all", "new", "investigating", "resolved"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  statusFilter === s
                    ? "bg-[#27272a] text-white"
                    : "text-[#d4d4d8] hover:text-white"
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
            <tr className="text-xs text-[#d4d4d8] uppercase border-b border-[#27272a]">
              <th className="text-left px-4 py-2 font-medium">Case ID</th>
              <th className="text-left px-4 py-2 font-medium">Crime Type</th>
              <th className="text-left px-4 py-2 font-medium">Victim</th>
              <th className="text-left px-4 py-2 font-medium">Amount</th>
              <th className="text-center px-4 py-2 font-medium">Accounts</th>
              <th className="text-left px-4 py-2 font-medium">Risk Level</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-center px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <div className="text-[#d4d4d8] text-base">No cases found matching filters</div>
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.case_id}
                  onClick={() => onSelectCase?.(c.case_id)}
                  className={`border-b border-[#27272a] last:border-0 hover:bg-[#18181b] transition-colors cursor-pointer ${
                    c.status === 'resolved' ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-base font-mono font-medium text-white">{c.case_id}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[#27272a] text-[#e4e4e7]">
                      {c.crime_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-base text-[#e4e4e7]">{c.victim_name || '—'}</td>
                  <td className="px-4 py-3 text-base font-medium text-white">₹{c.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-base text-center text-[#e4e4e7]">{c.linked_accounts}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      c.current_risk === "High" ? "bg-[#ef4444]/10 text-[#ef4444]" :
                      c.current_risk === "Medium" ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                      c.current_risk === "Low" ? "bg-[#d4d4d8]/10 text-[#d4d4d8]" :
                      c.current_risk === "Resolved" ? "bg-[#22c55e]/10 text-[#22c55e]" :
                      "bg-[#27272a] text-[#d4d4d8]"
                    }`}>
                      {c.current_risk}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-1 w-fit ${statusConfig[c.status]?.color || "bg-[#27272a] text-[#d4d4d8]"}`}>
                      {statusConfig[c.status]?.icon} {statusConfig[c.status]?.label || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {c.status !== 'resolved' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectCase?.(c.case_id); }}
                            className="p-1.5 rounded hover:bg-[#27272a] transition-colors"
                            title="View Prediction"
                          >
                            <Eye size={14} className="text-[#d4d4d8]" />
                          </button>
                          {confirmResolve === c.case_id ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => { onResolveCase?.(c.case_id); setConfirmResolve(null); }}
                                className="px-1.5 py-0.5 text-[9px] bg-[#22c55e] text-white rounded"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmResolve(null)}
                                className="px-1.5 py-0.5 text-[9px] bg-[#27272a] text-[#d4d4d8] rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmResolve(c.case_id); }}
                              className="p-1.5 rounded hover:bg-[#27272a] transition-colors"
                              title="Mark Resolved"
                            >
                              <CheckCircle size={14} className="text-[#22c55e]" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
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
