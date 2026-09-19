import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { Network, AlertTriangle, Info } from 'lucide-react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, Simulation, SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import { authFetch } from '@/lib/auth';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  risk: string;
  case: string;
  balance: number;
  cluster: number | null;
  risk_level?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  amount: number;
  timestamp: string;
}

interface GraphCluster {
  cluster_id: number;
  size: number;
  accounts: string[];
  total_flow: number;
  total_transactions: number;
  risk_level: string;
  top_nodes: { account: string; centrality: number }[];
}

interface MuleNetworkData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  suspicious_accounts: string[];
  total_nodes: number;
  total_edges: number;
  graph_density: number;
}

const CLUSTER_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e', '#ec4899', '#06b6d4', '#f97316'];

export default function MuleNetworkGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation<GraphNode, SimulationLinkDatum<GraphNode>> | null>(null);
  const [data, setData] = useState<MuleNetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    authFetch('/api/model/mule-network')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Initialize d3-force simulation
  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    if (!parent) return;

    const w = parent.clientWidth;
    const h = 420;
    canvas.width = w;
    canvas.height = h;

    const nodes: GraphNode[] = data.nodes.map(n => ({
      ...n,
      x: w / 2 + (Math.random() - 0.5) * w * 0.5,
      y: h / 2 + (Math.random() - 0.5) * h * 0.5,
    }));
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const links: SimulationLinkDatum<GraphNode>[] = data.edges
      .filter(e => nodeMap.has(e.source as string) && nodeMap.has(e.target as string))
      .map(e => ({
        source: e.source as string,
        target: e.target as string,
        weight: e.weight,
      }));

    nodesRef.current = nodes;

    const sim = forceSimulation<GraphNode>(nodes)
      .force('link', forceLink<GraphNode, SimulationLinkDatum<GraphNode>>(links)
        .id(d => d.id)
        .distance(120)
        .strength(d => (d as any).weight * 0.3))
      .force('charge', forceManyBody<GraphNode>()
        .strength(-400)
        .distanceMax(350))
      .force('center', forceCenter<GraphNode>(w / 2, h / 2))
      .force('collide', forceCollide<GraphNode>().radius(20))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simRef.current = sim;

    // Render loop
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < w; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Edges
      links.forEach(link => {
        const src = link.source as unknown as GraphNode;
        const tgt = link.target as unknown as GraphNode;
        if (!src || !tgt) return;

        const isHighlighted = hoveredNode === src.id || hoveredNode === tgt.id;
        const mx = (src.x! + tgt.x!) / 2;
        const my = (src.y! + tgt.y!) / 2 - 15;

        ctx.beginPath();
        ctx.moveTo(src.x!, src.y!);
        ctx.quadraticCurveTo(mx, my, tgt.x!, tgt.y!);

        ctx.strokeStyle = isHighlighted ? 'rgba(239,68,68,0.8)' : 'rgba(39,39,42,0.8)';
        ctx.lineWidth = isHighlighted ? 2.5 : Math.max(1, (link as any).weight * 2);
        ctx.stroke();

        // Arrow
        const angle = Math.atan2(tgt.y! - my, tgt.x! - mx);
        const arrLen = 7;
        ctx.beginPath();
        ctx.moveTo(tgt.x! - arrLen * Math.cos(angle - 0.35), tgt.y! - arrLen * Math.sin(angle - 0.35));
        ctx.lineTo(tgt.x!, tgt.y!);
        ctx.lineTo(tgt.x! - arrLen * Math.cos(angle + 0.35), tgt.y! - arrLen * Math.sin(angle + 0.35));
        ctx.strokeStyle = isHighlighted ? '#ef4444' : '#d4d4d8';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Nodes
      nodes.forEach(node => {
        const isHovered = hoveredNode === node.id;
        const isSelected = selectedNode?.id === node.id;
        const isSuspicious = data.suspicious_accounts.includes(node.id);
        const clusterColor = node.cluster ? CLUSTER_COLORS[(node.cluster - 1) % CLUSTER_COLORS.length] : '#d4d4d8';

        // Glow
        if (isHovered || isSelected || isSuspicious) {
          const grad = ctx.createRadialGradient(node.x!, node.y!, 0, node.x!, node.y!, 22);
          grad.addColorStop(0, isSuspicious ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.15)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, 22, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Outer ring
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, 11, 0, Math.PI * 2);
        ctx.fillStyle = isSuspicious ? '#ef4444' : clusterColor;
        ctx.fill();

        // Inner
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0a0f';
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = node.risk === 'High' ? '#ef4444' : node.risk === 'Medium' ? '#f59e0b' : '#22c55e';
        ctx.fill();

        // Label
        if (isHovered || isSelected || data.nodes.length < 25) {
          ctx.font = `${isHovered ? 'bold ' : ''}10px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = isHovered ? '#ffffff' : isSuspicious ? '#ef4444' : '#d4d4d8';
          ctx.fillText(node.id.slice(-8), node.x!, node.y! + 22);
        }
      });

      animRef.current = requestAnimationFrame(render);
    };

    sim.on('tick', render);
    animRef.current = requestAnimationFrame(render);

    const resize = () => {
      const newW = parent.clientWidth;
      canvas.width = newW;
      sim.force('center', forceCenter(newW / 2, h / 2));
      sim.alpha(0.3).restart();
    };
    window.addEventListener('resize', resize);

    return () => {
      sim.stop();
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [data, hoveredNode, selectedNode]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let found: GraphNode | null = null;
    nodesRef.current.forEach(node => {
      const dx = node.x! - x;
      const dy = node.y! - y;
      if (Math.sqrt(dx * dx + dy * dy) < 14) found = node;
    });
    setSelectedNode(found);
  }, []);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let found: string | null = null;
    nodesRef.current.forEach(node => {
      const dx = node.x! - x;
      const dy = node.y! - y;
      if (Math.sqrt(dx * dx + dy * dy) < 14) found = node.id;
    });
    setHoveredNode(found);
    canvas.style.cursor = found ? 'pointer' : 'default';
  }, []);

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Network size={16} className="text-[#8b5cf6]" />
          <h3 className="text-base font-semibold text-white">Mule Account Network</h3>
        </div>
        <div className="h-[420px] bg-[#0a0a0f] rounded-lg border border-[#27272a] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-[#8b5cf6]" />
          <h3 className="text-base font-semibold text-white">Mule Account Network</h3>
          <span className="text-[10px] text-[#d4d4d8] bg-[#27272a] px-2 py-0.5 rounded font-mono">
            {data?.total_nodes ?? 0} nodes, {data?.total_edges ?? 0} edges
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#d4d4d8]">Density: {data?.graph_density ?? 0}</span>
          {data?.suspicious_accounts && data.suspicious_accounts.length > 0 && (
            <span className="text-[10px] text-[#ef4444] bg-[#ef4444]/10 px-2 py-0.5 rounded flex items-center gap-1">
              <AlertTriangle size={10} />
              {data.suspicious_accounts.length} suspicious
            </span>
          )}
        </div>
      </div>

      <div className="relative bg-[#0a0a0f] rounded-lg border border-[#27272a] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: 420 }}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMove}
          onMouseLeave={() => setHoveredNode(null)}
        />

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-[#18181b]/90 backdrop-blur-sm rounded-lg p-2.5 border border-[#27272a] space-y-1">
          <div className="text-[9px] text-[#d4d4d8] font-medium mb-1">How to Read</div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
            <span className="text-[9px] text-[#e4e4e7]">Red = High Risk Mule Account</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span className="text-[9px] text-[#e4e4e7]">Amber = Medium Risk Account</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
            <span className="text-[9px] text-[#e4e4e7]">Green = Low Risk / Verified</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-px bg-[#71717a]" />
            <span className="text-[9px] text-[#e4e4e7]">Lines = Fund Transfers</span>
          </div>
          <div className="border-t border-[#27272a] pt-1 mt-1">
            <div className="text-[9px] text-[#d4d4d8] font-medium mb-1">Louvain Clusters</div>
          </div>
          {(data?.clusters ?? []).slice(0, 6).map((cl, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }} />
              <span className="text-[9px] text-[#e4e4e7]">
                C{cl.cluster_id}: {cl.size} accts | Rs.{(cl.total_flow / 1000).toFixed(0)}K flow ({cl.risk_level})
              </span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          <button
            onClick={() => simRef.current?.alpha(0.8).restart()}
            className="w-7 h-7 bg-[#18181b]/90 border border-[#27272a] rounded flex items-center justify-center text-[#d4d4d8] hover:text-white transition-colors"
            title="Reheat simulation"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
          </button>
        </div>
      </div>

      {/* Selected node detail */}
      {selectedNode && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a]"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white font-mono">{selectedNode.id}</div>
              <div className="text-[10px] text-[#d4d4d8]">
                Case: {selectedNode.case} | Balance: Rs.{selectedNode.balance.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedNode.cluster && (
                <span className="text-[9px] px-2 py-0.5 rounded" style={{
                  background: `${CLUSTER_COLORS[(selectedNode.cluster - 1) % CLUSTER_COLORS.length]}20`,
                  color: CLUSTER_COLORS[(selectedNode.cluster - 1) % CLUSTER_COLORS.length]
                }}>
                  Cluster {selectedNode.cluster}
                </span>
              )}
              <span className={`text-[9px] px-2 py-0.5 rounded ${
                selectedNode.risk === 'High' ? 'bg-[#ef4444]/10 text-[#ef4444]' :
                selectedNode.risk === 'Medium' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                'bg-[#22c55e]/10 text-[#22c55e]'
              }`}>
                {selectedNode.risk}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
