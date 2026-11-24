import { useState, useCallback, useEffect, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import PredictionCard from '../components/PredictionCard';
import RiskTrendChart from '../components/RiskTrendChart';
import RankedLocationsTable from '../components/RankedLocationsTable';
import { authFetch } from '../lib/auth';
import { SCORE_TOOLTIP } from '../lib/riskAreas';
import { CRIME_TYPE_DISTRIBUTION } from '../data/fallbackData';
import ExplainabilityPanel from '../components/ExplainabilityPanel';
import { ArrowLeftRight, RefreshCw, BarChart3 } from 'lucide-react';

const API_BASE = '/api';

export default function PredictionsPage() {
  const { prediction, alerts, selectedCaseId, isRefreshing, relativeTime, setPrediction, setLastPredictionUpdate, setEvidenceModalOpen, setSelectedLocation, selectedLocation, dataMode, loadData, lastUpdated } = useDashboard();
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [simulating, setSimulating] = useState(false);
  const [simAmount, setSimAmount] = useState(25000);
  const [simFrom, setSimFrom] = useState('MAHB0001234');
  const [simTo, setSimTo] = useState('MAHB0005678');
  const [simResult, setSimResult] = useState<any>(null);
  const [simStep, setSimStep] = useState<'idle' | 'sending' | 'processing' | 'done'>('idle');
  const [simError, setSimError] = useState('');

  const handleSimulate = useCallback(async () => {
    if (dataMode === 'demo') {
      setSimError('Transaction scoring is disabled in local demo; fixture risks are unchanged.');
      return;
    }
    setSimError('');
    if (simAmount < 100) {
      setSimError('Amount must be at least ₹100');
      return;
    }
    if (simAmount > 1000000) {
      setSimError('Amount cannot exceed ₹10,00,000');
      return;
    }
    setSimulating(true);
    setSimStep('sending');
    setSimResult(null);
    await new Promise(r => setTimeout(r, 600));
    if (!active.current) return;
    setSimStep('processing');
    try {
      const res = await authFetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: selectedCaseId, amount: simAmount, from_account: simFrom, to_account: simTo }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      await new Promise(r => setTimeout(r, 800));
      if (!active.current) return;
      if (selectedCaseId !== prediction.case_id) throw new Error('Selection changed; transaction result discarded.');
      if (data.updated_prediction?.case_id !== selectedCaseId || !data.updated_prediction?.primary_location || !data.updated_prediction?.ranked_locations?.length) {
        throw new Error('Transaction response is missing the selected case prediction.');
      }
      setSimResult(data);
      setSimStep('done');
      if (data.updated_prediction) {
        setPrediction(data.updated_prediction);
        setLastPredictionUpdate(new Date());
      }
      await loadData();
    } catch (error) {
      if (!active.current) return;
      setSimStep('done');
      setSimError(`${error instanceof Error ? error.message : 'Transaction failed.'} No substitute risk update was applied.`);
      setSimResult(null);
    }
    setTimeout(() => { if (active.current) { setSimulating(false); setSimStep('idle'); } }, 4000);
  }, [selectedCaseId, simAmount, simFrom, simTo, setPrediction, setLastPredictionUpdate, prediction.case_id, dataMode, loadData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#1A1C1F]">Predictions</h2>
          <p className="mt-1 text-sm text-[#43474C]">Ranked cash-out locations · synthetic-data prototype</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-[#E2E1DB] bg-white px-3 py-1.5 text-[12px] text-[#5F6368]">
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
          Updated {relativeTime}
        </span>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={15} className="text-[#5F6368]" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-[#1A1C1F]">Test a transaction</h3>
        </div>
        <p className="mt-1 text-[12px] text-[#5F6368]">
          Synthetic scoring only — no banking transfer is made.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <label htmlFor="sim-amount" className="mb-1 block text-[11px] text-[#5F6368]">Amount (₹)</label>
            <input id="sim-amount" type="text" inputMode="numeric" value={simAmount === 0 ? '' : simAmount}
              onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setSimAmount(v === '' ? 0 : parseInt(v, 10)); }}
              className="num w-full rounded-lg border border-[#D2D1CA] bg-white px-2.5 py-1.5 text-[13px] text-[#1A1C1F] focus:border-[#17406F] focus:outline-none" />
          </div>
          <div>
            <label htmlFor="sim-from" className="mb-1 block text-[11px] text-[#5F6368]">From account</label>
            <input id="sim-from" value={simFrom} onChange={e => setSimFrom(e.target.value)}
              className="num w-full rounded-lg border border-[#D2D1CA] bg-white px-2.5 py-1.5 text-[13px] text-[#1A1C1F] focus:border-[#17406F] focus:outline-none" />
          </div>
          <div>
            <label htmlFor="sim-to" className="mb-1 block text-[11px] text-[#5F6368]">To account</label>
            <input id="sim-to" value={simTo} onChange={e => setSimTo(e.target.value)}
              className="num w-full rounded-lg border border-[#D2D1CA] bg-white px-2.5 py-1.5 text-[13px] text-[#1A1C1F] focus:border-[#17406F] focus:outline-none" />
          </div>
          <button onClick={handleSimulate} disabled={simulating || dataMode === 'demo'}
            title={dataMode === 'demo' ? 'Disabled: scoring needs the backend; fixture signals are retained' : 'Submit a synthetic transaction to the API'}
            className="self-end rounded-lg bg-[#17406F] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#12355B] disabled:cursor-not-allowed disabled:bg-[#EFEFEA] disabled:text-[#8A8D90]">
            {simulating ? 'Processing…' : 'Score transaction'}
          </button>
        </div>
        <p className="mt-3 text-[12px] text-[#5F6368]">
          {dataMode === 'demo'
            ? 'Disabled in local demo. No API mutation or invented risk changes.'
            : 'Submitted to the scoring API; the ranked list updates from the response.'}
        </p>
        {simResult && !simResult.error && (
          <p className="mt-1 text-[12px] text-[#15803D]" title={SCORE_TOOLTIP}>
            Rank updated: {simResult.updated_prediction.primary_location.atm_id} → #{simResult.updated_prediction.primary_location.rank} (relative order, not a probability)
          </p>
        )}
        {simError && <p className="mt-1 text-[12px] text-[#B91C1C]">{simError}</p>}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <PredictionCard prediction={prediction} onShowEvidence={() => setEvidenceModalOpen(true)} />
        <RiskTrendChart data={prediction.risk_trend} />
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#1A1C1F]">Alert activity</h3>
          <span className="text-[11px] text-[#8A8D90]">Most recent first</span>
        </div>
        <div className="max-h-[220px] space-y-3 overflow-y-auto">
          {alerts.slice(0, 6).map((alert) => (
            <div key={alert.alert_id} className="flex items-start gap-3">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                alert.risk_level === 'High' ? 'bg-[#B91C1C]' : alert.risk_level === 'Medium' ? 'bg-[#B45309]' : 'bg-[#8A8D90]'
              }`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-[#1A1C1F]">{alert.message}</div>
                <div className="num mt-0.5 text-[11px] text-[#8A8D90]">{alert.timestamp}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={15} className="text-[#5F6368]" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-[#1A1C1F]">Crime types across the registry</h3>
          <span className="text-[11px] text-[#8A8D90]">Share of cases</span>
        </div>
        <div className="space-y-3">
          {CRIME_TYPE_DISTRIBUTION.map((item) => (
            <div key={item.type}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-[#43474C]">{item.type}</span>
                <span className="num text-[12px] text-[#5F6368]">{item.count} · {item.percentage}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#EFEFEA]">
                <div className="h-full rounded-full bg-[#17406F]" style={{ width: `${item.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <RankedLocationsTable locations={prediction.ranked_locations} onSelect={setSelectedLocation} />
      <ExplainabilityPanel caseId={prediction.case_id} atmId={(selectedLocation ?? prediction.primary_location).atm_id} demoMode={dataMode === 'demo'} refreshKey={lastUpdated.toISOString()} />
    </div>
  );
}
