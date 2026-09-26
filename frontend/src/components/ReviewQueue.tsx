import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ClipboardCheck, CheckCircle, XCircle, AlertTriangle, Clock, User, MessageSquare, ChevronDown } from 'lucide-react';
import { authFetch } from '@/lib/auth';
import { can } from '@/lib/roles';

interface ReviewItem {
  case_id: string;
  crime_type: string;
  amount: number;
  current_risk: string;
  victim_name: string;
  status: string;
  assigned_to: string;
  created_at: string;
  priority: string;
}

interface ReviewHistory {
  case_id: string;
  action: string;
  reason: string;
  reviewer_id: string;
  timestamp: string;
  previous_risk: string;
}

export default function ReviewQueue() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [history, setHistory] = useState<ReviewHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [actionForm, setActionForm] = useState<{ action: string; reason: string }>({ action: 'approve', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'Critical' | 'High' | 'Medium'>('all');

  const loadData = useCallback(() => {
    Promise.all([
      authFetch('/api/review/queue').then(r => r.ok ? r.json() : null),
      authFetch('/api/review/history').then(r => r.ok ? r.json() : null),
    ]).then(([q, h]) => {
      if (q) setQueue(q.queue || []);
      if (h) setHistory(h);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReview = async (caseId: string) => {
    if (!actionForm.reason.trim()) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/review/${caseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionForm.action,
          reason: actionForm.reason,
          reviewer_id: 'INS-001',
        }),
      });
      if (res.ok) {
        setSelectedCase(null);
        setActionForm({ action: 'approve', reason: '' });
        loadData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = queue.filter(q => filter === 'all' || q.priority === filter);

  if (loading) {
    return (
    <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck size={16} className="text-[#f59e0b]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Review Queue</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[#F3F4F6] rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-[#f59e0b]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Review Queue</h3>
          <span className="text-[10px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">{queue.length} pending</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-3">
        {(['all', 'Critical', 'High', 'Medium'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 text-[10px] rounded transition-colors ${
              filter === f
                ? 'bg-white text-[#1F2937] font-medium'
                : 'bg-[#F3F4F6] text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            {f === 'all' ? `All (${queue.length})` : f}
          </button>
        ))}
      </div>

      {/* Queue items */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-6 text-[11px] text-[#6B7280]">
            No cases pending review. All clear.
          </div>
        )}
        {filtered.map((item, i) => (
          <motion.div
            key={item.case_id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`bg-[#F8F9FA] rounded-lg border p-3 cursor-pointer transition-colors ${
              selectedCase === item.case_id ? 'border-[#f59e0b]' : 'border-[#D1D5DB] hover:border-[#9CA3AF]'
            }`}
            onClick={() => setSelectedCase(selectedCase === item.case_id ? null : item.case_id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  item.priority === 'Critical' ? 'bg-[#ef4444]' :
                  item.priority === 'High' ? 'bg-[#f59e0b]' : 'bg-[#3b82f6]'
                }`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#1F2937]">{item.case_id}</span>
                    <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{item.crime_type}</span>
                  </div>
                  <div className="text-[10px] text-[#6B7280] mt-0.5">
                    {item.victim_name} | Rs.{item.amount.toLocaleString()} | {item.current_risk}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#6B7280] flex items-center gap-1">
                  <User size={9} /> {item.assigned_to}
                </span>
                <ChevronDown size={12} className={`text-[#6B7280] transition-transform ${
                  selectedCase === item.case_id ? 'rotate-180' : ''
                }`} />
              </div>
            </div>

              {/* Action form — hidden unless the role may decide reviews */}
              {selectedCase === item.case_id && (
                can('review.decide') ? (
                <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="mt-3 pt-3 border-t border-[#D1D5DB] space-y-3"
              >
                <div className="flex gap-2">
                  {[
                    { value: 'approve', label: 'Approve', icon: <CheckCircle size={12} />, color: 'bg-[#22c55e] hover:bg-[#16a34a]' },
                    { value: 'override', label: 'Override', icon: <AlertTriangle size={12} />, color: 'bg-[#f59e0b] hover:bg-[#d97706]' },
                    { value: 'dismiss', label: 'Dismiss', icon: <XCircle size={12} />, color: 'bg-[#a1a1aa] hover:bg-[#71717a]' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setActionForm(prev => ({ ...prev, action: opt.value }))}
                      className={`flex items-center gap-1 px-3 py-1.5 text-[10px] text-[#1F2937] rounded transition-all duration-150 ${
                        actionForm.action === opt.value ? opt.color : 'bg-[#F3F4F6] hover:bg-[#71717a]'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={actionForm.reason}
                    onChange={e => setActionForm(prev => ({ ...prev, reason: e.target.value }))}
                    className="flex-1 px-2 py-1.5 bg-[#F8F9FA] border border-[#D1D5DB] rounded text-[11px] text-[#1F2937] focus:outline-none focus:border-[#71717a]"
                    placeholder="Reason for review decision..."
                  />
                  <button
                    type="button"
                    onClick={() => handleReview(item.case_id)}
                    disabled={submitting || !actionForm.reason.trim()}
                    className="px-3 py-1.5 bg-[#f59e0b] text-[#1F2937] text-[10px] font-medium rounded hover:bg-[#d97706] disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Saving...' : 'Submit'}
                  </button>
                </div>
              </motion.div>
                ) : (
                  <p className="mt-3 pt-3 border-t border-[#D1D5DB] text-[11px] text-[#6B7280]">
                    Review decisions require an inspector, analyst, or admin role.
                  </p>
                )
              )}
          </motion.div>
        ))}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-2">Recent Decisions</div>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {history.slice(-5).reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] py-1">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  h.action === 'approve' ? 'bg-[#22c55e]' :
                  h.action === 'override' ? 'bg-[#f59e0b]' : 'bg-[#d4d4d8]'
                }`} />
                <span className="text-[#6B7280] font-mono">{h.case_id}</span>
                <span className={`font-medium ${
                  h.action === 'approve' ? 'text-[#22c55e]' :
                  h.action === 'override' ? 'text-[#f59e0b]' : 'text-[#6B7280]'
                }`}>{h.action}</span>
                <span className="text-[#6B7280] truncate flex-1">{h.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
