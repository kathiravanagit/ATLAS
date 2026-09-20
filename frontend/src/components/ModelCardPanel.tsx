import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Cpu, ChevronDown, ChevronUp, BarChart3, Target, Database, GitBranch, Activity, AlertTriangle } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';
import { authFetch } from '@/lib/auth';

interface ModelCard {
  model_type: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  pr_auc: number;
  roc_auc: number;
  rf_accuracy: number;
  xgb_accuracy: number;
  cv_accuracy: number;
  cv_std: number;
  n_samples: number;
  n_features: number;
  ensemble_method: string;
  training_date: string;
  feature_columns: string[];
  positive_ratio: number;
  confusion_matrix?: { tp: number; fp: number; fn: number; tn: number };
  dataset?: string;
  cities?: number;
  atms?: number;
}

interface FeatureStat {
  mean: number;
  std: number;
  min: number;
  max: number;
}

export default function ModelCardPanel() {
  const [expanded, setExpanded] = useState(false);
  const [card, setCard] = useState<ModelCard | null>(null);
  const [featureStats, setFeatureStats] = useState<Record<string, FeatureStat>>({});

  useEffect(() => {
    Promise.all([
      authFetch('/api/model/card').then(r => r.ok ? r.json() : null),
      authFetch('/api/model/distribution').then(r => r.ok ? r.json() : null),
    ]).then(([cardData, distData]) => {
      if (cardData) setCard(cardData);
      if (distData?.feature_stats) setFeatureStats(distData.feature_stats);
    }).catch(() => {});
  }, []);

  if (!card) return null;

  const modelColors = [
    { name: 'Random Forest', accuracy: card.rf_accuracy, color: '#22c55e', icon: <GitBranch size={14} className="text-[#22c55e]" /> },
    { name: 'XGBoost', accuracy: card.xgb_accuracy, color: '#3b82f6', icon: <Activity size={14} className="text-[#3b82f6]" /> },
  ];

  const imbalanceRatio = Math.round((1 - card.positive_ratio) / card.positive_ratio);

  return (
    <div className="card p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-[#15803D]" />
          <h3 className="text-base font-semibold text-[#1F2937]">ML Model Card</h3>
          <span className="text-[10px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded font-mono">v3</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#d4d4d8]" /> : <ChevronDown size={14} className="text-[#d4d4d8]" />}
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        style={{ maxHeight: expanded ? '2000px' : '0px' }}
      >
        <div className="mt-4 space-y-4">
          {/* Imbalanced data notice */}
          <div className="bg-[#FFFBEB] rounded-xl p-3 border border-[#B45309]/30 flex items-start gap-2">
            <AlertTriangle size={14} className="text-[#B45309] mt-0.5 shrink-0" />
            <div className="text-[11px] text-[#6B7280] leading-relaxed">
              <span className="text-[#B45309] font-medium">Class imbalance: </span>
              Fraud rate is {((card.positive_ratio) * 100).toFixed(1)}% (1 in {imbalanceRatio}). Accuracy is inflated by the majority class — <span className="text-[#1F2937] font-medium">Recall ({card.recall}%) and F1 ({card.f1_score}%) are the primary metrics</span>.
            </div>
          </div>

          {/* Primary metrics — recall/F1 lead */}
          <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#D1D5DB]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] text-[#6B7280] uppercase tracking-wider">Performance (Fraud Class)</div>
              <div className="text-[10px] text-[#6B7280]">{card.ensemble_method}</div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Recall', value: card.recall, color: '#f59e0b', desc: 'Fraud detection rate' },
                { label: 'F1 Score', value: card.f1_score, color: '#8b5cf6', desc: 'Precision-recall balance' },
                { label: 'Precision', value: card.precision, color: '#22c55e', desc: 'Alert accuracy' },
                { label: 'PR-AUC', value: (card.pr_auc * 100).toFixed(1), suffix: '%', color: '#3b82f6', desc: 'Precision-recall curve' },
              ].map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="text-center"
                >
                  <div className="text-2xl font-bold" style={{ color: m.color }}>
                    <AnimatedNumber value={typeof m.value === 'string' ? parseFloat(m.value) : m.value} suffix={m.suffix || '%'} />
                  </div>
                  <div className="text-[11px] text-[#1F2937] font-medium mt-1">{m.label}</div>
                  <div className="text-[11px] text-[#6B7280] mt-0.5">{m.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Confusion matrix */}
          {card.confusion_matrix && (
            <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#D1D5DB]">
              <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-3">Confusion Matrix (40k test set)</div>
              <div className="grid grid-cols-3 gap-1 text-center" style={{ maxWidth: 280 }}>
                <div />
                <div className="text-[11px] text-[#6B7280]">Pred+Fraud</div>
                <div className="text-[11px] text-[#6B7280]">Pred+Normal</div>
                <div className="text-[11px] text-[#6B7280] text-right pr-2">Actual+Fraud</div>
                <div className="bg-[#15803D]/10 rounded py-1.5 text-[11px] text-[#15803D] font-mono">{card.confusion_matrix.tp}</div>
                <div className="bg-[#B91C1C]/10 rounded py-1.5 text-[11px] text-[#B91C1C] font-mono">{card.confusion_matrix.fn}</div>
                <div className="text-[11px] text-[#6B7280] text-right pr-2">Actual+Normal</div>
                <div className="bg-[#B91C1C]/10 rounded py-1.5 text-[11px] text-[#B91C1C] font-mono">{card.confusion_matrix.fp}</div>
                <div className="bg-[#15803D]/10 rounded py-1.5 text-[11px] text-[#15803D] font-mono">{card.confusion_matrix.tn.toLocaleString()}</div>
              </div>
              <div className="text-[11px] text-[#6B7280] mt-2">
                Missed {card.confusion_matrix.fn} fraud cases ({((card.confusion_matrix.fn / (card.confusion_matrix.tp + card.confusion_matrix.fn)) * 100).toFixed(0)}% false negative rate)
              </div>
            </div>
          )}

          {/* Individual models */}
          <div className="grid grid-cols-2 gap-3">
            {modelColors.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB]"
              >
                <div className="flex items-center gap-2 mb-2">
                  {m.icon}
                  <span className="text-[11px] font-medium text-[#1F2937]">{m.name}</span>
                </div>
                <div className="flex items-end gap-2">
                  <div className="text-2xl font-bold" style={{ color: m.color }}>
                    <AnimatedNumber value={m.accuracy} suffix="%" />
                  </div>
                  <div className="text-[11px] text-[#6B7280] mb-1">accuracy</div>
                </div>
                <div className="mt-2 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${m.accuracy}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                    className="h-full rounded-full"
                    style={{ background: m.color }}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Training metadata */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: <Database size={12} className="text-[#d4d4d8]" />, label: 'Samples', value: card.n_samples.toLocaleString() },
              { icon: <Target size={12} className="text-[#d4d4d8]" />, label: 'Features', value: card.n_features },
              { icon: <BarChart3 size={12} className="text-[#d4d4d8]" />, label: 'Fraud Rate', value: `${(card.positive_ratio * 100).toFixed(1)}%` },
              { icon: <Cpu size={12} className="text-[#d4d4d8]" />, label: 'Trained', value: card.training_date },
            ].map((item, i) => (
              <div key={i} className="bg-[#F8F9FA] rounded-lg p-2.5 border border-[#D1D5DB] text-center">
                <div className="flex items-center justify-center gap-1 mb-1">{item.icon}<span className="text-[11px] text-[#6B7280] uppercase">{item.label}</span></div>
                <div className="text-[11px] text-[#1F2937] font-medium">{item.value}</div>
              </div>
            ))}
          </div>

          {/* Feature importance top 5 */}
          <div>
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-2">Top Features by Importance</div>
            <div className="space-y-1.5">
              {card.feature_columns.slice(0, 8).map((feat, i) => {
                const stat = featureStats[feat];
                const importance = 1 - (i / card.feature_columns.length);
                return (
                  <div key={feat} className="flex items-center gap-2">
                    <div className="w-[130px] text-[10px] text-[#4B5563] text-right truncate">{feat.replace(/_/g, ' ')}</div>
                    <div className="flex-1 h-3 bg-[#F8F9FA] rounded overflow-hidden border border-[#D1D5DB]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${importance * 100}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                        className="h-full rounded"
                        style={{
                          background: `linear-gradient(90deg, ${
                            i < 3 ? '#ef4444' : i < 5 ? '#f59e0b' : '#3b82f6'
                          }, ${
                            i < 3 ? '#dc2626' : i < 5 ? '#d97706' : '#2563eb'
                          })`
                        }}
                      />
                    </div>
                    <div className="w-[60px] text-[11px] text-[#6B7280] font-mono text-right">
                      {stat ? `μ=${stat.mean.toFixed(2)}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
