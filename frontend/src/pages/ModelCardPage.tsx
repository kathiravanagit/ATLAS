import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cpu, AlertTriangle } from 'lucide-react';
import { isDemoRoute } from '../lib/auth';
import { useApiData } from '../lib/useApiData';
import { count, featureImportances, formatMetric, percent, type Metric, type ModelCard } from '../lib/metrics';
import { ScoreGrid, ConfusionMatrixChart, ComparisonBars, RocChart } from '../components/ModelMetricCharts';

interface HoldoutSlice {
  slice?: string | null; n?: Metric; positives?: Metric; positive_rate_pct?: Metric;
  precision?: Metric; recall?: Metric; f1?: Metric; pr_auc?: Metric; baseline_majority_accuracy_pct?: Metric;
}
interface ThresholdRow { threshold?: Metric; precision?: Metric; recall?: Metric; f1?: Metric; flagged?: Metric }
interface ValidationProtocol {
  data?: string | null; split?: string | null; baseline_majority_accuracy?: string | null;
  calibration_status?: string | null; threshold_guidance?: string | null;
  intended_use?: string | null; prohibited_use?: string | null;
  holdout_revalidation?: {
    protocol?: string | null; ensemble?: string | null;
    slices?: { random_holdout_note?: string | null; time_holdout?: HoldoutSlice | null; location_holdout?: HoldoutSlice | null } | null;
    calibration?: { brier_score?: Metric; note?: string | null } | null;
    threshold_sweep?: ThresholdRow[] | null;
  } | null;
}
type CardResponse = ModelCard & { validation_protocol?: ValidationProtocol | null };
type Distribution = { feature_stats?: Record<string, { mean?: Metric; std?: Metric; min?: Metric; max?: Metric }> | null };

export default function ModelCardPage() {
  if (isDemoRoute()) return <section className="card p-6"><h1 className="text-xl font-semibold">Model Card</h1><p className="mt-3 text-sm">Backend model metadata is disabled in local demo. Fixture risk signals are not model inferences.</p></section>;
  return <ApiModelCardPage />;
}

