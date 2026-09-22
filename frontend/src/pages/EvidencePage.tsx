import { motion } from 'motion/react';
import { useDashboard } from '../context/DashboardContext';
import EvidencePanel from '../components/EvidencePanel';
import EvidenceChainViewer from '../components/EvidenceChainViewer';
import BlockchainPanel from '../components/BlockchainPanel';

export default function EvidencePage() {
  const { prediction } = useDashboard();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1F2937]">Evidence Register</h2>
        <p className="text-base text-[#374151] mt-1">Supporting signals, hash chain & blockchain ledger</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <EvidencePanel evidence={prediction.evidence} />
        <EvidenceChainViewer />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <BlockchainPanel />
      </div>
    </motion.div>
  );
}
