import { X, Shield, MapPin, Clock, GitBranch, History } from 'lucide-react';
import { EvidenceItem } from '../types';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: Record<string, EvidenceItem>;
  atmId?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  transaction_pattern: <Shield size={16} className="text-[#12355B]" />,
  temporal_pattern: <Clock size={16} className="text-[#12355B]" />,
  geographic_signal: <MapPin size={16} className="text-[#12355B]" />,
  account_network: <GitBranch size={16} className="text-[#12355B]" />,
  historical_similarity: <History size={16} className="text-[#12355B]" />,
};

const strengthColor: Record<string, string> = {
  Strong: 'bg-[#15803D]/10 text-[#15803D]',
  Moderate: 'bg-[#B45309]/10 text-[#B45309]',
  Weak: 'bg-[#EFEFEA] text-[#8A8D90]',
};

export default function EvidenceModal({ isOpen, onClose, evidence, atmId }: EvidenceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl border border-[#D2D1CA] w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-[#D2D1CA] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#1A1C1F]">Why this location?</h3>
            <p className="text-sm text-[#5F6368]">Evidence supporting prediction for {atmId || 'target ATM'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#EFEFEA] transition-colors">
            <X size={16} className="text-[#5F6368]" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
          {Object.entries(evidence).map(([key, item]) => (
            <div key={key} className="bg-[#F6F6F3] rounded-lg p-4 border border-[#D2D1CA]">
              <div className="flex items-center gap-2 mb-2">
                {iconMap[key] || <Shield size={16} />}
                <span className="font-medium text-[#1A1C1F]">{item.category}</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded ml-auto ${strengthColor[item.strength] || 'bg-[#EFEFEA] text-[#8A8D90]'}`}>
                  {item.strength}
                </span>
              </div>
              <p className="text-sm text-[#33373B] mb-1">{item.description}</p>
              <p className="text-sm text-[#5F6368] bg-white rounded p-2 mt-2 border border-[#D2D1CA]">{item.details}</p>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-[#D2D1CA]">
          <button onClick={onClose} className="w-full py-2.5 bg-[#17406F] text-white text-sm font-medium rounded-lg hover:bg-[#1E40AF] transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
