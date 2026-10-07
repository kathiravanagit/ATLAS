import { useState } from 'react';
import { Cpu, ChevronDown, ChevronUp } from 'lucide-react';
import { useApiData } from '../lib/useApiData';
import { count, featureImportances, formatMetric, isMeasured, percent, type ModelCard, type Metric } from '../lib/metrics';
import { ScoreGrid, ConfusionMatrixChart, ComparisonBars, RocChart } from './ModelMetricCharts';

type Distribution = { feature_stats?: Record<string, { mean?: Metric; std?: Metric; min?: Metric; max?: Metric }> | null };

export default function ModelCardPanel() {
  const [expanded, setExpanded] = useState(false);
  const { data: card, loading, error } = useApiData<ModelCard>('/api/model/card');
  const { data: distribution } = useApiData<Distribution>('/api/model/distribution');
  const importances = card ? featureImportances(card) : [];
  return <section className="card p-5">
    <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="w-full flex items-center justify-between gap-2">
      <span className="flex flex-wrap items-center gap-2"><Cpu size={18} /><span className="text-base font-semibold">ML Model Card</span><span className="text-xs text-gray-700 font-mono">{card?.model_version ?? 'Version unavailable'}</span></span>
      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
    {loading ? <p className="mt-3 text-sm" role="status">Loading model card…</p> : error ? <p className="mt-3 text-sm text-red-800" role="alert">Model card unavailable: {error}</p> : <>
      <p className="mt-3 text-sm text-gray-700">Synthetic benchmark — not verified operational accuracy. Fraud class ratio: {percent(card?.positive_ratio, true)}. Evaluate recall and F1 alongside class imbalance.</p>
      {expanded && <div className="mt-4 space-y-5">
        <ScoreGrid scores={card} roc={card?.roc_auc} pr={card?.pr_auc} />
        <ConfusionMatrixChart matrix={card?.confusion_matrix} />
        <ComparisonBars rows={[{ name: 'Random Forest', accuracy: card?.rf_accuracy }, { name: 'XGBoost', accuracy: card?.xgb_accuracy }]} />
        <RocChart curve={card?.roc_curve} />
        <p className="text-sm text-gray-700">Model: {card?.model_type ?? 'Unavailable'} · Ensemble: {card?.ensemble_method ?? 'Unavailable'} · Samples: {count(card?.n_samples)} · Features: {count(card?.n_features)} · Trained: {card?.training_date ?? 'Unavailable'}</p>
        <section aria-label="Feature importance"><h4 className="text-sm font-medium mb-2">Feature Importance</h4>
          {importances.length === 0 ? <p className="text-sm text-gray-700">Unavailable — feature column order is not importance.</p> : importances.slice(0, 8).map(row => <div key={row.feature} className="flex items-center gap-3 text-sm mb-2">
            <span className="w-40 text-gray-700">{row.feature.replace(/_/g, ' ')}</span>
            <div className="flex-1 h-3 bg-gray-100 rounded"><div className="h-full bg-blue-700 rounded" style={{ width: `${importances[0].importance > 0 ? row.importance / importances[0].importance * 100 : 0}%` }} /></div><span className="font-mono">{formatMetric(row.importance, 4)}</span>
          </div>)}
        </section>
        <section aria-label="Feature distribution"><h4 className="text-sm font-medium mb-2">Training Feature Distribution</h4>
          {!(card?.feature_columns?.length) && <p className="text-sm text-gray-700">Feature columns: Unavailable</p>}
          <div className="space-y-2">{card?.feature_columns?.map(feature => {
            const stat = distribution?.feature_stats?.[feature];
            return <div key={feature} className="text-sm text-gray-700 flex flex-wrap justify-between gap-2"><span>{feature}</span><span className="font-mono">Mean: {formatMetric(stat?.mean, 3)} · Std: {formatMetric(stat?.std, 3)}{isMeasured(stat?.min) && isMeasured(stat?.max) ? ` · Range: ${stat.min}–${stat.max}` : ''}</span></div>;
          })}</div>
        </section>
      </div>}
    </>}
  </section>;
}
