import { useEffect, useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { formatMetric, isMeasured } from '../lib/metrics';
import { authFetch } from '../lib/auth';

type Explanation = {
  case_id: string;
  atm_id: string;
  base_value: number | null;
  explained_model?: string | null;
  explanation_units?: string | null;
  explanation_reason?: string | null;
  explanation_probability?: number | null;
  risk_score: number;
  shap_available: boolean;
  shap_method: string;
  feature_contributions: { feature: string; label?: string; contribution?: number | null; importance?: number | null; value?: number }[];
};

export default function ExplainabilityPanel({ caseId, atmId, demoMode = false, refreshKey = '' }: {
  caseId: string; atmId: string; demoMode?: boolean; refreshKey?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<{ key: string; data?: Explanation; error?: string } | null>(null);
  const key = `${caseId}:${atmId}:${demoMode}:${refreshKey}`;

  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    let active = true;
    authFetch(`/api/model/shap/${encodeURIComponent(caseId)}?atm_id=${encodeURIComponent(atmId)}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(`Explanation request failed (${response.status})${typeof body?.detail === 'string' ? `: ${body.detail}` : ''}`);
        }
        const data = await response.json() as Explanation;
        // Older endpoints cannot guarantee exact-ATM explanations. Never silently
        // display their primary-ATM explanation for a different selected ATM.
        if (data.case_id !== caseId || data.atm_id !== atmId) throw new Error('The service did not return an explanation for this exact case and ATM.');
        if ((data.base_value != null && !Number.isFinite(data.base_value)) || !Number.isFinite(data.risk_score) || !Array.isArray(data.feature_contributions)
          || data.feature_contributions.some(f => data.shap_available ? !isMeasured(f.contribution) : !isMeasured(f.importance ?? f.contribution))) throw new Error('Explanation response is missing valid base or contribution values.');
        if (active) setResult({ key, data });
      })
      .catch(error => { if (active && !controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : 'Explanation unavailable.' }); });
    return () => { active = false; controller.abort(); };
  }, [caseId, atmId, demoMode, key]);

  const data = result?.key === key ? result.data : undefined;
  const error = result?.key === key ? result.error : undefined;
  const magnitude = (feature: Explanation['feature_contributions'][number]) => data?.shap_available ? feature.contribution : feature.importance ?? feature.contribution;
  const max = data ? Math.max(...data.feature_contributions.map(f => Math.abs(magnitude(f) ?? 0)), 0.001) : 1;
  const reconstructed = data?.shap_available && isMeasured(data.base_value) ? data.base_value + data.feature_contributions.reduce((sum, feature) => sum + (feature.contribution ?? 0), 0) : null;
  return (
    <section className="card p-5" aria-label="Selected ATM explainability">
      <button className="w-full flex items-center justify-between gap-2" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span className="flex items-center gap-2 text-base font-semibold"><Brain size={18} />Model Explainability</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <p className="mt-2 text-sm text-[#374151]">{caseId} · {atmId}</p>
      {demoMode ? <p className="mt-3 text-sm text-amber-800">Local fixture only — SHAP and base value are unavailable. No feature contributions are invented.</p>
        : error ? <p className="mt-3 text-sm text-red-800" role="alert">Explanation unavailable: {error} No synthetic substitute is shown.</p>
        : !data ? <p className="mt-3 text-sm" role="status">Loading selected ATM explanation…</p>
        : <>
          <p className="mt-3 text-sm font-medium">{data.shap_available ? 'SHAP explanation' : 'Importance fallback — not SHAP'} · {data.shap_method}</p>
          <p className="mt-2 text-sm">Base value: <span className="font-mono">{data.base_value ?? 'Unavailable'}</span> · Risk score: <span className="font-mono">{data.risk_score}%</span></p>
          {data.base_value == null && <p className="mt-2 text-sm text-amber-800">No base value supplied; an additive explanation cannot be reconstructed.</p>}
          <p className="mt-2 text-sm text-gray-700">Explained model: {data.explained_model ?? 'Unavailable'} · Units: {data.explanation_units ?? 'Unavailable'}</p>
          {isMeasured(data.explanation_probability) && <p className="mt-2 text-sm">Explained probability: {formatMetric(data.explanation_probability, 6)} · score scale: {formatMetric(data.explanation_probability * 100, 2)}</p>}
          {isMeasured(reconstructed) && data.explanation_units === 'probability' && <p className="mt-2 text-sm">Base + signed contributions: {formatMetric(reconstructed, 6)} probability ({formatMetric(reconstructed * 100, 2)} on score scale).</p>}
          {data.explanation_reason && <p className="mt-2 text-sm text-gray-700">{data.explanation_reason}</p>}
          {!data.shap_available && <p className="mt-2 text-sm text-amber-800">Importance-based contributions are not additive SHAP attributions.</p>}
          {expanded && <div className="mt-4 space-y-3">
            <p className="text-sm text-[#374151]">{data.shap_available ? 'Signed local contributions in the reported output units; probability units scale by 100 to score units.' : 'Global feature importance only — unsigned model-level diagnostics, not contributions to this ATM’s score.'}</p>
            {data.feature_contributions.length === 0 && <p className="text-sm">No contributions returned.</p>}
            {data.feature_contributions.map(f => <div key={f.feature} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-40 text-[#374151]" title={f.feature}>{f.label ?? f.feature}</span>
              <div className="flex-1 min-w-16 h-3 rounded bg-gray-100"><div className={`h-full rounded ${data.shap_available && (f.contribution ?? 0) < 0 ? 'bg-green-700' : 'bg-blue-700'}`} style={{ width: `${Math.abs(magnitude(f) ?? 0) / max * 100}%` }} /></div>
              <span className="font-mono">{data.shap_available && (f.contribution ?? 0) > 0 ? '+' : ''}{magnitude(f)}</span>
            </div>)}
          </div>}
        </>}
    </section>
  );
}
