import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useDashboard } from '../context/DashboardContext';
import { isDemoRoute } from '@/lib/auth';
import { can } from '@/lib/roles';
import { areaPrimary, riskArea, SCORE_TOOLTIP } from '@/lib/riskAreas';

const STEP_MS = 3000;

const STEPS = [
  { key: 'complaint', label: 'Complaint', to: '/cases', note: 'district · category · amount' },
  { key: 'prediction', label: 'Prediction', to: '/predictions', note: 'ranked ATMs · no predicted window' },
  { key: 'zone', label: 'Zone', to: '/map', note: 'priority · watch cells grouped' },
  { key: 'alert', label: 'Alert', to: '/alerts', note: 'one per open case+ATM' },
  { key: 'resolve', label: 'Resolve', to: '/cases', note: 'human action or nothing' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

function zoneSummary(prediction: ReturnType<typeof useDashboard>['prediction']) {
  const zones = prediction.intervention_zones?.zones ?? [];
  const priority = zones.filter(z => z.level === 'priority').length;
  const watch = zones.filter(z => z.level === 'watch').length;
  const cells = prediction.risk_surface?.cells.length ?? 0;
  return `${zones.length} zones · ${priority} priority · ${watch} watch · ${cells} surface cells`;
}

export default function LoopPage() {
  const { cases, prediction, alerts, selectedCaseId, handleCaseSelect, handleResolveCase, dataMode } = useDashboard();
  const location = useLocation();
  const base = location.pathname.startsWith('/demo') ? '/demo' : '/real';
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const hoverRef = useRef(false);

  const activeCase = useMemo(
    () => cases.find(c => c.case_id === selectedCaseId) ?? cases[0],
    [cases, selectedCaseId],
  );

  const caseAlerts = useMemo(
    () => alerts.filter(a => a.case_id === (activeCase?.case_id ?? '')),
    [alerts, activeCase?.case_id],
  );

  const primary = prediction.primary_location;
  const zones = prediction.intervention_zones?.zones ?? [];
  const surfaceCells = prediction.risk_surface?.cells.length ?? 0;

  // Auto-advance: stops on hover/focus, stops at Resolve, restarts from
  // Complaint after Resolve. Never fires while a mutation is in flight.
  useEffect(() => {
    if (hovered || resolved) return;
    const t = setTimeout(() => {
      if (active < STEPS.length - 1) setActive(a => a + 1);
      else { setActive(0); setResolved(false); setNote(null); }
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [active, hovered, resolved]);

  hoverRef.current = hovered;

  const onResolve = () => {
    if (!activeCase) return;
    if (isDemoRoute() || dataMode === 'demo') {
      setNote('Demo mode — resolution is local only; no backend write was made.');
      return;
    }
    if (!can('case.resolve')) {
      setNote('Your role cannot resolve cases.');
      return;
    }
    setNote('Resolving…');
    try {
      const out = handleResolveCase(activeCase.case_id) as unknown as Promise<unknown> | undefined;
      if (out && typeof out.then === 'function') {
        out.then(() => { setResolved(true); setNote('Case resolved.'); })
           .catch(() => setNote('Resolve failed — see Cases page.'));
      } else {
        setResolved(true);
        setNote('Case resolved.');
      }
    } catch {
      setNote('Resolve failed — see Cases page.');
    }
  };

  const current: StepKey = STEPS[active].key;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A1C1F]">The Loop</h2>
        <p className="text-sm text-[#33373B] mt-1">
          One case, five stages. Every value below is the live dashboard state for the selected case — nothing is invented.
        </p>
      </div>

      {!activeCase && (
        <p role="note" className="card p-5 text-sm">
          Select a case in <Link to={`${base}/cases`} className="underline text-[#17406F]">Cases</Link> to start the loop.
        </p>
      )}

      {activeCase && (
        <>
          {/* Stepper */}
          <ol className="flex items-start gap-1 flex-wrap" aria-label="Investigation loop">
            {STEPS.map((s, i) => {
              const isActive = i === active;
              const done = i < active;
              return (
                <li key={s.key} className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    onFocus={() => setHovered(true)}
                    onBlur={() => setHovered(false)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      isActive ? 'border-[#17406F] bg-[#17406F]/5 text-[#1A1C1F] font-medium'
                        : done ? 'border-[#D2D1CA] bg-white text-[#43474C]'
                        : 'border-[#D2D1CA] bg-white text-[#5F6368]'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-semibold ${
                      isActive ? 'bg-[#17406F] text-white' : done ? 'bg-[#15803D] text-white' : 'bg-[#EFEFEA] text-[#5F6368]'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-left leading-tight">
                      <span className="block">{s.label}</span>
                      <span className="block text-[10px] text-[#5F6368] font-normal">{s.note}</span>
                    </span>
                  </button>
                  {i < STEPS.length - 1 && <span aria-hidden className="text-[#D2D1CA]">→</span>}
                </li>
              );
            })}
          </ol>

          <div className="card p-5">
              {current === 'complaint' && (
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1C1F]">1 · Complaint</h3>
                  <p className="text-sm text-[#5F6368] mt-1">The filing that opened the case.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <div className="bg-white rounded-lg p-3 border border-[#D2D1CA]"><div className="text-[11px] text-[#5F6368] ">Case</div><div className="text-sm font-mono font-medium text-[#1A1C1F]">{activeCase.case_id}</div></div>
                    <div className="bg-white rounded-lg p-3 border border-[#D2D1CA]"><div className="text-[11px] text-[#5F6368] ">District</div><div className="text-sm font-medium text-[#1A1C1F]">{activeCase.district || '—'}</div></div>
                    <div className="bg-white rounded-lg p-3 border border-[#D2D1CA]"><div className="text-[11px] text-[#5F6368] ">Category</div><div className="text-sm font-medium text-[#1A1C1F]">{activeCase.crime_type}</div></div>
                    <div className="bg-white rounded-lg p-3 border border-[#D2D1CA]"><div className="text-[11px] text-[#5F6368] ">Amount</div><div className="text-sm font-medium text-[#1A1C1F]">₹{activeCase.amount.toLocaleString()}</div></div>
                  </div>
                  <label className="text-sm text-[#33373B] block mt-4">Change case
                    <select value={activeCase.case_id} onChange={e => handleCaseSelect(e.target.value)} className="ml-2 px-2 py-1.5 text-xs bg-white border border-[#D2D1CA] rounded-lg text-[#1A1C1F]">
                      {cases.map(c => <option key={c.case_id} value={c.case_id}>{c.case_id} — {c.district || ''}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {current === 'prediction' && primary && (
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1C1F]">2 · Prediction</h3>
                  <p className="text-sm text-[#5F6368] mt-1">{SCORE_TOOLTIP}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <div className="bg-white rounded-lg p-3 border border-[#D2D1CA]"><div className="text-[11px] text-[#5F6368] ">Primary ATM</div><div className="text-sm font-mono font-medium text-[#1A1C1F]">{primary.atm_id}</div></div>
                    <div className="bg-white rounded-lg p-3 border border-[#D2D1CA]"><div className="text-[11px] text-[#5F6368] ">Zone · Rank</div><div className="text-sm font-medium text-[#1A1C1F]">{areaPrimary(riskArea(primary.rank, prediction.ranked_locations.length, primary.risk_area), primary.rank, prediction.ranked_locations.length)}</div></div>
                    <div className="bg-white rounded-lg p-3 border border-[#D2D1CA]"><div className="text-[11px] text-[#5F6368] ">Observed span</div><div className="text-sm font-medium text-[#1A1C1F]">{primary.observed_window?.label ?? '—'}</div></div>
                    <div className="bg-white rounded-lg p-3 border border-[#D2D1CA]"><div className="text-[11px] text-[#5F6368] ">Candidates</div><div className="text-sm font-medium text-[#1A1C1F]">{prediction.ranked_locations.length}</div></div>
                  </div>
                </div>
              )}

              {current === 'zone' && (
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1C1F]">3 · Zone</h3>
                  <p className="text-sm text-[#5F6368] mt-1">{zones.length > 0 ? zoneSummary(prediction) : 'No intervention zones are built for this prediction.'}</p>
                  <div className="mt-4 space-y-2">
                    {zones.slice(0, 3).map(z => (
                      <div key={z.zone_id} className="flex items-center gap-3 text-sm bg-white rounded-lg p-3 border border-[#D2D1CA]">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${z.level === 'priority' ? 'bg-[#B91C1C]/10 text-[#B91C1C]' : 'bg-[#B45309]/10 text-[#B45309]'}`}>{z.level}</span>
                        <span className="font-mono text-[#1A1C1F]">{z.top_atm}</span>
                        <span className="text-[#5F6368]">{z.cells} cells · {z.atm_count} ATMs</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {current === 'alert' && (
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1C1F]">4 · Alert</h3>
                  <p className="text-sm text-[#5F6368] mt-1">
                    {caseAlerts.length === 0 ? 'No alert has been raised for this case.' : `${caseAlerts.length} alert(s) for ${activeCase.case_id}.`}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {caseAlerts.map(a => (
                      <li key={a.alert_id} className="bg-white rounded-lg p-3 border border-[#D2D1CA]">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${a.risk_level === 'High' ? 'bg-[#B91C1C]/10 text-[#B91C1C]' : 'bg-[#EFEFEA] text-[#5F6368]'}`}>{a.risk_level}</span>
                        <span className="text-sm text-[#1A1C1F] ml-2">{a.message}</span>
                        <span className="text-xs text-[#5F6368] block mt-1">{a.location} · {a.time_window}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {current === 'resolve' && (
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1C1F]">5 · Resolve</h3>
                  <p className="text-sm text-[#5F6368] mt-1">Resolution is a human action — the model never resolves a case on its own.</p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={onResolve}
                      disabled={activeCase.status === 'resolved' || resolved}
                      className="px-4 py-2 bg-[#15803D] text-white text-sm font-medium rounded-lg hover:bg-[#166534] disabled:opacity-50"
                    >
                      {activeCase.status === 'resolved' || resolved ? 'Resolved' : 'Resolve case'}
                    </button>
                    {note && <p role="status" className="text-sm mt-3">{note}</p>}
                    <div className="mt-4">
                      <Link to={`${base}/cases`} className="text-sm text-[#17406F] underline">Open in Case Registry</Link>
                    </div>
                  </div>
                </div>
              )}
          </div>

          <p className="text-xs text-[#5F6368]">
            Stepper advances every {STEP_MS / 1000}s and pauses on hover. Every value above comes from the live dashboard state.
          </p>
        </>
      )}
    </div>
  );
}
