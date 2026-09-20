import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, Target, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';
import { authFetch } from '@/lib/auth';

interface ModelMetrics {
  ensemble: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    confusion_matrix: { tp: number; fp: number; fn: number; tn: number };
  };
  random_forest: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
  xgboost: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
  training_date: string;
  n_samples: number;
  n_features: number;
}

export default function ModelHealthCard() {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    authFetch('/api/model/metrics')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMetrics(d); })
      .catch(() => {});
  }, []);

  if (!metrics) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-[#15803D]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Model Monitoring</h3>
          <span className="text-[10px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded font-mono">v3</span>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-[#F3F4F6] rounded animate-pulse w-1/3"></div>
          <div className="h-8 bg-[#F3F4F6] rounded animate-pulse w-1/2"></div>
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-[#F3F4F6] rounded animate-pulse"></div>)}
          </div>
        </div>
      </div>
    );
  }

  const cm = metrics.ensemble.confusion_matrix;
  const total = cm.tp + cm.fp + cm.fn + cm.tn;

  return (
    <div className="card p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[#15803D]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Model Monitoring</h3>
          <span className="text-[10px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded font-mono">v3</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#6B7280]" /> : <ChevronDown size={14} className="text-[#6B7280]" />}
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        style={{ maxHeight: expanded ? '2000px' : '0px' }}
      >
        <div className="mt-4 space-y-4">
          {/* Ensemble metrics */}
          <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#D1D5DB]">
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-3">Ensemble Performance</div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Accuracy', value: metrics.ensemble.accuracy, color: '#22c55e' },
                { label: 'Precision', value: metrics.ensemble.precision, color: '#3b82f6' },
                { label: 'Recall', value: metrics.ensemble.recall, color: '#f59e0b' },
                { label: 'F1 Score', value: metrics.ensemble.f1_score, color: '#8b5cf6' },
              ].map((m, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl font-bold" style={{ color: m.color }}>
                    <AnimatedNumber value={m.value} suffix="%" />
                  </div>
                  <div className="text-[10px] text-[#6B7280] mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Confusion Matrix */}
          <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB]">
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-2">Confusion Matrix</div>
            <div className="grid grid-cols-2 gap-1 w-[180px]">
              <div className="bg-[#15803D]/10 border border-[#15803D]/20 rounded p-2 text-center">
                <div className="text-lg font-bold text-[#15803D]">{cm.tp}</div>
                <div className="text-[11px] text-[#6B7280]">TP</div>
              </div>
              <div className="bg-[#B91C1C]/10 border border-[#B91C1C]/20 rounded p-2 text-center">
                <div className="text-lg font-bold text-[#B91C1C]">{cm.fp}</div>
                <div className="text-[11px] text-[#6B7280]">FP</div>
              </div>
              <div className="bg-[#B45309]/10 border border-[#B45309]/20 rounded p-2 text-center">
                <div className="text-lg font-bold text-[#B45309]">{cm.fn}</div>
                <div className="text-[11px] text-[#6B7280]">FN</div>
              </div>
              <div className="bg-[#1D4ED8]/10 border border-[#1D4ED8]/20 rounded p-2 text-center">
                <div className="text-lg font-bold text-[#1D4ED8]">{cm.tn}</div>
                <div className="text-[11px] text-[#6B7280]">TN</div>
              </div>
            </div>
          </div>

          {/* Model comparison */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: 'Random Forest', data: metrics.random_forest, color: '#22c55e' },
              { name: 'XGBoost', data: metrics.xgboost, color: '#3b82f6' },
            ].map((m, i) => (
              <div key={i} className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                  <span className="text-[11px] font-medium text-[#1F2937]">{m.name}</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Accuracy', val: m.data.accuracy },
                    { label: 'Precision', val: m.data.precision },
                    { label: 'Recall', val: m.data.recall },
                    { label: 'F1', val: m.data.f1_score },
                  ].map((item, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className="w-[55px] text-[11px] text-[#6B7280] text-right">{item.label}</div>
                      <div className="flex-1 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.val}%` }}
                          transition={{ duration: 0.6, delay: j * 0.08 }}
                          className="h-full rounded-full"
                          style={{ background: m.color }}
                        />
                      </div>
                      <div className="w-[32px] text-[10px] text-[#1F2937] font-mono text-right">{item.val}%</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Training info */}
          <div className="flex items-center gap-4 text-[10px] text-[#6B7280]">
            <span>Trained: {metrics.training_date}</span>
            <span>Samples: {metrics.n_samples?.toLocaleString()}</span>
            <span>Features: {metrics.n_features}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