function ApiModelCardPage() {
  const navigate = useNavigate();
  const { data: card, loading, error, reload } = useApiData<CardResponse>('/api/model/card');
  const { data: distribution } = useApiData<Distribution>('/api/model/distribution');
  if (loading) return <p role="status" className="p-6 text-sm">Loading model card…</p>;
  if (!card || error) return <section className="card p-6" role="alert"><h1 className="text-xl font-semibold">Model Card unavailable</h1><p className="mt-3 text-sm">{error ?? 'No model metadata returned.'} No substitute evaluation metrics are shown.</p><button onClick={reload} className="mt-3 underline text-sm">Try again</button></section>;
  const protocol = card.validation_protocol;
  const holdout = protocol?.holdout_revalidation;
  const importances = featureImportances(card);
  const maxImportance = Math.max(...importances.map(row => row.importance), 0.001);
  return <div className="space-y-6 max-w-4xl mx-auto">
    <header className="flex items-center gap-3"><button aria-label="Back to overview" onClick={() => navigate('/real')} className="p-2 rounded hover:bg-gray-100"><ArrowLeft size={18} /></button><div><h1 className="text-xl font-bold">Model Card</h1><p className="mt-1 text-sm text-gray-700">Supplied synthetic-benchmark metadata, not verified operational performance. Unavailable does not mean zero.</p></div></header>
    <section className="card p-5"><h2 className="flex items-center gap-2 text-base font-semibold mb-4"><Cpu size={18} />Model Information</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[
        ['Model Type', card.model_type ?? 'Unavailable'], ['Model Version', card.model_version ?? 'Unavailable'],
        ['Training Date', card.training_date ?? 'Unavailable'], ['Ensemble Method', card.ensemble_method ?? 'Unavailable'],
        ['Samples Trained', count(card.n_samples)], ['Features', count(card.n_features)], ['Fraud Class Ratio', percent(card.positive_ratio, true)],
      ].map(([label, value]) => <div key={label} className="rounded border border-gray-300 bg-gray-50 p-3"><div className="text-xs text-gray-700">{label}</div><div className="mt-1 text-sm font-medium break-words">{value}</div></div>)}</div>
    </section>
    <section className="card p-5"><h2 className="text-base font-semibold mb-3">Data &amp; Model Lineage</h2>
      <div className="grid grid-cols-2 gap-3 text-sm text-gray-700"><p>Dataset: {card.dataset ?? 'Unavailable'}</p><p>Cohort: {count(card.cities)} cities · {count(card.atms)} ATMs</p><p>Features: {count(card.n_features)} columns · {count(card.n_samples)} rows</p><p>Validation split: {protocol?.split ?? 'Unavailable'}</p></div>
      <p className="mt-3 text-sm text-gray-700">Feature order is not importance. Ensemble weights and validation lineage are not inferred from an artifact name.</p>
    </section>
    <section className="card p-5 space-y-4"><h2 className="text-base font-semibold">Validation Protocol &amp; Holdout Revalidation</h2>
      <div className="grid grid-cols-2 gap-3 text-sm text-gray-700"><p>Majority Baseline: {protocol?.baseline_majority_accuracy ?? 'Unavailable'}</p><p>Calibration Brier score: {formatMetric(holdout?.calibration?.brier_score, 4)}</p><p>Calibration status: {protocol?.calibration_status ?? 'Unavailable'}</p><p>Split: {protocol?.split ?? 'Unavailable'}</p><p>Intended use: {protocol?.intended_use ?? 'Unavailable'}</p></div>
      {holdout?.slices ? <div className="overflow-x-auto"><h3 className="text-sm font-medium mb-2">Holdout Revalidation — {holdout.protocol ?? 'Protocol unavailable'}</h3><table className="w-full text-sm"><thead><tr className="text-left border-b border-gray-300">{['Slice', 'n', 'Precision', 'Recall', 'F1', 'PR-AUC', 'Majority Baseline'].map(label => <th key={label} className="p-2 font-medium">{label}</th>)}</tr></thead><tbody>
        {(['time_holdout', 'location_holdout'] as const).map(key => {
          const row = holdout.slices?.[key];
          return row ? <tr key={key} className="border-b border-gray-200"><td className="p-2">{key === 'time_holdout' ? 'Time holdout' : 'Location holdout'}<span className="block text-xs text-gray-700">{row.slice}</span></td>{[count(row.n), percent(row.precision, true), percent(row.recall, true), formatMetric(row.f1, 3), formatMetric(row.pr_auc, 3), percent(row.baseline_majority_accuracy_pct)].map((value, i) => <td key={i} className="p-2 font-mono">{value}</td>)}</tr> : null;
        })}
      </tbody></table><p className="mt-2 text-sm text-gray-700">{holdout.slices.random_holdout_note}</p></div> : <p className="text-sm text-gray-700">Holdout revalidation report: Unavailable.</p>}
      {holdout?.threshold_sweep?.length ? <div className="overflow-x-auto"><h3 className="text-sm font-medium mb-2">Threshold Sweep — supplied evaluation</h3><table className="w-full text-sm"><thead><tr className="text-left border-b border-gray-300">{['Threshold', 'Precision', 'Recall', 'F1', 'Flagged'].map(label => <th key={label} className="p-2 font-medium">{label}</th>)}</tr></thead><tbody>{holdout.threshold_sweep.map((row, i) => <tr key={i} className="border-b border-gray-200">{[formatMetric(row.threshold, 2), percent(row.precision, true), percent(row.recall, true), formatMetric(row.f1, 3), count(row.flagged)].map((value, j) => <td key={j} className="p-2 font-mono">{value}</td>)}</tr>)}</tbody></table></div> : <p className="text-sm text-gray-700">Threshold sweep: Unavailable.</p>}
      <p className="text-sm text-gray-700">{protocol?.threshold_guidance}</p><p className="text-sm text-amber-900">Prohibited use: {protocol?.prohibited_use ?? 'Do not use this synthetic prototype for automated enforcement or live operational decisions.'}</p>
    </section>
    <section className="card p-5"><h2 className="text-base font-semibold mb-4">Performance Metrics</h2><ScoreGrid scores={card} roc={card.roc_auc} pr={card.pr_auc} /><p className="mt-3 text-sm text-gray-700">Cross-validation accuracy: {percent(card.cv_accuracy)} · std: {formatMetric(card.cv_std, 1, '%')}</p></section>
    <section className="card p-5"><h2 className="text-base font-semibold mb-3">Top-K Accuracy (Headline Metric)</h2><p className="text-sm text-gray-700 mb-4">Cash-out ranking hit rates require labelled evaluation locations; no hit rates are assumed.</p><div className="grid grid-cols-3 gap-3">{[
      ['Top-1 Hit Rate', percent(card.top_k_accuracy?.top_1_hit_rate, true)], ['Top-3 Hit Rate', percent(card.top_k_accuracy?.top_3_hit_rate, true)], ['Top-5 Hit Rate', percent(card.top_k_accuracy?.top_5_hit_rate, true)],
    ].map(([label, value]) => <div key={label} className="rounded border border-gray-300 bg-gray-50 p-3"><div className="text-xs text-gray-700">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>)}</div></section>
    <section className="card p-5"><ConfusionMatrixChart matrix={card.confusion_matrix} /></section>
    <section className="card p-5"><RocChart curve={card.roc_curve} /></section>
    <section className="card p-5"><h2 className="text-base font-semibold mb-4">Feature Importance</h2>{importances.length ? importances.slice(0, 8).map(row => <div key={row.feature} className="flex flex-wrap items-center gap-3 text-sm mb-3"><span className="w-40 text-gray-700">{row.feature.replace(/_/g, ' ')}</span><div className="flex-1 min-w-16 h-3 rounded bg-gray-100"><div className="h-full bg-blue-700 rounded" style={{ width: `${row.importance / maxImportance * 100}%` }} /></div><span className="font-mono">{formatMetric(row.importance, 4)}</span></div>) : <p className="text-sm text-gray-700">Unavailable — no feature importance values supplied.</p>}</section>
    <section className="card p-5"><h2 className="text-base font-semibold mb-3">Training Feature Distribution</h2>{card.feature_columns?.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b border-gray-300">{['Feature', 'Mean', 'Std', 'Min', 'Max'].map(label => <th key={label} className="p-2 font-medium">{label}</th>)}</tr></thead><tbody>{card.feature_columns.map(feature => { const stat = distribution?.feature_stats?.[feature]; return <tr key={feature} className="border-b border-gray-200"><td className="p-2">{feature}</td>{[stat?.mean, stat?.std, stat?.min, stat?.max].map((value, i) => <td key={i} className="p-2 font-mono">{formatMetric(value, 3)}</td>)}</tr>; })}</tbody></table></div> : <p className="text-sm text-gray-700">Feature columns: Unavailable.</p>}</section>
    <section className="card p-5"><h2 className="flex items-center gap-2 text-base font-semibold mb-3"><AlertTriangle size={18} />Known Limitations</h2><ul className="list-disc pl-5 space-y-2 text-sm text-gray-700"><li>Trained on synthetic data; benchmark metrics are not verified operational accuracy.</li><li>Legacy artifacts may lack trustworthy evaluation metadata. Unavailable metrics do not establish successful fraud detection.</li><li>Risk scores are not calibrated probabilities. Bias and ranking quality require evaluation, not assumed feature importance.</li></ul></section>
    <section className="card p-5"><h2 className="text-base font-semibold mb-3">Ensemble Composition</h2><p className="text-sm text-gray-700 mb-4">Reported method: {card.ensemble_method ?? 'Unavailable'} — no default weights assumed.</p><ComparisonBars rows={[{ name: 'Random Forest', accuracy: card.rf_accuracy }, { name: 'XGBoost', accuracy: card.xgb_accuracy }]} /></section>
  </div>;
}
