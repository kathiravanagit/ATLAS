import { EvidenceItem } from '../types';
import { Shield, MapPin, Clock, GitBranch, History, CheckCircle } from 'lucide-react';

interface EvidencePanelProps {
  evidence: Record<string, EvidenceItem>;
}

const iconMap: Record<string, React.ReactNode> = {
  transaction_pattern: <Shield size={16} className="text-[#e4e4e7]" />,
  temporal_pattern: <Clock size={16} className="text-[#e4e4e7]" />,
  geographic_signal: <MapPin size={16} className="text-[#e4e4e7]" />,
  account_network: <GitBranch size={16} className="text-[#e4e4e7]" />,
  historical_similarity: <History size={16} className="text-[#e4e4e7]" />,
};

export default function EvidencePanel({ evidence }: EvidencePanelProps) {
  const entries = Object.entries(evidence);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-base text-white">Evidence Summary</h3>
        <span className="text-[10px] text-[#d4d4d8] bg-[#27272a] px-2 py-0.5 rounded">
          {entries.length > 0 ? `${entries.length} signals` : 'Loading signals...'}
        </span>
      </div>
      <div className="space-y-3">
        {Object.entries(evidence).map(([key, item]) => (
          <div key={key} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a]">
            <div className="flex items-center gap-2 mb-1.5">
              {iconMap[key] || <Shield size={16} />}
              <span className="font-medium text-base text-white">{item.category}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ml-auto ${
                item.strength === "Strong" ? "bg-[#22c55e]/10 text-[#22c55e]" :
                item.strength === "Moderate" ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                "bg-[#27272a] text-[#d4d4d8]"
              }`}>
                {item.strength}
              </span>
            </div>
            <p className="text-base text-[#e4e4e7] mb-1">{item.description}</p>
            <p className="text-sm text-[#d4d4d8]">{item.details}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
