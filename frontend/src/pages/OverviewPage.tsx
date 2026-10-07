import { useDashboard } from '../context/DashboardContext';
import { isMeasured, count } from '../lib/metrics';
import StatCard from '../components/StatCard';
import PredictionCard from '../components/PredictionCard';
import RiskTrendChart from '../components/RiskTrendChart';
import RankedLocationsTable from '../components/RankedLocationsTable';
import ExplainabilityPanel from '../components/ExplainabilityPanel';
import ModelCardPanel from '../components/ModelCardPanel';
import ModelPerformanceCard from '../components/ModelPerformanceCard';
import ModelHealthCard from '../components/ModelHealthCard';
import DriftIndicator from '../components/DriftIndicator';
import CostRoiCard from '../components/CostRoiCard';
import Pipeline from '../components/Pipeline';
import SyntheticOperationalSimulation from '../components/SyntheticOperationalSimulation';
import { FolderOpen, MapPin, Bell, Clock, ExternalLink, RefreshCw, ShieldCheck, AlertOctagon } from 'lucide-react';

export default function OverviewPage() {
  const { stats, prediction, isRefreshing, relativeTime, liveAlertCount, setEvidenceModalOpen, setSelectedLocation, selectedLocation, dataMode, lastUpdated } = useDashboard();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1F2937]">Cash-Out Risk Intelligence</h2>
          <p className="text-base text-[#6B7280] mt-1">Monitoring {stats.active_cases} active cases across 8 Indian cities</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] text-[#6B7280] bg-white px-3 py-1.5 rounded-lg border border-[#D1D5DB]">
            <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Updated {relativeTime}</span>
          </div>
          <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-[#1D4ED8] text-white text-base font-medium rounded-lg hover:bg-[#1D355B] transition-colors flex items-center gap-2">
            <ExternalLink size={16} /> Govt Portal
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={FolderOpen} label="Active Cases" value={stats.active_cases} sub="Under investigation" color="default" className="animate-fade-in-up" style={{ animationDelay: '0ms' }} />
        <StatCard icon={MapPin} label="High-Risk Locations" value={stats.high_risk_locations} sub="Predicted" color="error" className="animate-fade-in-up" style={{ animationDelay: '60ms' }} />
        <StatCard icon={Bell} label="Alerts Today" value={stats.alerts_today + liveAlertCount} sub="Pending review" color="warning" className="animate-fade-in-up" style={{ animationDelay: '120ms' }} />
        <StatCard icon={Clock} label={dataMode === 'demo' ? 'Simulated Lead Time' : 'Lead Time'} value={stats.avg_lead_time || 'Not measured'} sub={dataMode === 'demo' ? 'Synthetic fixture window' : 'Not verified operational lead time'} color="success" className="animate-fade-in-up" style={{ animationDelay: '180ms' }} />
        <StatCard icon={ShieldCheck} label={dataMode === 'demo' ? 'Simulated Exposure' : 'Prevented Fraud'} value={isMeasured(stats.prevented_fraud) ? `₹${count(stats.prevented_fraud)}` : 'Not measured'} sub={dataMode === 'demo' ? 'Synthetic fixture, not recovery' : 'Resolved amount is not prevention'} color="success" className="animate-fade-in-up" style={{ animationDelay: '240ms' }} />
        <StatCard icon={AlertOctagon} label="Linked Accounts Flagged" value={isMeasured(stats.mules_flagged) ? stats.mules_flagged : 'Not measured'} sub="Not verified mule identities" color="error" className="animate-fade-in-up" style={{ animationDelay: '300ms' }} />
      </div>
      {stats.metrics_note && <p role="note" className="text-sm text-[#4B5563]">{stats.metrics_note}</p>}
            <div className="text-sm text-[#4B5563] text-right">Source: {dataMode === 'demo' ? 'Synthetic demonstration data' : 'API-connected synthetic records (not operational data)'} · Last refreshed {relativeTime}</div>

      <div className="grid grid-cols-2 gap-6">
        <PredictionCard prediction={prediction} onShowEvidence={() => setEvidenceModalOpen(true)} />
        <RiskTrendChart data={prediction.risk_trend} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ExplainabilityPanel caseId={prediction.case_id} atmId={(selectedLocation ?? prediction.primary_location).atm_id} demoMode={dataMode === 'demo'} refreshKey={lastUpdated.toISOString()} />
        {dataMode === 'demo' ? <div className="card p-5 text-sm">Model metadata requires the backend and is disabled in local demo.</div> : <ModelCardPanel />}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {dataMode !== 'demo' && <><ModelHealthCard /><DriftIndicator /></>}
      </div>

      {dataMode !== 'demo' && <><ModelPerformanceCard /><CostRoiCard /></>}
      <SyntheticOperationalSimulation />

      <RankedLocationsTable locations={prediction.ranked_locations} onSelect={setSelectedLocation} />
      <Pipeline stage={6} />
    </div>
  );
}
