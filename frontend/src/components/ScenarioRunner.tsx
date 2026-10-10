import { useState } from 'react';
import { Play, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { useApiData } from '../lib/useApiData';
import { authFetch } from '../lib/auth';

interface ScenarioSummary { id: string; name: string; description: string }
interface ScenarioFlow {
  id?: string; name: string; description: string; case_id: string; city?: string;
  steps?: string[];
  prediction?: {
    status?: string;
    primary_location?: { atm_id?: string; location_name?: string; risk_score?: number; expected_window?: string } | null;
  } | null;
}

export default function ScenarioRunner() {
  const { data: scenarios, loading, error } = useApiData<ScenarioSummary[]>('/api/scenarios');
  const [openId, setOpenId] = useState<string | null>(null);
  const [flow, setFlow] = useState<ScenarioFlow | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  async function runScenario(id: string) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setRunning(true);
    setRunError(null);
    setFlow(null);
    try {
      const res = await authFetch(`/api/scenarios/${id}`);
      if (!res.ok) throw new Error(`Scenario failed (${res.status})`);
      setFlow(await res.json() as ScenarioFlow);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Scenario failed.');
    } finally {
      setRunning(false);
    }
  }

  return <section className="card p-5" aria-label="Guided demo scenarios">
    <h2 className="flex items-center gap-2 text-base font-semibold mb-1"><Play size={18} />Guided Demo Scenarios</h2>
    <p className="text-sm text-gray-700 mb-4">One click runs complaint → prediction → alert for a curated case.</p>
    {loading ? <p className="text-sm" role="status">Loading scenarios…</p>
      : error ? <p className="text-sm text-red-800" role="alert">Scenarios unavailable: {error}</p>
      : !(scenarios?.length) ? <p className="text-sm text-gray-700">No scenarios supplied.</p>
      : <div className="space-y-2">{scenarios.map(s => {
        const open = openId === s.id;
        const active = open && flow && (flow.id === s.id || !flow.id);
        return <div key={s.id} className="rounded border border-gray-300">
          <button onClick={() => void runScenario(s.id)} aria-expanded={open}
            className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-gray-50">
            <span><span className="block text-sm font-medium">{s.name}</span>
              <span className="block text-xs text-gray-700 mt-0.5">{s.description}</span></span>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {open && <div className="px-3 pb-3">
            {running ? <p className="text-sm" role="status">Running scenario…</p>
              : runError ? <p className="text-sm text-red-800" role="alert">{runError}</p>
              : active ? <>
                <ol className="mt-1 space-y-1.5">{(flow.steps ?? []).map((step, i) =>
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="font-mono text-xs mt-0.5 text-gray-500">{i + 1}.</span>{step}
                  </li>)}
                </ol>
                <p className="mt-3 text-sm text-gray-700 flex items-center gap-1.5">
                  <MapPin size={14} />
                  {flow.prediction?.primary_location?.atm_id ?? 'No prediction'} —
                  risk {flow.prediction?.primary_location?.risk_score ?? 'unmeasured'}
                  {flow.prediction?.primary_location?.expected_window ? ` · ${flow.prediction.primary_location.expected_window}` : ''}
                  {flow.case_id ? <span className="font-mono text-xs">({flow.case_id})</span> : null}
                </p>
              </> : null}
          </div>}
        </div>;
      })}</div>}
  </section>;
}
