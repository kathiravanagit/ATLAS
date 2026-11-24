import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Volume2, VolumeX, X } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { isDemoRoute } from '@/lib/auth';

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
  // "Sound armed" — flips true once AudioContext is created and running.
  // Drives a one-shot pulse on the speaker icon so silence is never mysterious.
  const [soundArmed, setSoundArmed] = useState(false);
  const armedRef = useRef(false);
  const armedPulseTimer = useRef<ReturnType<typeof setTimeout>>();
  const [showArmedPulse, setShowArmedPulse] = useState(false);

  // Browsers block audio until the user interacts once — unlock on first gesture.
  // resume() is async: check readiness in .then(), not synchronously, or the
  // armed flag lags one interaction behind on the very first gesture.
  useEffect(() => {
    const markArmed = () => {
      const ctx = audioRef.current;
      if (ctx && ctx.state === 'running' && !armedRef.current) {
        armedRef.current = true;
        setSoundArmed(true);
        setShowArmedPulse(true);
        if (armedPulseTimer.current) clearTimeout(armedPulseTimer.current);
        armedPulseTimer.current = setTimeout(() => setShowArmedPulse(false), 1200);
      }
    };
    const unlock = () => {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        if (!audioRef.current) audioRef.current = new AC();
        const ctx = audioRef.current;
        if (ctx.state === 'suspended') {
          void ctx.resume().then(markArmed).catch(() => {});
        } else {
          markArmed();
        }
      } catch { /* audio unsupported — toasts still render */ }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      clearTimeout(armedPulseTimer.current);
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

  // Speaker button tooltip combines mute state, WS status, and audio arm state.
  // On a demo route there is already data available, so the disconnected banner
  // is noise, not a status — say what is actually true there.
  const speakerTitle = muted
    ? 'Unmute alert sound'
    : isDemoRoute()
      ? 'Demo mode — no backend connection'
      : !connected
        ? 'WebSocket disconnected — alerts will not arrive'
        : !soundArmed
          ? 'Waiting for first interaction to arm audio…'
          : 'Alert sound active';

  return (
    <div className="fixed top-20 right-4 z-[9998] w-[340px] space-y-2 pointer-events-none">
      <div className="flex justify-end">
        <button
          onClick={toggleMute}
          title={speakerTitle}
          aria-label={speakerTitle}
          className={`pointer-events-auto relative grid h-8 w-8 place-items-center rounded-lg border border-[#D2D1CA] bg-white transition-colors ${
            muted ? 'text-[#B91C1C]' : 'text-[#5F6368] hover:text-[#1A1C1F]'
          } ${showArmedPulse ? 'animate-[armed-pulse_0.6s_ease-in-out_2]' : ''}`}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          {/* WS connection status dot — green = socket open, grey = disconnected */}
          <span
            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white transition-colors ${
              connected ? 'bg-[#15803D]' : 'bg-[#8A8D90]'
            }`}
            title={connected ? 'WebSocket connected' : 'WebSocket disconnected'}
          />
        </button>
      </div>
      <AnimatePresence>
        {toasts.map((toast, i) => (
          <motion.div
            key={`${toast.case_id}-${i}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto rounded-[12px] border border-[#E2E1DB] bg-white p-3.5 shadow-[0_4px_16px_rgba(26,28,31,0.08)]"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={15} strokeWidth={1.6} className="mt-0.5 shrink-0 text-[#B91C1C]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1A1C1F]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#B91C1C]" aria-hidden="true" />
                    High-risk alert
                  </span>
                  {!connected && <span className="text-[11px] text-[#B45309]">offline</span>}
                </div>
                <div className="truncate text-[13px] text-[#43474C]">{String(toast.message || 'New alert')}</div>
                <div className="num mt-1 text-[11px] text-[#8A8D90]">{String(toast.case_id || '')}</div>
              </div>
              <button onClick={() => dismiss(i)} className="shrink-0 text-[#8A8D90] transition-colors hover:text-[#1A1C1F]">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
