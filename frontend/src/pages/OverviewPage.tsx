import { useDashboard } from '../context/DashboardContext';
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
import { FolderOpen, MapPin, Bell, Clock, ExternalLink, RefreshCw, ShieldCheck, AlertOctagon } from 'lucide-react';

export default function OverviewPage() {
  const { stats, prediction, isRefreshing, relativeTime, liveAlertCount, evidenceModalOpen, setEvidenceModalOpen, setSelectedLocation } = useDashboard();

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

      <div className="grid grid-cols-6 gap-4">
        <StatCard icon={FolderOpen} label="Active Cases" value={stats.active_cases} sub="Under investigation" color="default" className="animate-fade-in-up" style={{ animationDelay: '0ms' }} />
        <StatCard icon={MapPin} label="High-Risk Locations" value={stats.high_risk_locations} sub="Predicted" color="error" className="animate-fade-in-up" style={{ animationDelay: '60ms' }} />
        <StatCard icon={Bell} label="Alerts Today" value={stats.alerts_today + liveAlertCount} sub="Pending review" color="warning" className="animate-fade-in-up" style={{ animationDelay: '120ms' }} />
        <StatCard icon={Clock} label="Avg. Lead Time" value={stats.avg_lead_time} sub="Before expected window" color="success" className="animate-fade-in-up" style={{ animationDelay: '180ms' }} />
        <StatCard icon={ShieldCheck} label="Estimated Exposure" value={`₹${(stats.prevented_fraud / 100000).toFixed(1)}L`} sub="Resolved case value" color="success" className="animate-fade-in-up" style={{ animationDelay: '240ms' }} />
        <StatCard icon={AlertOctagon} label="Linked Accounts Flagged" value={stats.mules_flagged} sub="High-risk accounts" color="error" className="animate-fade-in-up" style={{ animationDelay: '300ms' }} />
      </div>
      <div className="text-[11px] text-[#6B7280] text-right">Source: Synthetic data (200k transactions, 8 cities, 400 ATMs) | Fraud rate: 3.65% | Model: RF+XGBoost ensemble</div>

      <div className="grid grid-cols-2 gap-6">
        <PredictionCard prediction={prediction} onShowEvidence={() => setEvidenceModalOpen(true)} />
        <RiskTrendChart data={prediction.risk_trend} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ExplainabilityPanel caseId={prediction.case_id} />
        <ModelCardPanel />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ModelHealthCard />
        <DriftIndicator />
      </div>

      <ModelPerformanceCard />
      <CostRoiCard />

      <RankedLocationsTable locations={prediction.ranked_locations} onSelect={setSelectedLocation} />
      <Pipeline stage={6} />
    </div>
  );
}
