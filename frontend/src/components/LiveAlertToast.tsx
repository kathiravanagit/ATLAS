import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Volume2, VolumeX, X } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

interface LiveAlertToastProps {
  onAlert?: (alert: Record<string, unknown>) => void;
}

const MUTE_KEY = 'atlas_alert_muted';

function playSiren(ctx: AudioContext) {
  // Two-tone siren, generated in code — no audio assets. Short and urgent.
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.05);
  for (let i = 0; i < 3; i++) {
    osc.frequency.setValueAtTime(660, t0 + i * 0.5);
    osc.frequency.setValueAtTime(880, t0 + i * 0.5 + 0.25);
  }
  gain.gain.setValueAtTime(0.25, t0 + 1.45);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 1.65);
}

export default function LiveAlertToast({ onAlert }: LiveAlertToastProps) {
  const { connected, lastMessage } = useWebSocket('/ws/alerts');
  const [toasts, setToasts] = useState<Record<string, unknown>[]>([]);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
  });
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Browsers block audio until the user interacts once — unlock on first gesture.
  useEffect(() => {
    const unlock = () => {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        if (!audioRef.current) audioRef.current = new AC();
        if (audioRef.current.state === 'suspended') void audioRef.current.resume();
      } catch { /* audio unsupported — toasts still render */ }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'alert') {
      setToasts(prev => [...prev.slice(-4), lastMessage]);
      onAlert?.(lastMessage);
      if (!mutedRef.current && audioRef.current) {
        try { playSiren(audioRef.current); } catch { /* never break the toast */ }
      }
    }
  }, [lastMessage, onAlert]);

  const toggleMute = () => {
    setMuted(prev => {
      const next = !prev;
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      if (next && audioRef.current) void audioRef.current.suspend().catch(() => {});
      if (!next && audioRef.current) void audioRef.current.resume().catch(() => {});
      return next;
    });
  };

  const dismiss = (idx: number) => {
    setToasts(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed top-20 right-4 z-[9998] w-[340px] space-y-2 pointer-events-none">
      <div className="flex justify-end">
        <button
          onClick={toggleMute}
          title={muted ? 'Unmute alert sound' : 'Mute alert sound'}
          aria-label={muted ? 'Unmute alert sound' : 'Mute alert sound'}
          className="pointer-events-auto w-8 h-8 rounded-full bg-white/90 backdrop-blur border border-[#D1D5DB] flex items-center justify-center text-[#6B7280] hover:text-[#1F2937] shadow"
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
      <AnimatePresence>
        {toasts.map((toast, i) => (
          <motion.div
            key={`${toast.case_id}-${i}`}
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="pointer-events-auto bg-white border border-[#D1D5DB] rounded-xl p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#B91C1C]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle size={16} className="text-[#B91C1C]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-[#B91C1C]">HIGH-RISK ALERT</span>
                  {!connected && (
                    <span className="text-[11px] text-[#B45309] bg-[#B45309]/10 px-1.5 py-0.5 rounded">OFFLINE</span>
                  )}
                </div>
                <div className="text-sm text-[#1F2937] truncate">{String(toast.message || 'New alert')}</div>
                <div className="text-[10px] text-[#6B7280] mt-1 font-mono">{String(toast.case_id || '')}</div>
              </div>
              <button onClick={() => dismiss(i)} className="text-[#6B7280] hover:text-[#1F2937] transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
