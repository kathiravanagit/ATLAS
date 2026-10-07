import { useState } from 'react';
import { TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useApiData } from '../lib/useApiData';
import { count, formatMetric, type Metric } from '../lib/metrics';

export interface DriftData {
  data_source?: string | null; metric_method?: string | null; verified?: boolean;
  overall_heuristic_score?: Metric; status?: string | null;
  features?: { feature: string; train_mean?: Metric; live_mean?: Metric; train_std?: Metric; live_std?: Metric; mean_shift_z?: Metric; heuristic_score?: Metric; status?: string | null }[] | null;
  total_features?: Metric; critical_count?: Metric; warning_count?: Metric;
}

export default function DriftIndicator() {
  const [expanded, setExpanded] = useState(false);
  const { data, loading, error } = useApiData<DriftData>('/api/model/drift');
  return <section className="card p-5">
    <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="w-full flex flex-wrap items-center justify-between gap-2"><span className="flex flex-wrap items-center gap-2"><TrendingDown size={18} /><span className="text-base font-semibold">Model Drift Monitor</span><span className="text-sm text-gray-700">Heuristic: {formatMetric(data?.overall_heuristic_score, 4)}</span></span>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
    {loading ? <p className="mt-3 text-sm" role="status">Loading drift metadata…</p> : error ? <p className="mt-3 text-sm text-red-800" role="alert">Drift metadata unavailable: {error}</p> : <>
      <p className="mt-3 text-sm text-gray-700">{data?.data_source ?? 'Distribution provenance unavailable.'} {data?.metric_method ?? 'Metric method unavailable.'} {data?.verified === true ? 'Service reports verified inputs.' : 'Not measured live drift; simulated heuristic only.'}</p>
      {expanded && <div className="mt-4 space-y-3">
        <p className="text-sm">Reported status: {data?.status ?? 'Unavailable'} · Features: {count(data?.total_features)} · Critical: {count(data?.critical_count)} · Warning: {count(data?.warning_count)}</p>
        {!data?.features?.length && <p className="text-sm text-gray-700">Feature drift details: Unavailable</p>}
        {data?.features?.map(feature => <div key={feature.feature} className="rounded border border-gray-300 bg-gray-50 p-3 text-sm flex flex-wrap justify-between gap-2"><span>{feature.feature.replace(/_/g, ' ')} · {feature.status ?? 'Unavailable'}<span className="block text-gray-700">Training mean: {formatMetric(feature.train_mean, 3)} · Simulated mean: {formatMetric(feature.live_mean, 3)}</span></span><span className="text-gray-700 font-mono">Heuristic {formatMetric(feature.heuristic_score, 4)} · z={formatMetric(feature.mean_shift_z, 2)}</span></div>)}
      </div>}
    </>}
  </section>;
}
