import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

interface LiveAlertToastProps {
  onAlert?: (alert: Record<string, unknown>) => void;
}

export default function LiveAlertToast({ onAlert }: LiveAlertToastProps) {
  const { connected, lastMessage } = useWebSocket('/ws/alerts');
  const [toasts, setToasts] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'alert') {
      setToasts(prev => [...prev.slice(-4), lastMessage]);
      onAlert?.(lastMessage);
    }
  }, [lastMessage, onAlert]);

  const dismiss = (idx: number) => {
    setToasts(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed top-20 right-4 z-[9998] w-[340px] space-y-2 pointer-events-none">
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
