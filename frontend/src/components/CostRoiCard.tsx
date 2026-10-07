import { useState } from 'react';
import { DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { count, formatMetric, isMeasured, percent, type Metric } from '../lib/metrics';

export interface ImpactMetrics {
  cost_per_atm?: Metric; annual_savings?: Metric; roi?: Metric;
  prevention_rate?: Metric; funds_recovered?: Metric; response_minutes?: Metric;
  resolved_cases?: Metric; lead_time_hours?: Metric;
  cost_breakdown?: { item: string; cost: Metric }[] | null;
  scaling?: { scale: string; cost: Metric; savings: Metric; roi: Metric }[] | null;
}
const currency = (value: Metric) => isMeasured(value) ? `₹${count(value)}` : 'Not measured';

export default function CostRoiCard({ metrics }: { metrics?: ImpactMetrics | null }) {
  const [expanded, setExpanded] = useState(false);
  const rows = [
    ['Cost / ATM / year', currency(metrics?.cost_per_atm)], ['Annual savings', currency(metrics?.annual_savings)],
    ['ROI', isMeasured(metrics?.roi) ? formatMetric(metrics.roi, 1, 'x') : 'Not measured'],
    ['Fraud prevention rate', isMeasured(metrics?.prevention_rate) ? percent(metrics.prevention_rate) : 'Not measured'],
    ['Funds recovered', currency(metrics?.funds_recovered)], ['Cases resolved', isMeasured(metrics?.resolved_cases) ? count(metrics.resolved_cases) : 'Not measured'],
    ['Response time', isMeasured(metrics?.response_minutes) ? formatMetric(metrics.response_minutes, 1, ' min') : 'Not measured'],
    ['Lead time saved', isMeasured(metrics?.lead_time_hours) ? formatMetric(metrics.lead_time_hours, 1, ' hrs') : 'Not measured'],
  ];
  const scaling = metrics?.scaling ?? [];
  const maxSavings = Math.max(...scaling.filter(row => isMeasured(row.savings)).map(row => row.savings as number), 1);
  return <section className="card p-5">
    <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="w-full flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-base font-semibold"><DollarSign size={18} />Cost / ROI Estimation</span>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
    <p className="mt-3 text-sm text-gray-700">Operational impact is not measured by this prototype. Resolved complaint amounts do not establish prevented fraud or recovered funds. No assumed costs, recovery totals, or ROI are substituted.</p>
    {expanded && <div className="mt-4 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{rows.map(([label, value]) => <div key={label} className="rounded border border-gray-300 bg-gray-50 p-3"><div className="text-xs text-gray-700">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></div>)}</div>
      <section><h4 className="text-sm font-medium mb-2">Cost Breakdown</h4>{metrics?.cost_breakdown?.length ? metrics.cost_breakdown.map(row => <div key={row.item} className="flex justify-between text-sm"><span>{row.item}</span><span>{currency(row.cost)}</span></div>) : <p className="text-sm text-gray-700">Unavailable — no cost measurements supplied.</p>}</section>
      <section aria-label="Scaling projection"><h4 className="text-sm font-medium mb-2">Scaling Projection — supplied estimates, not realised impact</h4>{scaling.length ? scaling.map(row => <div key={row.scale} className="flex flex-wrap items-center gap-3 text-sm mb-3"><span>{row.scale}</span>{isMeasured(row.savings) && <div className="flex-1 min-w-16 h-3 rounded bg-gray-100"><div className="h-full rounded bg-blue-700" style={{ width: `${Math.max(0, row.savings) / maxSavings * 100}%` }} /></div>}<span>Cost {currency(row.cost)} · Savings {currency(row.savings)} · ROI {formatMetric(row.roi, 1, 'x')}</span></div>) : <p className="text-sm text-gray-700">Unavailable — no scaling estimates supplied.</p>}</section>
    </div>}
  </section>;
}
