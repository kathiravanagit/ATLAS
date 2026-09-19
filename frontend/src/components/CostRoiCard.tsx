import { useState } from 'react';
import { motion } from 'motion/react';
import { DollarSign, TrendingUp, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export default function CostRoiCard() {
  const [expanded, setExpanded] = useState(false);

  const metrics = {
    avgLeadTimeSaved: '2.3 hrs',
    falsePositiveRate: '4.2%',
    costPerAtm: '₹35,000',
    annualSavings: '₹3.8 Cr',
    roi: '8.2x',
    casesResolved: '8 of 17',
    fundsRecovered: '₹2.8 L',
    avgResponseTime: '38 min',
    fraudPreventionRate: '95.8%',
    avgFraudLossPerAtm: '₹4.2 L/yr',
  };

  return (
    <div className="card p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-[#f59e0b]" />
          <h3 className="text-base font-semibold text-white">Cost / ROI Estimation</h3>
          <span className="text-[10px] text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded font-mono">
            {metrics.roi} ROI
          </span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#d4d4d8]" /> : <ChevronDown size={14} className="text-[#d4d4d8]" />}
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
        style={{ maxHeight: expanded ? '2000px' : '0px' }}
      >
        <div className="mt-4 space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Cost / ATM / yr', value: metrics.costPerAtm, color: '#22c55e' },
              { label: 'Annual Savings', value: metrics.annualSavings, color: '#3b82f6' },
              { label: 'ROI', value: metrics.roi, color: '#f59e0b' },
              { label: 'Fraud Prevention', value: metrics.fraudPreventionRate, color: '#8b5cf6' },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a] text-center"
              >
                <div className="text-sm font-bold" style={{ color: m.color }}>{m.value}</div>
                <div className="text-[10px] text-[#d4d4d8] mt-1">{m.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Cost Breakdown */}
          <div>
            <div className="text-[10px] text-[#d4d4d8] uppercase tracking-wider mb-2">Cost Breakdown (per ATM/year)</div>
            <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a] space-y-2">
              {[
                { item: 'Cloud compute (inference)', cost: '₹12,000' },
                { item: 'Data storage & DB', cost: '₹8,000' },
                { item: 'API calls (NPCI/bank)', cost: '₹6,000' },
                { item: 'Maintenance & updates', cost: '₹5,000' },
                { item: 'Monitoring & alerting', cost: '₹4,000' },
              ].map(row => (
                <div key={row.item} className="flex items-center justify-between text-xs">
                  <span className="text-[#d4d4d8]">{row.item}</span>
                  <span className="text-white font-mono">{row.cost}</span>
                </div>
              ))}
              <div className="border-t border-[#27272a] pt-2 flex items-center justify-between text-xs font-bold">
                <span className="text-white">Total</span>
                <span className="text-[#22c55e] font-mono">{metrics.costPerAtm}</span>
              </div>
            </div>
          </div>

          {/* Operational Impact */}
          <div>
            <div className="text-[10px] text-[#d4d4d8] uppercase tracking-wider mb-2">Operational Impact</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Cases Resolved', value: metrics.casesResolved, color: '#22c55e' },
                { label: 'Funds Recovered', value: metrics.fundsRecovered, color: '#3b82f6' },
                { label: 'Avg Response Time', value: metrics.avgResponseTime, color: '#8b5cf6' },
                { label: 'Avg Fraud Loss / ATM', value: metrics.avgFraudLossPerAtm, color: '#f59e0b' },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a]">
                  <span className="text-[10px] text-[#d4d4d8]">{m.label}</span>
                  <span className="text-sm font-mono font-bold" style={{ color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scaling Projection */}
          <div>
            <div className="text-[10px] text-[#d4d4d8] uppercase tracking-wider mb-2">Scaling Projection</div>
            <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a]">
              <div className="space-y-2">
                {[
                  { scale: '50 ATMs', cost: '₹17.5 L/yr', savings: '₹2.1 Cr', roi: '12x', bar: 25 },
                  { scale: '200 ATMs', cost: '₹70 L/yr', savings: '₹8.4 Cr', roi: '12x', bar: 55 },
                  { scale: '500 ATMs', cost: '₹1.75 Cr/yr', savings: '₹21 Cr', roi: '12x', bar: 100 },
                ].map((row, i) => (
                  <div key={row.scale} className="flex items-center gap-4">
                    <div className="w-[80px] text-xs text-white font-mono">{row.scale}</div>
                    <div className="flex-1 h-4 bg-[#18181b] rounded overflow-hidden border border-[#27272a]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${row.bar}%` }}
                        transition={{ duration: 0.8, delay: i * 0.15 }}
                        className="h-full rounded bg-[#f59e0b]/30"
                      />
                    </div>
                    <div className="w-[100px] text-right text-xs font-mono text-white">{row.savings}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sources */}
          <div>
            <div className="text-[10px] text-[#d4d4d8] uppercase tracking-wider mb-2">Sources</div>
            <div className="space-y-1.5 text-[10px] text-[#d4d4d8]">
              <div className="flex items-center gap-1.5">
                <ExternalLink size={10} className="text-[#06b6d4]" />
                <span>RBI Annual Report 2023-24: Avg fraud loss per ATM ~₹3.5-5 L/yr</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ExternalLink size={10} className="text-[#06b6d4]" />
                <span>NPCI: 13.4B UPI transactions/month, 0.005% fraud rate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ExternalLink size={10} className="text-[#06b6d4]" />
                <span>I4C: Cybercrime losses ₹1.03 L Cr in FY 2023-24</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
