import { useState } from 'react';
import { Case, Prediction, EvidenceItem } from '../types';
import { User, Phone, FileText, MapPin, Clock, AlertTriangle, ChevronRight, ExternalLink, Shield, Activity, GitBranch, History, CheckCircle, Circle, Eye, EyeOff, KeyRound } from 'lucide-react';
import ResolutionModal from './ResolutionModal';
import { authFetch } from '../lib/auth';

interface CaseDetailProps {
  caseId: string;
  prediction: Prediction;
  onShowEvidence: () => void;
  onResolve: (caseId: string) => void;
}

const evidenceIcons: Record<string, React.ReactNode> = {
  transaction_pattern: <Activity size={14} className="text-[#e4e4e7]" />,
  temporal_pattern: <Clock size={14} className="text-[#e4e4e7]" />,
  geographic_signal: <MapPin size={14} className="text-[#e4e4e7]" />,
  account_network: <GitBranch size={14} className="text-[#e4e4e7]" />,
  historical_similarity: <History size={14} className="text-[#e4e4e7]" />,
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: "New", color: "bg-[#3b82f6]/10 text-[#3b82f6]", icon: <Circle size={12} /> },
  investigating: { label: "Investigating", color: "bg-[#f59e0b]/10 text-[#f59e0b]", icon: <AlertTriangle size={12} /> },
  resolved: { label: "Resolved", color: "bg-[#22c55e]/10 text-[#22c55e]", icon: <CheckCircle size={12} /> },
};

const MOCK_CASES: Record<string, { victim_name: string; contact: string; description: string }> = {
  "CC-2026-0147": {
    victim_name: "Rajesh Kumar",
    contact: "+91-9876543210",
    description: "Unauthorized UPI transaction of ₹48,500 detected. Funds moved through 3 mule accounts within 4 hours. Complaint filed on cybercrime.gov.in. Suspected insider involvement at bank branch.",
  },
  "CC-2026-0142": {
    victim_name: "Priya Sharma",
    contact: "+91-9876543211",
    description: "Credit card cloned at unknown ATM. Two unauthorized withdrawals totaling ₹21,700. Card details skimmed during visit to Puducherry area.",
  },
  "CC-2026-0139": {
    victim_name: "Amit Patel",
    contact: "+91-9876543212",
    description: "Fake investment scheme promising 30% returns. Victim transferred ₹76,200 over 3 weeks. Funds layered through 5 accounts before cash-out attempts.",
  },
  "CC-2026-0135": {
    victim_name: "Sneha Reddy",
    contact: "+91-9876543213",
    description: "Phishing email led to credential theft. ₹33,100 transferred to unknown account. Case resolved — funds recovered via inter-bank coordination.",
  },
  "CC-2026-0128": {
    victim_name: "Vikram Singh",
    contact: "+91-9876543214",
    description: "Stolen identity used for 4 bank transfers totaling ₹89,400. KYC documents forged. Linked accounts being monitored.",
  },
};

function maskName(name: string): string {
  if (!name || name === 'Unknown') return '***';
  return name.charAt(0) + '*'.repeat(Math.max(0, name.length - 2)) + name.charAt(name.length - 1);
}

function maskContact(contact: string): string {
  if (!contact || contact === 'N/A') return '***';
  if (contact.startsWith('+91')) {
    return '+91-*****' + contact.slice(-5);
  }
  return contact.slice(0, 3) + '****' + contact.slice(-4);
}

