import { X, Shield, MapPin, Clock, GitBranch, History } from 'lucide-react';
import { EvidenceItem } from '../types';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: Record<string, EvidenceItem>;
  atmId?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  transaction_pattern: <Shield size={16} className="text-[#e4e4e7]" />,
  temporal_pattern: <Clock size={16} className="text-[#e4e4e7]" />,
  geographic_signal: <MapPin size={16} className="text-[#e4e4e7]" />,
  account_network: <GitBranch size={16} className="text-[#e4e4e7]" />,
  historical_similarity: <History size={16} className="text-[#e4e4e7]" />,
};

const strengthColor: Record<string, string> = {
  Strong: 'bg-[#22c55e]/10 text-[#22c55e]',
  Moderate: 'bg-[#f59e0b]/10 text-[#f59e0b]',
  Weak: 'bg-[#27272a] text-[#d4d4d8]',
};

export default function EvidenceModal({ isOpen, onClose, evidence, atmId }: EvidenceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#18181b] rounded-xl border border-[#27272a] w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Why this location?</h3>
            <p className="text-sm text-[#d4d4d8]">Evidence supporting prediction for {atmId || 'target ATM'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#27272a] transition-colors">
            <X size={16} className="text-[#d4d4d8]" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
          {Object.entries(evidence).map(([key, item]) => (
            <div key={key} className="bg-[#0a0a0f] rounded-lg p-4 border border-[#27272a]">
              <div className="flex items-center gap-2 mb-2">
                {iconMap[key] || <Shield size={16} />}
                <span className="font-medium text-white">{item.category}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ml-auto ${strengthColor[item.strength] || 'bg-[#27272a] text-[#d4d4d8]'}`}>
                  {item.strength}
                </span>
              </div>
              <p className="text-base text-[#e4e4e7] mb-1">{item.description}</p>
              <p className="text-sm text-[#d4d4d8] bg-[#18181b] rounded p-2 mt-2 border border-[#27272a]">{item.details}</p>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-[#27272a]">
          <button onClick={onClose} className="w-full py-2.5 bg-white text-black text-base font-medium rounded-lg hover:bg-[#e4e4e7] transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
