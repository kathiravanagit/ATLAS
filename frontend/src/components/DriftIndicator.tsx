import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingDown, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { authFetch } from '@/lib/auth';

interface DriftFeature {
  feature: string;
  train_mean: number;
  live_mean: number;
  train_std: number;
  live_std: number;
  mean_shift_z: number;
  psi: number;
  status: 'stable' | 'warning' | 'critical';
}

interface DriftData {
  overall_psi: number;
  status: string;
  features: DriftFeature[];
  total_features: number;
  critical_count: number;
  warning_count: number;
}

export default function DriftIndicator() {
  const [data, setData] = useState<DriftData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    authFetch('/api/model/drift')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const statusColor = data.status === 'critical' ? '#ef4444' : data.status === 'warning' ? '#f59e0b' : '#22c55e';
  const StatusIcon = data.status === 'critical' ? AlertTriangle : data.status === 'warning' ? TrendingDown : CheckCircle;

  return (
    <div className="card p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <TrendingDown size={16} style={{ color: statusColor }} />
          <h3 className="text-base font-semibold text-white">Model Drift Monitor</h3>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono" style={{
            background: `${statusColor}15`, color: statusColor
          }}>
            PSI: {data.overall_psi}
          </span>
          <span className="text-[9px] text-[#71717a] bg-[#27272a] px-1.5 py-0.5 rounded">Synthetic baseline</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#d4d4d8]" /> : <ChevronDown size={14} className="text-[#d4d4d8]" />}
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        style={{ maxHeight: expanded ? '2000px' : '0px' }}
      >
        <div className="mt-4 space-y-3">
          {/* Overall status */}
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon size={16} style={{ color: statusColor }} />
              <div>
                <div className="text-sm text-white font-medium">Overall Drift Status</div>
                <div className="text-[10px] text-[#d4d4d8]">{data.total_features} features monitored</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              {data.critical_count > 0 && (
                <span className="text-[#ef4444] bg-[#ef4444]/10 px-2 py-0.5 rounded">{data.critical_count} critical</span>
              )}
              {data.warning_count > 0 && (
                <span className="text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded">{data.warning_count} warning</span>
              )}
              <span className="text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded">
                {data.total_features - data.critical_count - data.warning_count} stable
              </span>
            </div>
          </div>

          {/* Feature list */}
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {data.features.map((feat, i) => (
              <motion.div
                key={feat.feature}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-[#0a0a0f] rounded-lg p-2.5 border border-[#27272a] flex items-center gap-3"
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  feat.status === 'critical' ? 'bg-[#ef4444]' :
                  feat.status === 'warning' ? 'bg-[#f59e0b]' : 'bg-[#22c55e]'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white truncate">{feat.feature.replace(/_/g, ' ')}</div>
                  <div className="text-[9px] text-[#d4d4d8]">
                    Train: {feat.train_mean.toFixed(3)} | Live: {feat.live_mean.toFixed(3)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-mono text-white">PSI {feat.psi}</div>
                  <div className="text-[9px] text-[#d4d4d8]">z={feat.mean_shift_z}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
