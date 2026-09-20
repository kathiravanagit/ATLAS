import { X, Shield, MapPin, Clock, GitBranch, History } from 'lucide-react';
import { EvidenceItem } from '../types';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: Record<string, EvidenceItem>;
  atmId?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  transaction_pattern: <Shield size={16} className="text-[#1D355B]" />,
  temporal_pattern: <Clock size={16} className="text-[#1D355B]" />,
  geographic_signal: <MapPin size={16} className="text-[#1D355B]" />,
  account_network: <GitBranch size={16} className="text-[#1D355B]" />,
  historical_similarity: <History size={16} className="text-[#1D355B]" />,
};

const strengthColor: Record<string, string> = {
  Strong: 'bg-[#22c55e]/10 text-[#22c55e]',
  Moderate: 'bg-[#f59e0b]/10 text-[#f59e0b]',
  Weak: 'bg-gray-100 text-gray-500',
};

export default function EvidenceModal({ isOpen, onClose, evidence, atmId }: EvidenceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl border border-[#D1D5DB] w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-[#D1D5DB] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#1F2937]">Why this location?</h3>
            <p className="text-sm text-[#6B7280]">Evidence supporting prediction for {atmId || 'target ATM'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors">
            <X size={16} className="text-[#6B7280]" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
          {Object.entries(evidence).map(([key, item]) => (
            <div key={key} className="bg-[#F8F9FA] rounded-lg p-4 border border-[#D1D5DB]">
              <div className="flex items-center gap-2 mb-2">
                {iconMap[key] || <Shield size={16} />}
                <span className="font-medium text-[#1F2937]">{item.category}</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded ml-auto ${strengthColor[item.strength] || 'bg-gray-100 text-gray-500'}`}>
                  {item.strength}
                </span>
              </div>
              <p className="text-base text-[#374151] mb-1">{item.description}</p>
              <p className="text-sm text-[#6B7280] bg-white rounded p-2 mt-2 border border-[#D1D5DB]">{item.details}</p>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-[#D1D5DB]">
          <button onClick={onClose} className="w-full py-2.5 bg-[#1D4ED8] text-white text-base font-medium rounded-lg hover:bg-[#1E40AF] transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
