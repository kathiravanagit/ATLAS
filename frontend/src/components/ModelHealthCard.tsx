import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { useApiData } from '../lib/useApiData';
import { count, type ModelMetrics } from '../lib/metrics';
import { ScoreGrid, ConfusionMatrixChart, ComparisonBars } from './ModelMetricCharts';

export default function ModelHealthCard() {
  const [expanded, setExpanded] = useState(false);
  const { data: metrics, loading, error } = useApiData<ModelMetrics>('/api/model/metrics');
  return <section className="card p-5">
    <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="w-full flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-base font-semibold"><Activity size={18} />Model Monitoring</span>
      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
    {loading ? <p className="mt-3 text-sm" role="status">Loading monitoring metadata…</p> : error ? <p className="mt-3 text-sm text-red-800" role="alert">Monitoring metadata unavailable: {error}</p> : <>
      <p className="mt-3 text-sm text-gray-700">Evaluation metadata, not live operational monitoring. Unknown metrics are unavailable.</p>
      {expanded && <div className="mt-4 space-y-5">
        <ScoreGrid scores={metrics?.ensemble} roc={metrics?.roc_auc} pr={metrics?.pr_auc} />
        <ConfusionMatrixChart matrix={metrics?.ensemble?.confusion_matrix} />
        <ComparisonBars rows={[{ name: 'Random Forest', accuracy: metrics?.random_forest?.accuracy }, { name: 'XGBoost', accuracy: metrics?.xgboost?.accuracy }]} />
        <div className="grid grid-cols-2 gap-4">{[['Random Forest', metrics?.random_forest], ['XGBoost', metrics?.xgboost]].map(([name, scores]) => <section key={String(name)}><h4 className="text-sm font-medium mb-2">{String(name)}</h4><ScoreGrid scores={typeof scores === 'object' ? scores : undefined} /></section>)}</div>
        <p className="text-sm text-gray-700">Trained: {metrics?.training_date ?? 'Unavailable'} · Samples: {count(metrics?.n_samples)} · Features: {count(metrics?.n_features)}</p>
      </div>}
    </>}
  </section>;
}
