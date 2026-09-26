import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { useDashboard } from '../context/DashboardContext';
import PredictionCard from '../components/PredictionCard';
import RiskTrendChart from '../components/RiskTrendChart';
import RankedLocationsTable from '../components/RankedLocationsTable';
import { authFetch } from '../lib/auth';
import { FALLBACK_PREDICTIONS, CRIME_TYPE_DISTRIBUTION } from '../data/fallbackData';
import { Zap, RefreshCw, Activity, Shield } from 'lucide-react';

const API_BASE = '/api';

export default function PredictionsPage() {
  const { prediction, alerts, selectedCaseId, isRefreshing, relativeTime, setPrediction, setLastPredictionUpdate, evidenceModalOpen, setEvidenceModalOpen, setSelectedLocation } = useDashboard();
  const [simulating, setSimulating] = useState(false);
  const [simAmount, setSimAmount] = useState(25000);
  const [simFrom, setSimFrom] = useState('MAHB0001234');
  const [simTo, setSimTo] = useState('MAHB0005678');
  const [simResult, setSimResult] = useState<any>(null);
  const [simStep, setSimStep] = useState<'idle' | 'sending' | 'processing' | 'done'>('idle');
  const [simError, setSimError] = useState('');

  const handleSimulate = useCallback(async () => {
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
      setSimResult(data);
      setSimStep('done');
      if (data.updated_prediction) {
        setPrediction(data.updated_prediction);
        setLastPredictionUpdate(new Date());
      }
    } catch {
      setSimStep('done');
      setSimResult({ error: 'Backend not reachable' });
    }
    setTimeout(() => { setSimulating(false); setSimStep('idle'); }, 4000);
  }, [selectedCaseId, simAmount, simFrom, simTo, setPrediction, setLastPredictionUpdate]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1F2937]">Predictions</h2>
          <p className="text-base text-[#374151] mt-1">Risk scoring and location forecasting · synthetic-data prototype</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#6B7280] bg-white px-3 py-1.5 rounded-lg border border-[#D1D5DB]">
          <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Updated {relativeTime}</span>
        </div>
      </div>

      <div className="card p-5 border-l-2 border-l-[#3b82f6]">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-[#3b82f6]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Simulate New Transaction</h3>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div>
            <label className="text-[10px] text-[#6B7280] uppercase block mb-1">Amount (₹)</label>
            <input type="text" inputMode="numeric" value={simAmount === 0 ? '' : simAmount}
              onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setSimAmount(v === '' ? 0 : parseInt(v, 10)); }}
              className="w-full px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-sm text-[#1F2937] focus:outline-none focus:border-[#71717a]" />
          </div>
          <div>
            <label className="text-[10px] text-[#6B7280] uppercase block mb-1">From Account</label>
            <input value={simFrom} onChange={e => setSimFrom(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-sm text-[#1F2937] focus:outline-none focus:border-[#71717a]" />
          </div>
          <div>
            <label className="text-[10px] text-[#6B7280] uppercase block mb-1">To Account</label>
            <input value={simTo} onChange={e => setSimTo(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-sm text-[#1F2937] focus:outline-none focus:border-[#71717a]" />
          </div>
          <button onClick={handleSimulate} disabled={simulating}
            className="py-1.5 bg-[#3b82f6] text-white text-sm font-medium rounded hover:bg-[#2563eb] disabled:opacity-50 flex items-center justify-center gap-1">
            <Zap size={12} /> {simulating ? 'Processing...' : 'Simulate'}
          </button>
        </div>
        <div className="text-[10px] text-[#9CA3AF] mt-1">Simulated transactions are ephemeral and not stored in the database.</div>
        {simResult && !simResult.error && (
          <div className="text-[10px] text-[#22c55e]">✓ Risk updated: {simResult.updated_prediction.primary_location.atm_id} → {simResult.updated_prediction.primary_location.risk_score}%</div>
        )}
        {simError && (
          <div className="text-[10px] text-[#ef4444] mt-1">{simError}</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <PredictionCard prediction={prediction} onShowEvidence={() => setEvidenceModalOpen(true)} />
        <RiskTrendChart data={prediction.risk_trend} />
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-[#22c55e]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Activity Feed</h3>
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
        </div>
        <div className="space-y-3 max-h-[200px] overflow-y-auto">
          {alerts.slice(0, 6).map((alert, i) => (
            <motion.div key={alert.alert_id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-white transition-colors">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${alert.risk_level === 'High' ? 'bg-[#ef4444]' : alert.risk_level === 'Medium' ? 'bg-[#f59e0b]' : 'bg-[#d4d4d8]'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#1F2937] truncate">{alert.message}</div>
                <div className="text-[10px] text-[#6B7280] mt-0.5">{alert.timestamp}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-[#8b5cf6]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Crime Type Distribution</h3>
        </div>
        <div className="space-y-3">
          {CRIME_TYPE_DISTRIBUTION.map((item, i) => (
            <div key={item.type}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-[#374151]">{item.type}</span>
                <span className="text-sm text-[#1F2937] font-medium">{item.count} ({item.percentage}%)</span>
              </div>
              <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${item.percentage > 30 ? '#ef4444' : item.percentage > 15 ? '#f59e0b' : '#3b82f6'}, ${item.percentage > 30 ? '#dc2626' : item.percentage > 15 ? '#d97706' : '#2563eb'})` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <RankedLocationsTable locations={prediction.ranked_locations} onSelect={setSelectedLocation} />
    </motion.div>
  );
}
