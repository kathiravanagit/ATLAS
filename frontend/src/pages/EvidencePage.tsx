import { useDashboard } from '../context/DashboardContext';
import EvidencePanel from '../components/EvidencePanel';
import EvidenceChainViewer from '../components/EvidenceChainViewer';
import BlockchainPanel from '../components/BlockchainPanel';

export default function EvidencePage() {
  const { prediction } = useDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A1C1F]">Evidence Register</h2>
        <p className="text-sm text-[#33373B] mt-1">Supporting signals, hash chain & blockchain ledger</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <EvidencePanel evidence={prediction.evidence} />
        <EvidenceChainViewer />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <BlockchainPanel />
      </div>
    </div>
  );
}
