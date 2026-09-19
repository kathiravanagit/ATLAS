import { Shield, Database, Lock, Eye, FileText, ExternalLink } from 'lucide-react';

export default function DataPrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Data & Privacy</h2>
        <p className="text-sm text-[#d4d4d8] mt-1">Transparency on synthetic data, compliance, and deployment approach</p>
      </div>

      {/* Why Synthetic Data */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-[#3b82f6]" />
          <h3 className="text-base font-semibold text-white">Why Synthetic Data?</h3>
        </div>
        <div className="space-y-3 text-sm text-[#d4d4d8] leading-relaxed">
          <p>
            Due to banking data privacy regulations (<strong className="text-white">RBI Act 1949</strong>,{' '}
            <strong className="text-white">NPCI Guidelines</strong>, and the{' '}
            <strong className="text-white">DPDP Act 2023</strong>), real transaction data from banks and
            payment networks cannot be used for research or hackathon prototyping without explicit regulatory sandbox approval.
          </p>
          <p>
            ATLAS uses <strong className="text-white">synthetic data calibrated to public fraud statistics</strong> from:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>RBI Annual Report on Bank Frauds (FY 2023-24)</li>
            <li>NPCI UPI Transaction Statistics</li>
            <li>Indian Cybercrime Coordination Centre (I4C) reported patterns</li>
            <li>Published academic research on ATM cash-out fraud patterns</li>
          </ul>
          <p>
            Our synthetic generator produces <strong className="text-white">200,000+ training transactions</strong> across{' '}
            <strong className="text-white">400 ATMs in 8 Indian cities</strong> with a ~1.5-3.5% fraud rate —
            consistent with RBI-reported figures for digital payment fraud.
          </p>
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a] text-xs">
            <strong className="text-white">Note:</strong> The 200k transactions are used to train the ML model offline.
            The live database stores <strong className="text-white">aggregated risk scores, ranked predictions, and case metadata</strong> —
            not raw transaction data.
          </div>
        </div>
      </div>

      {/* Compliance */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-[#22c55e]" />
          <h3 className="text-base font-semibold text-white">Compliance Framework</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { title: 'DPDP Act 2023', desc: 'Full PII encryption, consent logging, data minimization. Victim names and contacts encrypted with AES-256-GCM.', icon: Lock },
            { title: 'RBI Guidelines', desc: 'Audit trail with SHA-256 hash chain. All data access logged with officer badge, timestamp, and action type.', icon: FileText },
            { title: 'NPCI Compliance', desc: 'Transaction patterns calibrated to published NPCI fraud statistics. No real UPI data used.', icon: Database },
            { title: 'Evidence Integrity', desc: 'Merkle tree verification for tamper-evident audit logs. Blockchain-inspired chain of custody.', icon: Shield },
          ].map(item => (
            <div key={item.title} className="bg-[#0a0a0f] rounded-lg p-4 border border-[#27272a]">
              <div className="flex items-center gap-2 mb-2">
                <item.icon size={14} className="text-[#22c55e]" />
                <span className="text-sm font-medium text-white">{item.title}</span>
              </div>
              <p className="text-xs text-[#d4d4d8] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Eye size={18} className="text-[#8b5cf6]" />
          <h3 className="text-base font-semibold text-white">Production Architecture</h3>
        </div>
        <div className="space-y-3 text-sm text-[#d4d4d8] leading-relaxed">
          <p>
            ATLAS is designed to <strong className="text-white">plug into real bank APIs</strong> once regulatory
            permissions are granted. The architecture is designed to support:
          </p>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: 'Federated Learning', desc: 'Designed to train models across banks without sharing raw data' },
              { label: 'Differential Privacy', desc: 'Designed to add mathematical privacy guarantees to model outputs' },
              { label: 'Secure Multi-Party', desc: 'Designed to compute fraud scores across institutions jointly' },
            ].map(item => (
              <div key={item.label} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#27272a] text-center">
                <div className="text-xs font-medium text-white mb-1">{item.label}</div>
                <div className="text-[10px] text-[#d4d4d8]">{item.desc}</div>
              </div>
            ))}
          </div>
          <p className="mt-3">
            Current prototype runs on <strong className="text-white">PostgreSQL with PostGIS auto-detection</strong> —
            uses spatial index when available, falls back to haversine formula.{' '}
            <strong className="text-white">FastAPI</strong> for the backend, and{' '}
            <strong className="text-white">React + Leaflet</strong> for the frontend.
          </p>
        </div>
      </div>

      {/* Model Transparency */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} className="text-[#f59e0b]" />
          <h3 className="text-base font-semibold text-white">Model Transparency</h3>
        </div>
        <div className="space-y-3 text-sm text-[#d4d4d8] leading-relaxed">
          <p>
            Every prediction is accompanied by{' '}
            <strong className="text-white">SHAP explainability values</strong> and an{' '}
            <strong className="text-white">auto-generated investigative briefing</strong> that translates
            mathematical feature contributions into plain English.
          </p>
          <div className="bg-[#0a0a0f] rounded-lg p-4 border border-[#27272a] font-mono text-xs">
            <div className="text-[#22c55e] mb-2">// Example SHAP output for CC-2026-0147</div>
            <div className="space-y-1">
              <div><span className="text-[#3b82f6]">distance_from_victim_km</span>: <span className="text-[#ef4444]">+0.288</span> (highest contributor)</div>
              <div><span className="text-[#3b82f6]">suspect_proximity</span>: <span className="text-[#ef4444]">+0.104</span></div>
              <div><span className="text-[#3b82f6]">transaction_velocity</span>: <span className="text-[#ef4444]">+0.081</span></div>
              <div><span className="text-[#3b82f6]">amount_factor</span>: <span className="text-[#f59e0b]">+0.050</span></div>
            </div>
            <div className="mt-3 text-[#d4d4d8]">
              &gt; "Flagged High Risk (94%): Rs.48,500 moved across 6 mule hops within 4 hours.
              ATM-027 selected based on proximity (2.6 km) and historical 82% cash-out frequency."
            </div>
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ExternalLink size={18} className="text-[#06b6d4]" />
          <h3 className="text-base font-semibold text-white">Public Data Sources</h3>
        </div>
        <div className="space-y-2 text-sm text-[#d4d4d8]">
          {[
            { name: 'RBI Annual Report 2023-24 — Bank Fraud Statistics', url: 'https://www.rbi.org.in' },
            { name: 'NPCI UPI Transaction Data — Monthly Statistics', url: 'https://www.npci.org.in' },
            { name: 'I4C — Indian Cybercrime Coordination Centre Reports', url: 'https://cybercrime.gov.in' },
            { name: 'OpenStreetMap — ATM Location Data for Indian Cities', url: 'https://www.openstreetmap.org' },
            { name: 'Kaggle Credit Card Fraud Dataset — Model Prototyping Reference', url: 'https://www.kaggle.com' },
          ].map(src => (
            <div key={src.name} className="flex items-center gap-2 bg-[#0a0a0f] rounded-lg px-3 py-2 border border-[#27272a]">
              <ExternalLink size={12} className="text-[#06b6d4] flex-shrink-0" />
              <span className="text-xs">{src.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
