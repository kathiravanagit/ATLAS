import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Boxes, Pickaxe, Network, CheckCircle, XCircle, ChevronDown, ChevronUp, Hash, RefreshCw } from 'lucide-react';
import { authFetch } from '@/lib/auth';
import { can } from '@/lib/roles';

interface ChainTx {
  tx_type: string;
  tx_hash: string;
  case_id?: string;
  payload?: Record<string, unknown>;
}

interface BcBlock {
  index: number;
  timestamp_human: string;
  transactions: ChainTx[];
  tx_count: number;
  previous_hash: string;
  nonce: number;
  hash: string;
  miner: string;
  difficulty: number;
  merkle_root: string | null;
}

interface PrimaryStatus {
  node_id: string;
  height: number;
  difficulty: number;
  pending_transactions: number;
  last_block_hash: string;
  chain_valid: boolean;
  total_transactions: number;
}

interface NetworkStatus {
  node_count: number;
  consensus_reached: boolean;
  nodes: { node_id: string; height: number; chain_valid: boolean }[];
}

interface ConsensusResult {
  consensus: boolean;
  winner?: string;
  agreed_height?: number;
  reason?: string;
}

export default function BlockchainPanel() {
  const [blocks, setBlocks] = useState<BcBlock[]>([]);
  const [status, setStatus] = useState<PrimaryStatus | null>(null);
  const [net, setNet] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [mining, setMining] = useState(false);
  const [consensusRunning, setConsensusRunning] = useState(false);
  const [consensusResult, setConsensusResult] = useState<ConsensusResult | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const [chainRes, statusRes] = await Promise.all([
        authFetch('/api/blockchain/chain'),
        authFetch('/api/blockchain/status'),
      ]);
      if (chainRes.ok) {
        const data = await chainRes.json();
        setBlocks(data.chain ?? []);
        setValidation(data.validation);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data.primary);
        setNet(data.network);
      }
    } catch {
      // offline / backend down — keep prior state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const handleMine = async () => {
    setMining(true);
    try {
      const res = await authFetch('/api/blockchain/mine', { method: 'POST' });
      if (!res.ok) {
        setConsensusResult({ consensus: false, reason: `Mine failed (HTTP ${res.status})` });
      }
      await load();
    } finally {
      setMining(false);
    }
  };

  const handleConsensus = async () => {
    setConsensusRunning(true);
    setConsensusResult(null);
    try {
      const res = await authFetch('/api/blockchain/consensus', { method: 'POST' });
      if (res.ok) setConsensusResult(await res.json());
      else setConsensusResult({ consensus: false, reason: `Consensus failed (HTTP ${res.status})` });
      await load();
    } finally {
      setConsensusRunning(false);
    }
  };

  const trunc = (h: string | null | undefined) =>
    h ? `${h.slice(0, 10)}…${h.slice(-8)}` : '';

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Boxes size={16} className="text-[#1D4ED8]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Blockchain Evidence Ledger</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-[#F3F4F6] rounded animate-pulse w-1/3" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-[#F3F4F6] rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Boxes size={16} className="text-[#1D4ED8]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Blockchain Evidence Ledger</h3>
          <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded font-mono">
            PoW · SHA-256 · prototype
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
          {validation ? (
            validation.valid ? (
              <span className="flex items-center gap-1 text-[#15803D]">
                <CheckCircle size={12} /> Chain valid
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#B91C1C]">
                <XCircle size={12} /> Chain invalid
              </span>
            )
          ) : null}
          <button
            onClick={load}
            className="p-1 rounded hover:bg-[#F3F4F6] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-[#6B7280] mb-4">
        Prototype proof-of-work ledger — nodes are simulated in-process. A production
        deployment would anchor evidence to an institutionally governed shared ledger.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-[#F8F9FA] border border-[#D1D5DB] rounded-lg p-2.5">
          <div className="text-[10px] text-[#6B7280] uppercase tracking-wider">Height</div>
          <div className="text-lg font-bold text-[#1F2937] font-mono">{status?.height ?? blocks.length}</div>
        </div>
        <div className="bg-[#F8F9FA] border border-[#D1D5DB] rounded-lg p-2.5">
          <div className="text-[10px] text-[#6B7280] uppercase tracking-wider">Difficulty</div>
          <div className="text-lg font-bold text-[#1F2937] font-mono">{status?.difficulty ?? '—'}</div>
        </div>
        <div className="bg-[#F8F9FA] border border-[#D1D5DB] rounded-lg p-2.5">
          <div className="text-[10px] text-[#6B7280] uppercase tracking-wider">Pending</div>
          <div className="text-lg font-bold text-[#1F2937] font-mono">{status?.pending_transactions ?? 0}</div>
        </div>
        <div className="bg-[#F8F9FA] border border-[#D1D5DB] rounded-lg p-2.5">
          <div className="text-[10px] text-[#6B7280] uppercase tracking-wider">Nodes</div>
          <div className="text-lg font-bold text-[#1F2937] font-mono">{net?.node_count ?? 0}</div>
        </div>
      </div>

      {/* Actions — consensus operations need inspector/admin authority */}
      {can('blockchain.operate') && (
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={handleMine}
          disabled={mining || (status?.pending_transactions ?? 0) === 0}
          className="px-3 py-1.5 bg-[#1D4ED8] text-white text-[11px] font-medium rounded hover:bg-[#1D355B] disabled:opacity-50 transition-colors flex items-center gap-1"
        >
          <Pickaxe size={12} />
          {mining ? 'Mining…' : 'Mine Pending'}
        </button>
        <button
          onClick={handleConsensus}
          disabled={consensusRunning}
          className="px-3 py-1.5 bg-[#F3F4F6] text-[#1F2937] text-[11px] font-medium rounded hover:bg-[#E5E7EB] disabled:opacity-50 transition-colors flex items-center gap-1"
        >
          <Network size={12} />
          {consensusRunning ? 'Running consensus…' : 'Run Consensus'}
        </button>
        <span className="text-[11px] text-[#6B7280]">
          {net?.consensus_reached
            ? 'All nodes on same head'
            : 'Nodes diverged — run consensus'}
        </span>
      </div>
      )}

      {consensusResult && (
        <div
          className={`mb-4 p-2.5 rounded text-[11px] flex items-center gap-2 ${
            consensusResult.consensus
              ? 'bg-[#15803D]/10 text-[#15803D]'
              : 'bg-[#B91C1C]/10 text-[#B91C1C]'
          }`}
        >
          {consensusResult.consensus ? <CheckCircle size={12} /> : <XCircle size={12} />}
          {consensusResult.consensus
            ? `Consensus reached — winner ${consensusResult.winner} (height ${consensusResult.agreed_height})`
            : consensusResult.reason ?? 'Consensus failed'}
        </div>
      )}

      {/* Node list */}
      {net && net.nodes.length > 0 && (
        <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB] mb-4">
          <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-2">Network Nodes</div>
          <div className="grid grid-cols-3 gap-2">
            {net.nodes.map(n => (
              <div key={n.node_id} className="text-[11px] flex items-center justify-between bg-white border border-[#E5E7EB] rounded px-2 py-1.5">
                <span className="font-mono text-[#374151] truncate">{n.node_id}</span>
                <span className={`flex items-center gap-1 ${n.chain_valid ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>
                  h={n.height}
                  {n.chain_valid ? <CheckCircle size={10} /> : <XCircle size={10} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocks */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto">
        {blocks.length === 0 && (
          <div className="text-center py-8 text-[11px] text-[#6B7280]">
            No blocks yet. Anchor evidence to mine the first transaction.
          </div>
        )}
        {[...blocks].reverse().map((block, i) => (
          <motion.div
            key={block.index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="bg-[#F8F9FA] rounded-lg border border-[#D1D5DB] overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === block.index ? null : block.index)}
              className="w-full flex items-center gap-3 p-3 hover:bg-[#EFF6FF] transition-colors"
            >
              <div className="w-7 h-7 rounded bg-[#1D4ED8]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-mono text-[#1D4ED8]">#{block.index}</span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#1F2937] font-medium">
                    {block.tx_count} tx{block.tx_count === 1 ? '' : 's'}
                  </span>
                  <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded font-mono">
                    {block.miner}
                  </span>
                </div>
                <div className="text-[11px] text-[#6B7280] mt-0.5">{block.timestamp_human}</div>
              </div>
              <div className="flex items-center gap-2">
                <Hash size={10} className="text-[#6B7280]" />
                <span className="text-[11px] text-[#6B7280] font-mono">{trunc(block.hash)}</span>
              </div>
              {expanded === block.index ? (
                <ChevronUp size={12} className="text-[#6B7280]" />
              ) : (
                <ChevronDown size={12} className="text-[#6B7280]" />
              )}
            </button>

            {expanded === block.index && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="border-t border-[#D1D5DB] p-3 space-y-2"
              >
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[#6B7280]">Nonce: </span>
                    <span className="text-[#4B5563] font-mono">{block.nonce}</span>
                  </div>
                  <div>
                    <span className="text-[#6B7280]">Difficulty: </span>
                    <span className="text-[#4B5563] font-mono">{block.difficulty}</span>
                  </div>
                </div>
                <div className="text-[11px]">
                  <span className="text-[#6B7280]">Previous: </span>
                  <span className="text-[#6B7280] font-mono break-all">{trunc(block.previous_hash)}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-[#6B7280]">Hash: </span>
                  <span className="text-[#1D355B] font-mono break-all">{block.hash}</span>
                </div>
                {block.merkle_root && (
                  <div className="text-[11px]">
                    <span className="text-[#6B7280]">Merkle root: </span>
                    <span className="text-[#1D4ED8] font-mono break-all">{block.merkle_root}</span>
                  </div>
                )}
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] text-[#6B7280] uppercase tracking-wider">Transactions</div>
                  {block.transactions.map((tx, ti) => (
                    <div key={tx.tx_hash} className="bg-white border border-[#E5E7EB] rounded px-2 py-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#1F2937] font-medium">{tx.tx_type}</span>
                        <span className="text-[#6B7280] font-mono">{trunc(tx.tx_hash)}</span>
                      </div>
                      {tx.case_id && (
                        <div className="text-[#6B7280] mt-0.5">case: {tx.case_id}</div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
