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
    color: 'bg-[#15803D]/10 text-[#15803D] border-[#15803D]/30',
    hoverColor: 'hover:bg-[#15803D]/20',
  },
  {
    id: 'cash_recovered',
    label: 'Cash Recovered',
    description: 'Stolen funds recovered during the operation',
    icon: <CheckCircle size={18} />,
    color: 'bg-[#17406F]/10 text-[#17406F] border-[#17406F]/30',
    hoverColor: 'hover:bg-[#17406F]/20',
  },
  {
    id: 'transaction_prevented',
    label: 'Transaction Prevented',
    description: 'Cash-out attempt blocked before completion',
    icon: <Ban size={18} />,
    color: 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30',
    hoverColor: 'hover:bg-[#B45309]/20',
  },
  {
    id: 'false_positive',
    label: 'False Positive',
    description: 'No suspicious activity found. This feedback improves model accuracy.',
    icon: <ThumbsDown size={18} />,
    color: 'bg-[#B91C1C]/10 text-[#B91C1C] border-[#B91C1C]/30',
    hoverColor: 'hover:bg-[#B91C1C]/20',
  },
];

export default function ResolutionModal({ isOpen, onClose, caseId, atmId, locationName, riskScore, onResolved }: ResolutionModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [zone, setZone] = useState<boolean | null>(null);
  const [blockOk, setBlockOk] = useState<boolean | null>(null);
  const [actualLocation, setActualLocation] = useState('');

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
          was_cashout_in_predicted_zone: zone,
          block_successful: blockOk,
          actual_location: actualLocation,
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
    setZone(null);
    setBlockOk(null);
    setActualLocation('');
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
          className="bg-white border border-[#D2D1CA] rounded-2xl w-full max-w-[520px] shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {result ? (
            <div className="p-6 text-center">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                result.outcome === 'false_positive' ? 'bg-[#B45309]/10' : 'bg-[#15803D]/10'
              }`}>
                {result.outcome === 'false_positive' ? (
                  <AlertTriangle size={32} className="text-[#B45309]" />
                ) : (
                  <CheckCircle size={32} className="text-[#15803D]" />
                )}
              </div>
              <h3 className="text-[15px] font-semibold text-[#1A1C1F] mb-2">Outcome Recorded</h3>
              <p className="text-sm text-[#5F6368] mb-4">
                {result.outcome.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} for case {caseId}
              </p>
              {result.model_recalibrated && (
                <div className="bg-[#B45309]/10 border border-[#B45309]/30 rounded-lg p-3 mb-4">
                  <p className="text-xs text-[#B45309]">
                    Model recalibration triggered. False positive feedback will be incorporated into the next training cycle.
                  </p>
                </div>
              )}
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-[#17406F] text-white text-sm rounded-lg hover:bg-[#1E40AF] transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-5 border-b border-[#D2D1CA]">
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1C1F]">Field Resolution</h3>
                  <p className="text-xs text-[#5F6368] mt-0.5">Record ground truth for {caseId}</p>
                </div>
                <button onClick={handleClose} className="p-1 rounded-lg hover:bg-[#EFEFEA] transition-colors">
                  <X size={16} className="text-[#5F6368]" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-[#F6F6F3] rounded-lg p-3 border border-[#D2D1CA] flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[#5F6368]">Target ATM</div>
                    <div className="text-sm font-medium text-[#1A1C1F]">{atmId} — {locationName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#5F6368]">Risk Score</div>
                    <div className={`text-[15px] font-semibold ${riskScore > 70 ? 'text-[#B91C1C]' : riskScore > 45 ? 'text-[#B45309]' : 'text-[#15803D]'}`}>
                      {riskScore}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#5F6368]  mb-2">Select Outcome</div>
                  <div className="grid grid-cols-2 gap-2">
                    {OUTCOMES.map(outcome => (
                      <button
                        key={outcome.id}
                        onClick={() => setSelected(outcome.id)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          selected === outcome.id
                            ? `${outcome.color} border-current`
                            : `bg-[#F6F6F3] border-[#D2D1CA] ${outcome.hoverColor}`
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {outcome.icon}
                          <span className="text-xs font-medium text-[#1A1C1F]">{outcome.label}</span>
                        </div>
                        <p className="text-[10px] text-[#5F6368]">{outcome.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#5F6368]  mb-1">Notes (optional)</div>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Additional details about the field operation..."
                    className="w-full px-3 py-2 bg-white border border-[#D2D1CA] rounded-lg text-sm text-[#1A1C1F] placeholder-[#5F6368] focus:outline-none focus:border-[#17406F] focus:ring-1 focus:ring-[#17406F]/20 resize-none h-20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-[#33373B]">
                    Cash-out in predicted zone?
                    <select value={zone === null ? '' : String(zone)} onChange={e => setZone(e.target.value === '' ? null : e.target.value === 'true')} className="block mt-1 w-full px-2 py-1.5 bg-white border border-[#D2D1CA] rounded text-sm text-[#1A1C1F]">
                      <option value="">Unknown</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                  <label className="text-xs text-[#33373B]">
                    Block successful?
                    <select value={blockOk === null ? '' : String(blockOk)} onChange={e => setBlockOk(e.target.value === '' ? null : e.target.value === 'true')} className="block mt-1 w-full px-2 py-1.5 bg-white border border-[#D2D1CA] rounded text-sm text-[#1A1C1F]">
                      <option value="">Unknown</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                </div>
                <div>
                  <div className="text-xs text-[#5F6368]  mb-1">Actual location (optional)</div>
                  <input
                    value={actualLocation}
                    onChange={e => setActualLocation(e.target.value)}
                    placeholder="Where activity was actually seen"
                    className="w-full px-3 py-2 bg-white border border-[#D2D1CA] rounded-lg text-sm text-[#1A1C1F] placeholder-[#5F6368] focus:outline-none focus:border-[#17406F]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-5 border-t border-[#D2D1CA]">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-[#EFEFEA] text-sm text-[#1A1C1F] rounded-lg hover:bg-[#E2E1DB] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selected || submitting}
                  className="px-4 py-2 bg-[#17406F] text-sm text-white rounded-lg hover:bg-[#17406F] disabled:opacity-50 transition-colors flex items-center gap-2"
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
