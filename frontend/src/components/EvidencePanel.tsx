import { EvidenceItem } from '../types';
import { Shield, MapPin, Clock, GitBranch, History, CheckCircle } from 'lucide-react';

interface EvidencePanelProps {
  evidence: Record<string, EvidenceItem>;
}

const iconMap: Record<string, React.ReactNode> = {
  transaction_pattern: <Shield size={16} className="text-[#374151]" />,
  temporal_pattern: <Clock size={16} className="text-[#374151]" />,
  geographic_signal: <MapPin size={16} className="text-[#374151]" />,
  account_network: <GitBranch size={16} className="text-[#374151]" />,
  historical_similarity: <History size={16} className="text-[#374151]" />,
};

export default function EvidencePanel({ evidence }: EvidencePanelProps) {
  const entries = Object.entries(evidence);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-base text-[#1F2937]">Evidence Summary</h3>
        <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">
          {entries.length > 0 ? `${entries.length} signals` : 'Loading signals...'}
        </span>
      </div>
      <div className="space-y-3">
        {Object.entries(evidence).map(([key, item]) => (
          <div key={key} className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB]">
            <div className="flex items-center gap-2 mb-1.5">
              {iconMap[key] || <Shield size={16} />}
              <span className="font-medium text-base text-[#1F2937]">{item.category}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded ml-auto ${
                item.strength === "Strong" ? "bg-[#22c55e]/10 text-[#22c55e]" :
                item.strength === "Moderate" ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                "bg-[#F3F4F6] text-[#6B7280]"
              }`}>
                {item.strength}
              </span>
            </div>
            <p className="text-base text-[#374151] mb-1">{item.description}</p>
            <p className="text-sm text-[#6B7280]">{item.details}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
