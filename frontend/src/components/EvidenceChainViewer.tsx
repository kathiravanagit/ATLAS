import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link2, Shield, CheckCircle, XCircle, Clock, Hash, ChevronDown, ChevronUp, Anchor } from 'lucide-react';
import { authFetch } from '@/lib/auth';

interface EvidenceBlock {
  block_id: number;
  case_id: string;
  evidence_type: string;
  hash: string;
  content_preview: string;
  officer_id: string;
  timestamp: number;
  timestamp_human: string;
  previous_hash: string;
  block_hash: string;
}

interface EvidenceChainData {
  blocks: EvidenceBlock[];
  stats: {
    total_blocks: number;
    merkle_root: string | null;
    cases_covered: string[];
  };
}

interface AnchorForm {
  case_id: string;
  evidence_type: string;
  content: string;
  officer_id: string;
}

export default function EvidenceChainViewer() {
  const [chain, setChain] = useState<EvidenceChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);
  const [anchoring, setAnchoring] = useState(false);
  const [form, setForm] = useState<AnchorForm>({
    case_id: 'CYB-2026-001',
    evidence_type: 'transaction_log',
    content: '',
    officer_id: 'OFF-001',
  });
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);
  const [verifyBlockId, setVerifyBlockId] = useState<number>(1);
  const [verifyContent, setVerifyContent] = useState('');

  const loadChain = () => {
    authFetch('/api/evidence/chain')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setChain(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadChain(); }, []);

  const handleAnchor = async () => {
    if (!form.content.trim()) return;
    setAnchoring(true);
    try {
      const res = await authFetch('/api/evidence/anchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm(prev => ({ ...prev, content: '' }));
        loadChain();
      }
    } finally {
      setAnchoring(false);
    }
  };

  const handleVerify = async (blockId: number, content: string) => {
    try {
      const res = await authFetch(`/api/evidence/verify/${blockId}?content=${encodeURIComponent(content)}`);
      if (res.ok) {
        const data = await res.json();
        setVerifyResult(data);
        setVerifyBlockId(blockId);
        setVerifyContent(content);
      }
    } catch {}
  };

  const truncateHash = (h: string) => h ? `${h.slice(0, 8)}...${h.slice(-6)}` : '';

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Link2 size={16} className="text-[#1D4ED8]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Evidence Register & Hash Chain Verification</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-[#F3F4F6] rounded animate-pulse w-1/3"></div>
          <div className="h-8 bg-[#F3F4F6] rounded animate-pulse w-1/2"></div>
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-[#F3F4F6] rounded animate-pulse"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-[#1D4ED8]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Evidence Register & Hash Chain Verification</h3>
          <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded font-mono">
            Merkle Tree
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[#6B7280]">
          <span>{chain?.stats.total_blocks ?? 0} blocks</span>
          <span>{chain?.stats.cases_covered.length ?? 0} cases</span>
        </div>
      </div>

      {/* Merkle root */}
      {chain?.stats.merkle_root && (
        <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB] mb-4">
          <div className="text-[11px] text-[#6B7280] uppercase tracking-wider mb-1">Merkle Root</div>
          <div className="text-[11px] text-[#1D4ED8] font-mono break-all">{chain.stats.merkle_root}</div>
        </div>
      )}

      {/* Anchor new evidence */}
      <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB] mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Anchor size={12} className="text-[#1D4ED8]" />
          <span className="text-[11px] font-medium text-[#1F2937]">Anchor New Evidence</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input
            value={form.case_id}
            onChange={e => setForm(prev => ({ ...prev, case_id: e.target.value }))}
            className="px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-[11px] text-[#1F2937] focus:outline-none focus:border-[#1D4ED8]"
            placeholder="Case ID"
          />
          <select
            value={form.evidence_type}
            onChange={e => setForm(prev => ({ ...prev, evidence_type: e.target.value }))}
            className="px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-[11px] text-[#1F2937] focus:outline-none"
          >
            <option value="transaction_log">Transaction Log</option>
            <option value="call_record">Call Record</option>
            <option value="ip_log">IP Log</option>
            <option value="device_fingerprint">Device Fingerprint</option>
            <option value="screenshot">Screenshot</option>
            <option value="witness_statement">Witness Statement</option>
          </select>
          <input
            value={form.officer_id}
            onChange={e => setForm(prev => ({ ...prev, officer_id: e.target.value }))}
            className="px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-[11px] text-[#1F2937] focus:outline-none focus:border-[#1D4ED8]"
            placeholder="Officer ID"
          />
        </div>
        <div className="flex gap-2">
          <textarea
            value={form.content}
            onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
            className="flex-1 px-2 py-1.5 bg-white border border-[#D1D5DB] rounded text-[11px] text-[#1F2937] focus:outline-none focus:border-[#1D4ED8] resize-none"
            rows={2}
            placeholder="Evidence content to anchor..."
          />
          <button
            onClick={handleAnchor}
            disabled={anchoring || !form.content.trim()}
            className="px-4 py-2 bg-[#1D4ED8] text-white text-[11px] font-medium rounded hover:bg-[#1D355B] disabled:opacity-50 transition-colors flex items-center gap-1 self-end"
          >
            <Anchor size={12} />
            {anchoring ? 'Anchoring...' : 'Anchor'}
          </button>
        </div>
      </div>

      {/* Chain blocks */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {(chain?.blocks ?? []).length === 0 && (
          <div className="text-center py-8 text-[11px] text-[#6B7280]">
            No evidence anchored yet. Use the form above to anchor first evidence.
          </div>
        )}
        {(chain?.blocks ?? []).map((block, i) => (
          <motion.div
            key={block.block_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-[#F8F9FA] rounded-lg border border-[#D1D5DB] overflow-hidden"
          >
            <button
              onClick={() => setExpandedBlock(expandedBlock === block.block_id ? null : block.block_id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-[#EFF6FF] transition-colors"
            >
              <div className="w-7 h-7 rounded bg-[#1D4ED8]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-mono text-[#1D4ED8]">#{block.block_id}</span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#1F2937] font-medium">{block.evidence_type}</span>
                  <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded font-mono">{block.case_id}</span>
                </div>
                <div className="text-[11px] text-[#6B7280] mt-0.5">{block.timestamp_human}</div>
              </div>
              <div className="flex items-center gap-2">
                <Hash size={10} className="text-[#6B7280]" />
                <span className="text-[11px] text-[#6B7280] font-mono">{truncateHash(block.block_hash)}</span>
              </div>
              {expandedBlock === block.block_id ? <ChevronUp size={12} className="text-[#6B7280]" /> : <ChevronDown size={12} className="text-[#6B7280]" />}
            </button>

            {expandedBlock === block.block_id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="border-t border-[#D1D5DB] p-3 space-y-2"
              >
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[#6B7280]">Content: </span>
                    <span className="text-[#4B5563]">{block.content_preview}</span>
                  </div>
                  <div>
                    <span className="text-[#6B7280]">Officer: </span>
                    <span className="text-[#4B5563]">{block.officer_id}</span>
                  </div>
                </div>
                <div className="text-[11px]">
                  <span className="text-[#6B7280]">Evidence Hash: </span>
                  <span className="text-[#1D4ED8] font-mono break-all">{block.hash}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-[#6B7280]">Previous Hash: </span>
                  <span className="text-[#6B7280] font-mono break-all">{truncateHash(block.previous_hash)}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-[#6B7280]">Block Hash: </span>
                  <span className="text-[#1D355B] font-mono break-all">{block.block_hash}</span>
                </div>

                <button
                  onClick={() => handleVerify(block.block_id, block.content_preview)}
                  className="mt-2 px-3 py-1.5 bg-[#F3F4F6] text-[#1F2937] text-[11px] rounded hover:bg-[#E5E7EB] transition-colors flex items-center gap-1"
                >
                  <Shield size={10} /> Verify Integrity
                </button>

                {verifyResult && verifyBlockId === block.block_id && (
                  <div className={`mt-2 p-2 rounded text-[11px] flex items-center gap-2 ${
                    verifyResult.valid ? 'bg-[#15803D]/10 text-[#15803D]' : 'bg-[#B91C1C]/10 text-[#B91C1C]'
                  }`}>
                    {verifyResult.valid ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {verifyResult.valid ? 'Evidence verified — chain intact' : 'Verification failed — integrity compromised'}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
