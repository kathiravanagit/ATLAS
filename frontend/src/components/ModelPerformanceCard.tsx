import { useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { useApiData } from '../lib/useApiData';
import { count, formatMetric, percent, type ModelMetrics } from '../lib/metrics';
import { ScoreGrid, ConfusionMatrixChart, ComparisonBars, RocChart } from './ModelMetricCharts';

export default function ModelPerformanceCard() {
  const [expanded, setExpanded] = useState(false);
  const { data: metrics, loading, error } = useApiData<ModelMetrics>('/api/model/metrics');
  return <section className="card p-5">
    <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="w-full flex items-center justify-between gap-2">
      <span className="flex flex-wrap items-center gap-2"><BarChart3 size={18} /><span className="text-base font-semibold">Model Performance</span><span className="text-sm text-gray-700">Accuracy: {percent(metrics?.ensemble?.accuracy)}</span></span>
      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
    {loading ? <p className="mt-3 text-sm" role="status">Loading model metrics…</p> : error ? <p className="mt-3 text-sm text-red-800" role="alert">Model metrics unavailable: {error}</p> : <>
      <p className="mt-3 text-sm text-gray-700">{metrics?.data_source ?? 'Synthetic benchmark metadata — not verified operational accuracy.'} Missing evaluation metrics are unavailable, not zero.</p>
      {expanded && <div className="mt-4 space-y-5">
        <ScoreGrid scores={metrics?.ensemble} roc={metrics?.roc_auc} pr={metrics?.pr_auc} />
        <ConfusionMatrixChart matrix={metrics?.ensemble?.confusion_matrix} />
        <ComparisonBars rows={[{ name: 'Ensemble (RF + XGBoost)', accuracy: metrics?.ensemble?.accuracy }, { name: 'Random Forest', accuracy: metrics?.random_forest?.accuracy }, { name: 'XGBoost', accuracy: metrics?.xgboost?.accuracy }]} />
        <RocChart curve={metrics?.roc_curve} />
        <div className="text-sm text-gray-700 grid grid-cols-2 gap-2">
          <span>Trained: {metrics?.training_date ?? 'Unavailable'}</span><span>Samples: {count(metrics?.n_samples)}</span>
          <span>Features: {count(metrics?.n_features)}</span><span>Cities: {count(metrics?.cities)}</span><span>ATMs: {count(metrics?.atms)}</span>
          <span>CV Accuracy: {percent(metrics?.cv_accuracy)} · std: {formatMetric(metrics?.cv_std, 1, '%')}</span>
        </div>
      </div>}
    </>}
  </section>;
}
