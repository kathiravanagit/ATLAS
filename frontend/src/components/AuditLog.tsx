import { AuditEntry } from '../types';
import { AlertTriangle, CheckCircle, Eye, Clock, Shield, RefreshCw, User, Search, FileText, Activity, ArrowUpRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth';


const ACTION_CONFIG: Record<string, { icon: React.ReactNode; label: string; iconBg: string; iconColor: string }> = {
  alert: {
    icon: <AlertTriangle size={14} />,
    label: "Alert",
    iconBg: "bg-[#B91C1C]/10",
    iconColor: "text-[#B91C1C]",
  },
  prediction: {
    icon: <Activity size={14} />,
    label: "Prediction",
    iconBg: "bg-[#17406F]/10",
    iconColor: "text-[#17406F]",
  },
  case: {
    icon: <FileText size={14} />,
    label: "Case",
    iconBg: "bg-[#B45309]/10",
    iconColor: "text-[#B45309]",
  },
  system: {
    icon: <Shield size={14} />,
    label: "System",
    iconBg: "bg-[#8A8D90]/10",
    iconColor: "text-[#5F6368]",
  },
  review: {
    icon: <CheckCircle size={14} />,
    label: "Review",
    iconBg: "bg-[#15803D]/10",
    iconColor: "text-[#15803D]",
  },
  search: {
    icon: <Search size={14} />,
    label: "Search",
    iconBg: "bg-[#5F6368]/10",
    iconColor: "text-[#5F6368]",
  },
};

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [actor, setActor] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
        setLogs([]);
        setError(null);
        const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (actor.trim()) params.set('actor', actor.trim());
    if (filter !== 'all') params.set('action_type', filter);
    const qs = params.toString();
    authFetch(`/api/audit${qs ? `?${qs}` : ''}`)
      .then(async r => {
        // API reachable → trust it, including an empty search result set.
        if (!r.ok) throw new Error(`Audit request failed (${r.status})`);
                const rows = await r.json() as AuditEntry[];
                if (active) setLogs(rows);
      })
      .catch(() => { if (active) setError('Audit service unavailable. No fixture audit entries are shown.'); });
    return () => { active = false; };
  }, [query, actor, filter, refreshKey]);

  const types = ['all', ...new Set(logs.map(l => l.action_type))];
  const filtered = filter === 'all' ? logs : logs.filter(l => l.action_type === filter);

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#5F6368]" />
            <h3 className="text-sm font-semibold text-[#1A1C1F]">Audit Log</h3>
            <span className="text-[11px] text-[#5F6368] bg-[#EFEFEA] px-2 py-0.5 rounded">{filtered.length} entries</span>
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-1.5 rounded-lg bg-[#EFEFEA] hover:bg-[#E2E1DB] text-[#5F6368] transition-colors"
            title="Refresh audit log"
            aria-label="Refresh audit log"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8D90]" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search action or details…"
              aria-label="Search audit log"
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D2D1CA] rounded text-sm text-[#1A1C1F] placeholder-[#8A8D90] focus:outline-none focus:border-[#17406F]"
            />
          </div>
          <div className="relative sm:w-56">
            <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8D90]" />
            <input
              type="text"
              value={actor}
              onChange={e => setActor(e.target.value)}
              placeholder="Filter by officer…"
              aria-label="Filter audit log by actor"
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D2D1CA] rounded text-sm text-[#1A1C1F] placeholder-[#8A8D90] focus:outline-none focus:border-[#17406F]"
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
                  ? 'bg-white text-[#1A1C1F] font-medium'
                  : 'bg-[#EFEFEA] text-[#5F6368] hover:text-[#1A1C1F]'
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
            <Search size={18} className="text-[#8A8D90] mx-auto mb-2" />
            <p className="text-sm text-[#5F6368]">No audit entries match the current search or filter.</p>
            {(query || actor) && (
              <button
                onClick={() => { setQuery(''); setActor(''); }}
                className="mt-2 text-[11px] text-[#17406F] hover:underline"
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
                  <span className="text-sm font-medium text-[#1A1C1F]">{entry.action}</span>
                  <span className="text-[11px] text-[#5F6368] bg-[#EFEFEA] px-1.5 py-0.5 rounded">{config.label}</span>
                  {entry.case_id && (
                    <span className="text-[11px] text-[#17406F] bg-[#17406F]/10 px-1.5 py-0.5 rounded font-mono">{entry.case_id}</span>
                  )}
                </div>
                <p className="text-sm text-[#5F6368]">{entry.details}</p>
              </div>
              <span className="text-sm text-[#5F6368] font-mono whitespace-nowrap">{entry.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
