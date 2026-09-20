import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { authFetch } from '../lib/auth';

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
  roc_auc: number;
  pr_auc: number;
  cv_accuracy: number;
  cv_std: number;
  training_date: string | null;
  n_samples: number | null;
  n_features: number | null;
  cities: number | null;
  atms: number | null;
}

export default function ModelPerformanceCard() {
  const [expanded, setExpanded] = useState(false);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);

  useEffect(() => {
    authFetch('/api/model/metrics')
      .then(r => r.ok ? r.json() : null)
      .then(data => setMetrics(data))
      .catch(() => {});
  }, []);

  if (!metrics) return null;

  const cm = metrics.ensemble.confusion_matrix;
  const total = cm.tp + cm.fp + cm.fn + cm.tn;

  return (
    <div className="card p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-[#15803D]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Model Performance</h3>
          <span className="text-[10px] text-[#15803D] bg-[#15803D]/10 px-2 py-0.5 rounded font-mono">
            {metrics.ensemble.accuracy}% Acc
          </span>
          <span className="text-[10px] text-[#1D4ED8] bg-[#1D4ED8]/10 px-2 py-0.5 rounded font-mono">
            AUC {metrics.roc_auc?.toFixed(2) || '—'}
          </span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#d4d4d8]" /> : <ChevronDown size={14} className="text-[#d4d4d8]" />}
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        style={{ maxHeight: expanded ? '2000px' : '0px' }}
      >
        <div className="mt-4 space-y-4">
          {/* Ensemble Metrics */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Accuracy', value: metrics.ensemble.accuracy, color: '#22c55e' },
              { label: 'Precision', value: metrics.ensemble.precision, color: '#3b82f6' },
              { label: 'Recall', value: metrics.ensemble.recall, color: '#f59e0b' },
              { label: 'F1 Score', value: metrics.ensemble.f1_score, color: '#8b5cf6' },
              { label: 'ROC AUC', value: (metrics.roc_auc * 100), color: '#06b6d4' },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB] text-center"
              >
                <div className="text-[10px] text-[#6B7280] uppercase mb-1">{m.label}</div>
                <div className="text-lg font-bold" style={{ color: m.color }}>{m.value.toFixed(1)}%</div>
              </motion.div>
            ))}
          </div>

          {/* Confusion Matrix */}
          <div>
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-2">Confusion Matrix (n={total.toLocaleString()})</div>
            <div className="grid grid-cols-2 gap-2 max-w-[280px]">
              <div className="bg-[#15803D]/10 rounded-lg p-3 border border-[#15803D]/30 text-center">
                <div className="text-[10px] text-[#15803D]">True Positive</div>
                <div className="text-lg font-bold text-[#15803D]">{cm.tp}</div>
              </div>
              <div className="bg-[#B91C1C]/10 rounded-lg p-3 border border-[#B91C1C]/30 text-center">
                <div className="text-[10px] text-[#B91C1C]">False Positive</div>
                <div className="text-lg font-bold text-[#B91C1C]">{cm.fp}</div>
              </div>
              <div className="bg-[#B45309]/10 rounded-lg p-3 border border-[#B45309]/30 text-center">
                <div className="text-[10px] text-[#B45309]">False Negative</div>
                <div className="text-lg font-bold text-[#B45309]">{cm.fn}</div>
              </div>
              <div className="bg-[#1D4ED8]/10 rounded-lg p-3 border border-[#1D4ED8]/30 text-center">
                <div className="text-[10px] text-[#1D4ED8]">True Negative</div>
                <div className="text-lg font-bold text-[#1D4ED8]">{cm.tn}</div>
              </div>
            </div>
          </div>

          {/* Model Comparison */}
          <div>
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-2">Model Comparison</div>
            <div className="space-y-2">
              {[
                { name: 'Ensemble (RF + XGBoost)', acc: metrics.ensemble.accuracy, color: '#15803D' },
                { name: 'Random Forest', acc: metrics.random_forest.accuracy, color: '#1D4ED8' },
                { name: 'XGBoost', acc: metrics.xgboost.accuracy, color: '#1D355B' },
              ].map((model, i) => (
                <div key={model.name} className="flex items-center gap-3">
                  <div className="w-[180px] text-xs text-[#4B5563]">{model.name}</div>
                  <div className="flex-1 h-4 bg-[#F8F9FA] rounded overflow-hidden border border-[#D1D5DB]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${model.acc}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className="h-full rounded"
                      style={{ backgroundColor: model.color + '40' }}
                    />
                  </div>
                  <div className="w-[50px] text-xs font-mono text-right" style={{ color: model.color }}>
                    {model.acc}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Training Info */}
          <div className="grid grid-cols-2 gap-3 text-[10px] text-[#6B7280] bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB]">
            <div className="space-y-1">
              {metrics.training_date && <div>Trained: <span className="text-[#1F2937]">{metrics.training_date}</span></div>}
              {metrics.n_samples && <div>Samples: <span className="text-[#1F2937]">{metrics.n_samples.toLocaleString()}</span></div>}
              {metrics.n_features && <div>Features: <span className="text-[#1F2937]">{metrics.n_features}</span></div>}
            </div>
            <div className="space-y-1">
              {metrics.cities && <div>Cities: <span className="text-[#1F2937]">{metrics.cities}</span></div>}
              {metrics.atms && <div>ATMs: <span className="text-[#1F2937]">{metrics.atms}</span></div>}
              {metrics.cv_accuracy && <div>CV Accuracy: <span className="text-[#1F2937]">{metrics.cv_accuracy}% ± {metrics.cv_std}%</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
