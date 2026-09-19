import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, Ban, ShieldAlert, ThumbsDown, AlertTriangle } from 'lucide-react';
import { authFetch } from '../lib/auth';

interface ResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  atmId: string;
  locationName: string;
  riskScore: number;
  onResolved?: () => void;
}

const OUTCOMES = [
  {
    id: 'apprehended',
    label: 'Suspect Apprehended',
    description: 'Suspect caught at or near the ATM during the predicted window',
    icon: <ShieldAlert size={18} />,
    color: 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30',
    hoverColor: 'hover:bg-[#22c55e]/20',
  },
  {
    id: 'cash_recovered',
    label: 'Cash Recovered',
    description: 'Stolen funds recovered during the operation',
    icon: <CheckCircle size={18} />,
    color: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30',
    hoverColor: 'hover:bg-[#3b82f6]/20',
  },
  {
    id: 'transaction_prevented',
    label: 'Transaction Prevented',
    description: 'Cash-out attempt blocked before completion',
    icon: <Ban size={18} />,
    color: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30',
    hoverColor: 'hover:bg-[#f59e0b]/20',
  },
  {
    id: 'false_positive',
    label: 'False Positive',
    description: 'No suspicious activity found. This feedback improves model accuracy.',
    icon: <ThumbsDown size={18} />,
    color: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30',
    hoverColor: 'hover:bg-[#ef4444]/20',
  },
];

export default function ResolutionModal({ isOpen, onClose, caseId, atmId, locationName, riskScore, onResolved }: ResolutionModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const csrfRes = await authFetch('/api/csrf-token');
      const csrfData = await csrfRes.json();
      const res = await authFetch('/api/field-outcomes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.csrf_token,
        },
        body: JSON.stringify({
          case_id: caseId,
          atm_id: atmId,
          outcome: selected,
          notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        onResolved?.();
      }
    } catch {}
    setSubmitting(false);
  };

  const handleClose = () => {
    setSelected(null);
    setNotes('');
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#111111] border border-[#27272a] rounded-2xl w-full max-w-[520px] shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {result ? (
            <div className="p-6 text-center">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                result.outcome === 'false_positive' ? 'bg-[#f59e0b]/10' : 'bg-[#22c55e]/10'
              }`}>
                {result.outcome === 'false_positive' ? (
                  <AlertTriangle size={32} className="text-[#f59e0b]" />
                ) : (
                  <CheckCircle size={32} className="text-[#22c55e]" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Outcome Recorded</h3>
              <p className="text-sm text-[#d4d4d8] mb-4">
                {result.outcome.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} for case {caseId}
              </p>
              {result.model_recalibrated && (
                <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-lg p-3 mb-4">
                  <p className="text-xs text-[#f59e0b]">
                    Model recalibration triggered. False positive feedback will be incorporated into the next training cycle.
                  </p>
                </div>
              )}
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-[#27272a] text-white text-sm rounded-lg hover:bg-[#3f3f46] transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-5 border-b border-[#27272a]">
                <div>
                  <h3 className="text-base font-semibold text-white">Field Resolution</h3>
                  <p className="text-xs text-[#d4d4d8] mt-0.5">Record ground truth for {caseId}</p>
                </div>
                <button onClick={handleClose} className="p-1 rounded-lg hover:bg-[#27272a] transition-colors">
                  <X size={16} className="text-[#d4d4d8]" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a] flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[#d4d4d8]">Target ATM</div>
                    <div className="text-sm font-medium text-white">{atmId} — {locationName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#d4d4d8]">Risk Score</div>
                    <div className={`text-lg font-bold ${riskScore > 70 ? 'text-[#ef4444]' : riskScore > 45 ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>
                      {riskScore}%
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#d4d4d8] uppercase tracking-wider mb-2">Select Outcome</div>
                  <div className="grid grid-cols-2 gap-2">
                    {OUTCOMES.map(outcome => (
                      <button
                        key={outcome.id}
                        onClick={() => setSelected(outcome.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selected === outcome.id
                            ? `${outcome.color} border-current`
                            : `bg-[#0a0a0f] border-[#27272a] ${outcome.hoverColor}`
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {outcome.icon}
                          <span className="text-xs font-medium text-white">{outcome.label}</span>
                        </div>
                        <p className="text-[10px] text-[#d4d4d8]">{outcome.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#d4d4d8] uppercase tracking-wider mb-1">Notes (optional)</div>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Additional details about the field operation..."
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#27272a] rounded-lg text-sm text-white placeholder-[#71717a] focus:outline-none focus:border-[#71717a] resize-none h-20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-5 border-t border-[#27272a]">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-[#27272a] text-sm text-[#d4d4d8] rounded-lg hover:bg-[#3f3f46] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selected || submitting}
                  className="px-4 py-2 bg-[#3b82f6] text-sm text-white rounded-lg hover:bg-[#2563eb] disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={14} />
                  )}
                  Record Outcome
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
