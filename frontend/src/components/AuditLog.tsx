import { AuditEntry } from '../types';
import { AlertTriangle, CheckCircle, Eye, Clock, Shield, RefreshCw, User, Search, FileText, Activity, ArrowUpRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth';

const FALLBACK_AUDIT: AuditEntry[] = [
  { time: "14:32:15", action: "Alert Generated", details: "ALT-001 created for case CC-2026-0147", action_type: "alert" },
  { time: "14:30:08", action: "Prediction Updated", details: "ATM-027 risk score increased to 92%", action_type: "prediction" },
  { time: "14:28:42", action: "Case Viewed", details: "Inspector viewed prediction for CC-2026-0147", action_type: "case" },
  { time: "14:25:11", action: "Login", details: "Inspector authenticated via RBAC", action_type: "system" },
  { time: "14:20:33", action: "Data Refresh", details: "Synthetic dataset reloaded for prediction engine", action_type: "system" },
  { time: "14:17:22", action: "Alert Generated", details: "ALT-002 created for case CC-2026-0139", action_type: "alert" },
  { time: "14:12:45", action: "Alert Acknowledged", details: "ALT-003 acknowledged by Inspector", action_type: "alert" },
  { time: "14:02:11", action: "Alert Acknowledged", details: "ALT-004 acknowledged by Inspector", action_type: "alert" },
  { time: "13:57:08", action: "Alert Generated", details: "ALT-003 created for case CC-2026-0142", action_type: "alert" },
  { time: "13:45:30", action: "Prediction Updated", details: "ATM-027 risk score increased from 85% to 92%", action_type: "prediction" },
  { time: "13:30:00", action: "Case Created", details: "Case CC-2026-0147 registered via cybercrime.gov.in", action_type: "case" },
];

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; label: string; iconBg: string; iconColor: string }> = {
  alert: {
    icon: <AlertTriangle size={14} />,
    label: "Alert",
    iconBg: "bg-[#ef4444]/10",
    iconColor: "text-[#ef4444]",
  },
  prediction: {
    icon: <Activity size={14} />,
    label: "Prediction",
    iconBg: "bg-[#3b82f6]/10",
    iconColor: "text-[#3b82f6]",
  },
  case: {
    icon: <FileText size={14} />,
    label: "Case",
    iconBg: "bg-[#f59e0b]/10",
    iconColor: "text-[#f59e0b]",
  },
  system: {
    icon: <Shield size={14} />,
    label: "System",
    iconBg: "bg-[#d4d4d8]/10",
    iconColor: "text-[#6B7280]",
  },
  review: {
    icon: <CheckCircle size={14} />,
    label: "Review",
    iconBg: "bg-[#22c55e]/10",
    iconColor: "text-[#22c55e]",
  },
  search: {
    icon: <Search size={14} />,
    label: "Search",
    iconBg: "bg-[#8b5cf6]/10",
    iconColor: "text-[#8b5cf6]",
  },
};

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>(FALLBACK_AUDIT);
  const [filter, setFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [actor, setActor] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (actor.trim()) params.set('actor', actor.trim());
    if (filter !== 'all') params.set('action_type', filter);
    const qs = params.toString();
    authFetch(`/api/audit${qs ? `?${qs}` : ''}`)
      .then(async r => {
        // API reachable → trust it, including an empty search result set.
        if (r.ok) setLogs(await r.json() as AuditEntry[]);
      })
      .catch(() => {});
  }, [query, actor, filter, refreshKey]);

  const types = ['all', ...new Set(logs.map(l => l.action_type))];
  const filtered = filter === 'all' ? logs : logs.filter(l => l.action_type === filter);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#6B7280]" />
            <h3 className="text-base font-semibold text-[#1F2937]">Audit Log</h3>
            <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">{filtered.length} entries</span>
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-1.5 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#6B7280] transition-colors"
            title="Refresh audit log"
            aria-label="Refresh audit log"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search action or details…"
              aria-label="Search audit log"
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D1D5DB] rounded text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1D4ED8]"
            />
          </div>
          <div className="relative sm:w-56">
            <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={actor}
              onChange={e => setActor(e.target.value)}
              placeholder="Filter by officer…"
              aria-label="Filter audit log by actor"
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D1D5DB] rounded text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1D4ED8]"
            />
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {types.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                filter === t
                  ? 'bg-white text-[#1F2937] font-medium'
                  : 'bg-[#F3F4F6] text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card p-6 text-center">
            <Search size={18} className="text-[#9CA3AF] mx-auto mb-2" />
            <p className="text-sm text-[#6B7280]">No audit entries match the current search or filter.</p>
            {(query || actor) && (
              <button
                onClick={() => { setQuery(''); setActor(''); }}
                className="mt-2 text-[11px] text-[#1D4ED8] hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        )}
        {filtered.map((entry, i) => {
          const config = ACTION_CONFIG[entry.action_type] || ACTION_CONFIG.system;
          return (
            <div key={i} className="card p-4 flex items-start gap-3">
              <div className={`p-2 rounded-lg ${config.iconBg} ${config.iconColor}`}>
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-base font-medium text-[#1F2937]">{entry.action}</span>
                  <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{config.label}</span>
                  {entry.case_id && (
                    <span className="text-[11px] text-[#1D4ED8] bg-[#1D4ED8]/10 px-1.5 py-0.5 rounded font-mono">{entry.case_id}</span>
                  )}
                </div>
                <p className="text-sm text-[#6B7280]">{entry.details}</p>
              </div>
              <span className="text-sm text-[#6B7280] font-mono whitespace-nowrap">{entry.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