export default function CaseDetail({ caseId, prediction, onShowEvidence, onResolve }: CaseDetailProps) {
  const [piiRevealed, setPiiRevealed] = useState(false);
  const [reauthPin, setReauthPin] = useState('');
  const [showReauth, setShowReauth] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);

  const info = MOCK_CASES[caseId] || { victim_name: "Unknown", contact: "N/A", description: "No details available" };
  const evidence = Object.entries(prediction.evidence);
  const p = prediction.primary_location;

  const handleDecrypt = async () => {
    if (reauthPin === '1234') {
      setPiiRevealed(true);
      setShowReauth(false);
      setReauthPin('');
      try {
        await authFetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'PII Decryption', details: `PII decrypted for case ${caseId} by officer`, action_type: 'security', case_id: caseId }),
        });
      } catch {}
    } else {
      alert('Invalid PIN. Use 1234 for demo.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Case Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono font-bold text-lg text-white">{caseId}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1 ${statusConfig.investigating.color}`}>
                {statusConfig.investigating.icon} Investigating
              </span>
            </div>
            <p className="text-sm text-[#d4d4d8]">Filed on cybercrime.gov.in</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://cybercrime.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#27272a] text-sm text-[#e4e4e7] rounded-lg hover:bg-[#71717a] transition-colors flex items-center gap-1"
            >
              <ExternalLink size={10} /> Govt Portal
            </a>
            <button
              onClick={() => setResolutionOpen(true)}
              className="px-3 py-1.5 bg-[#8b5cf6]/10 text-sm text-[#8b5cf6] rounded-lg hover:bg-[#8b5cf6]/20 transition-colors flex items-center gap-1"
            >
              <CheckCircle size={10} /> Record Resolution
            </button>
            <button
              onClick={() => onResolve(caseId)}
              className="px-3 py-1.5 bg-[#22c55e]/10 text-sm text-[#22c55e] rounded-lg hover:bg-[#22c55e]/20 transition-colors flex items-center gap-1"
            >
              <CheckCircle size={10} /> Mark Resolved
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a]">
            <div className="text-[10px] text-[#d4d4d8] uppercase mb-1">Crime Type</div>
            <div className="text-base font-medium text-white">UPI Fraud</div>
          </div>
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a]">
            <div className="text-[10px] text-[#d4d4d8] uppercase mb-1">Amount</div>
            <div className="text-base font-medium text-white">₹48,500</div>
          </div>
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a]">
            <div className="text-[10px] text-[#d4d4d8] uppercase mb-1">Linked Accounts</div>
            <div className="text-base font-medium text-white">3</div>
          </div>
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a]">
            <div className="text-[10px] text-[#d4d4d8] uppercase mb-1">Current Risk</div>
            <div className="text-base font-medium text-[#ef4444]">High</div>
          </div>
        </div>
      </div>

      {/* Victim Info - PII Protected */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <User size={14} /> Victim Information
          </h3>
          <div className="flex items-center gap-2">
            {!piiRevealed ? (
              <button
                onClick={() => setShowReauth(true)}
                className="px-2 py-1 bg-[#f59e0b]/10 text-[10px] text-[#f59e0b] rounded flex items-center gap-1 hover:bg-[#f59e0b]/20 transition-colors"
              >
                <KeyRound size={10} /> Decrypt PII for FIR
              </button>
            ) : (
              <button
                onClick={() => setPiiRevealed(false)}
                className="px-2 py-1 bg-[#27272a] text-[10px] text-[#d4d4d8] rounded flex items-center gap-1 hover:bg-[#3f3f46] transition-colors"
              >
                <EyeOff size={10} /> Mask PII
              </button>
            )}
          </div>
        </div>

        {showReauth && (
          <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-lg p-3 mb-3">
            <p className="text-xs text-[#f59e0b] mb-2">Re-authenticate to view PII (DPDP Act 2023 compliance)</p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={reauthPin}
                onChange={e => setReauthPin(e.target.value)}
                placeholder="Enter inspector PIN"
                className="px-3 py-1.5 bg-[#0a0a0f] border border-[#27272a] rounded text-sm text-white focus:outline-none focus:border-[#f59e0b]"
              />
              <button onClick={handleDecrypt} className="px-3 py-1.5 bg-[#f59e0b] text-black text-xs font-medium rounded hover:bg-[#d97706]">
                Verify
              </button>
              <button onClick={() => setShowReauth(false)} className="px-3 py-1.5 bg-[#27272a] text-xs text-[#d4d4d8] rounded hover:bg-[#3f3f46]">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] text-[#d4d4d8] uppercase mb-1">Name</div>
            <div className="text-base text-[#e4e4e7] flex items-center gap-2">
              {piiRevealed ? info.victim_name : maskName(info.victim_name)}
              {!piiRevealed && <EyeOff size={10} className="text-[#71717a]" />}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#d4d4d8] uppercase mb-1">Contact</div>
            <div className="text-base text-[#e4e4e7] flex items-center gap-2">
              {piiRevealed ? info.contact : maskContact(info.contact)}
              {!piiRevealed && <EyeOff size={10} className="text-[#71717a]" />}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#d4d4d8] uppercase mb-1">Filed Via</div>
            <div className="text-base text-[#e4e4e7] flex items-center gap-1">
              <ExternalLink size={10} /> cybercrime.gov.in
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[10px] text-[#d4d4d8] uppercase mb-1">Description</div>
          <p className="text-base text-[#e4e4e7] bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a]">{info.description}</p>
        </div>
      </div>

      {/* Top Prediction */}
      <div className="card p-5">
        <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
          <MapPin size={14} /> Top Predicted Location
        </h3>
        <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#27272a]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-white">{p.atm_id}</span>
              <span className="text-[#d4d4d8]">—</span>
              <span className="text-base text-[#e4e4e7]">{p.location_name}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#18181b] rounded-lg p-3 border border-[#27272a]">
              <div className="text-[10px] text-[#d4d4d8] uppercase tracking-wider mb-1">Risk Score</div>
              <div className="text-2xl font-bold text-[#ef4444]">92%</div>
              <div className="text-[10px] text-[#d4d4d8]">Critical</div>
            </div>
            <div className="bg-[#18181b] rounded-lg p-3 border border-[#27272a]">
              <div className="text-[10px] text-[#d4d4d8] uppercase tracking-wider mb-1">Time Window</div>
              <div className="text-lg font-bold text-white">{p.expected_window}</div>
              <div className="text-[10px] text-[#d4d4d8]">Expected</div>
            </div>
            <div className="bg-[#18181b] rounded-lg p-3 border border-[#27272a]">
              <div className="text-[10px] text-[#d4d4d8] uppercase tracking-wider mb-1">Distance</div>
              <div className="text-lg font-bold text-white">{p.distance}</div>
              <div className="text-[10px] text-[#d4d4d8]">From center</div>
            </div>
          </div>
        </div>
      </div>

      {/* Evidence */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Shield size={14} /> Evidence Signals ({evidence.length})
          </h3>
          <button
            onClick={onShowEvidence}
            className="text-[10px] text-white bg-[#27272a] hover:bg-[#71717a] px-2 py-1 rounded transition-colors flex items-center gap-1"
          >
            Full View <ChevronRight size={10} />
          </button>
        </div>
        <div className="space-y-2">
          {evidence.map(([key, item]) => (
            <div key={key} className="flex items-start gap-3 p-2.5 bg-[#0a0a0f] rounded-lg border border-[#27272a]">
              {evidenceIcons[key] || <Shield size={14} className="text-[#e4e4e7]" />}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-white">{item.category}</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded ${
                    item.strength === "Strong" ? "bg-[#22c55e]/10 text-[#22c55e]" :
                    item.strength === "Moderate" ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                    "bg-[#27272a] text-[#d4d4d8]"
                  }`}>
                    {item.strength}
                  </span>
                </div>
                <p className="text-[11px] text-[#d4d4d8]">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ResolutionModal
        isOpen={resolutionOpen}
        onClose={() => setResolutionOpen(false)}
        caseId={caseId}
        atmId={p.atm_id}
        locationName={p.location_name}
        riskScore={p.risk_score}
        onResolved={() => onResolve(caseId)}
      />
    </div>
  );
}
