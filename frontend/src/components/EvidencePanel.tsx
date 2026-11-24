import { EvidenceItem } from '../types';
import { Shield, MapPin, Clock, GitBranch, History, CheckCircle } from 'lucide-react';

interface EvidencePanelProps {
  evidence: Record<string, EvidenceItem>;
}

const iconMap: Record<string, React.ReactNode> = {
  transaction_pattern: <Shield size={16} className="text-[#33373B]" />,
  temporal_pattern: <Clock size={16} className="text-[#33373B]" />,
  geographic_signal: <MapPin size={16} className="text-[#33373B]" />,
  account_network: <GitBranch size={16} className="text-[#33373B]" />,
  historical_similarity: <History size={16} className="text-[#33373B]" />,
};

export default function EvidencePanel({ evidence }: EvidencePanelProps) {
  const entries = Object.entries(evidence);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-[#1A1C1F]">Evidence summary</h3>
        <span className="text-[11px] text-[#5F6368] bg-[#EFEFEA] px-2 py-0.5 rounded">
          {entries.length > 0 ? `${entries.length} signals` : 'Loading signals...'}
        </span>
      </div>
      <div className="space-y-3">
        {Object.entries(evidence).map(([key, item]) => (
          <div key={key} className="bg-[#F6F6F3] rounded-lg p-3 border border-[#D2D1CA]">
            <div className="flex items-center gap-2 mb-1.5">
              {iconMap[key] || <Shield size={16} />}
              <span className="font-medium text-sm text-[#1A1C1F]">{item.category}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded ml-auto ${
                item.strength === "Strong" ? "bg-[#15803D]/10 text-[#15803D]" :
                item.strength === "Moderate" ? "bg-[#B45309]/10 text-[#B45309]" :
                "bg-[#EFEFEA] text-[#5F6368]"
              }`}>
                {item.strength}
              </span>
            </div>
            <p className="text-sm text-[#33373B] mb-1">{item.description}</p>
            <p className="text-sm text-[#5F6368]">{item.details}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
