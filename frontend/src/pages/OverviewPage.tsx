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
import ScenarioRunner from '../components/ScenarioRunner';
import Pipeline from '../components/Pipeline';
import SyntheticOperationalSimulation from '../components/SyntheticOperationalSimulation';
import { ExternalLink, RefreshCw } from 'lucide-react';

export default function OverviewPage() {
  const { stats, prediction, isRefreshing, relativeTime, liveAlertCount, setEvidenceModalOpen, setSelectedLocation, selectedLocation, dataMode, lastUpdated } = useDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#1A1C1F]">Cash-out risk</h2>
          <p className="mt-1 text-sm text-[#5F6368]">
            {stats.active_cases} active cases across 8 Indian cities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-[#E2E1DB] bg-white px-3 py-1.5 text-[12px] text-[#5F6368]">
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Updated {relativeTime}</span>
          </span>
          <a
            href="https://cybercrime.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D2D1CA] px-3 py-1.5 text-[12px] font-medium text-[#43474C] transition-colors hover:bg-[#EFEFEA]"
          >
            NCRP portal <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      </div>

      {dataMode !== 'demo' && <ScenarioRunner />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active cases" value={stats.active_cases} sub="Under investigation" />
        <StatCard label="High-risk locations" value={stats.high_risk_locations} sub="Ranked above the review line" />
        <StatCard label="Alerts today" value={stats.alerts_today + liveAlertCount} sub="Pending review" />
        <StatCard label="Lead time" value={stats.avg_lead_time?.split(/\s+[—-]\s+/)[0] || 'Not measured'} sub="Needs a confirmed cash-out outcome" />
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#1A1C1F]">Measured outcomes</h3>
          <span className="text-[11px] text-[#8A8D90]">Not verified prevention</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <div className="text-[12px] text-[#5F6368]">
              {dataMode === 'demo' ? 'Simulated exposure' : 'Resolved case value'}
            </div>
            <div className="num mt-1 text-2xl font-medium text-[#1A1C1F]">
              {isMeasured(stats.prevented_fraud) ? `₹${count(stats.prevented_fraud)}` : 'Not measured'}
            </div>
            <div className="mt-1 text-[11px] text-[#8A8D90]">
              {dataMode === 'demo' ? 'Synthetic fixture, not recovery' : 'Sum of resolved case amounts'}
            </div>
          </div>
          <div className="border-t border-[#E2E1DB] pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <div className="text-[12px] text-[#5F6368]">Linked accounts flagged</div>
            <div className="num mt-1 text-2xl font-medium text-[#1A1C1F]">
              {isMeasured(stats.mules_flagged) ? stats.mules_flagged : 'Not measured'}
            </div>
            <div className="mt-1 text-[11px] text-[#8A8D90]">Not verified mule identities</div>
          </div>
        </div>
        {stats.metrics_note && <p className="mt-4 border-t border-[#E2E1DB] pt-3 text-[11px] text-[#8A8D90]">{stats.metrics_note}</p>}
      </div>

      <div className="text-right text-[11px] text-[#8A8D90]">
        Source: {dataMode === 'demo' ? 'synthetic demonstration data' : 'API-connected synthetic records'} · last refreshed {relativeTime}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <PredictionCard prediction={prediction} onShowEvidence={() => setEvidenceModalOpen(true)} />
        <RiskTrendChart data={prediction.risk_trend} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <ExplainabilityPanel caseId={prediction.case_id} atmId={(selectedLocation ?? prediction.primary_location).atm_id} demoMode={dataMode === 'demo'} refreshKey={lastUpdated.toISOString()} />
        {dataMode === 'demo' ? <div className="card p-5 text-sm">Model metadata requires the backend and is disabled in local demo.</div> : <ModelCardPanel />}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {dataMode !== 'demo' && <><ModelHealthCard /><DriftIndicator /></>}
      </div>

      {dataMode !== 'demo' && <><ModelPerformanceCard /><CostRoiCard /></>}
      <SyntheticOperationalSimulation />

      <RankedLocationsTable locations={prediction.ranked_locations} onSelect={setSelectedLocation} />
      <Pipeline stage={6} />
    </div>
  );
}
