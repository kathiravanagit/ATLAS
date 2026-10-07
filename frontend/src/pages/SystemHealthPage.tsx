import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Activity, Database, Cpu, Clock, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DriftIndicator from '../components/DriftIndicator';
import { percent } from '../lib/metrics';
import { authFetch } from '../lib/auth';

interface HealthData {
  status: string;
  mode: string;
  version: string;
  model_loaded: boolean;
  model_accuracy: number | null;
  model_recall: number | null;
  model_f1: number | null;
  model_precision: number | null;
  model_pr_auc: number | null;
  db_healthy: boolean;
  predictions_stored: number;
  ranked_locations_stored: number;
  total_cases: number;
  top_k_accuracy: Record<string, number> | null;
}

interface DbHealth {
  status: string;
  predictions_count: number;
  ranked_locations_count: number;
  latest_prediction_id: number | null;
  latest_prediction_case: string | null;
  verdict: string;
}


function StatusBadge({ status }: { status: string }) {
  const cls = status === 'healthy' || status === 'ok' || status === 'stable'
    ? 'bg-[#15803D]/10 text-[#15803D]'
    : status === 'warning'
    ? 'bg-[#B45309]/10 text-[#B45309]'
    : 'bg-[#B91C1C]/10 text-[#B91C1C]';
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}

function MetricBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB] text-center">
      <div className="text-xs text-[#374151] uppercase mb-1">{label}</div>
      <div className="text-sm font-bold text-[#1F2937]">{value}</div>
      {sub && <div className="text-xs text-[#374151] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function SystemHealthPage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [dbHealth, setDbHealth] = useState<DbHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, d] = await Promise.all([
        authFetch('/api/health').then(r => r.ok ? r.json() : null),
        authFetch('/api/health/db-check').then(r => r.ok ? r.json() : null),
      ]);
      setHealth(h);
      setDbHealth(d);
      if (!h || !d) setError('One or more health services are unavailable; no substitute metrics are shown.');
      if (h && d) setLastRefresh(new Date());
    } catch (err) {
      setHealth(null);
      setDbHealth(null);
      setError(err instanceof Error ? err.message : 'Failed to load system health data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/real')} className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors">
            <ArrowLeft size={18} className="text-[#6B7280]" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#1F2937]">System Health</h2>
            <p className="text-sm text-[#6B7280] mt-0.5">Operational status of all ATLAS services · synthetic-data prototype</p>
          </div>
        </div>
        <button onClick={fetchAll} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#1F2937] hover:bg-[#F3F4F6] transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle size={24} className="text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-medium text-sm">{error}</p>
          <button onClick={fetchAll} className="mt-3 px-4 py-1.5 bg-red-100 text-red-700 rounded-lg text-[11px] font-medium hover:bg-red-200 transition-colors">
            Try Again
          </button>
        </div>
      )}

      {/* API Status */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-[#1D355B]" />
          <h3 className="text-base font-semibold text-[#1F2937]">API Status</h3>
          {health && <StatusBadge status={health.status} />}
        </div>
        {health ? (
          <div className="grid grid-cols-4 gap-3">
            <MetricBox label="Status" value={health.status} />
            <MetricBox label="DB Mode" value={health.mode} />
            <MetricBox label="Version" value={health.version} />
            <MetricBox label="Model Loaded" value={health.model_loaded ? 'Yes' : 'No'} />
          </div>
        ) : <div className="text-sm text-[#374151]">{loading ? 'Loading…' : 'Unavailable'}</div>}
      </div>

      {/* DB Health */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database size={16} className="text-[#1D355B]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Database Health</h3>
          {dbHealth && <StatusBadge status={dbHealth.status} />}
        </div>
        {dbHealth ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <MetricBox label="Predictions Stored" value={dbHealth.predictions_count} />
              <MetricBox label="Ranked Locations" value={dbHealth.ranked_locations_count} />
              <MetricBox label="Latest Prediction" value={dbHealth.latest_prediction_case || 'None'} />
              <MetricBox label="Verdict" value={dbHealth.verdict} />
            </div>
          </div>
        ) : <div className="text-sm text-[#374151]">{loading ? 'Loading…' : 'Unavailable'}</div>}
      </div>

      {/* Model Service */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu size={16} className="text-[#1D355B]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Model Service</h3>
        </div>
        {health ? (
          <div className="grid grid-cols-4 gap-3">
            <MetricBox label="Accuracy" value={percent(health.model_accuracy)} />
            <MetricBox label="Recall" value={percent(health.model_recall)} />
            <MetricBox label="F1 Score" value={percent(health.model_f1)} />
            <MetricBox label="Precision" value={percent(health.model_precision)} />
          </div>
        ) : <div className="text-sm text-[#374151]">{loading ? 'Loading…' : 'Unavailable'}</div>}
      </div>

      {/* Last Sync */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-[#1D355B]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Last Sync</h3>
        </div>
        <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB]">
          <div className="text-sm text-[#1F2937]">{lastRefresh ? `Last complete refresh at ${lastRefresh.toLocaleTimeString()}` : 'Last complete refresh: Unavailable'}</div>
          <div className="text-[11px] text-[#6B7280] mt-1">Auto-refreshes every 30 seconds on the dashboard</div>
        </div>
      </div>

      <DriftIndicator />
    </motion.div>
  );
}
