import { Shield, Database, Lock, Eye, FileText, ExternalLink } from 'lucide-react';

export default function DataPrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1F2937]">Data & Privacy</h2>
        <p className="text-sm text-[#6B7280] mt-1">Synthetic data, prototype controls, and requirements before deployment</p>
      </div>

      {/* Why Synthetic Data */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-[#3b82f6]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Why Synthetic Data?</h3>
        </div>
        <div className="space-y-3 text-sm text-[#6B7280] leading-relaxed">
          <p>
            This prototype uses synthetic fixtures and generated model inputs, not live banking or government records.
            Any use of real personal or financial data would require an appropriate legal basis, permissions,
            security review, and assessment of applicable privacy and banking requirements.
          </p>
          <p>
            Calibration to public fraud statistics has not been verified. Public references that could inform a future documented evaluation include:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>RBI Annual Report on Bank Frauds (FY 2023-24)</li>
            <li>NPCI UPI Transaction Statistics</li>
            <li>Indian Cybercrime Coordination Centre (I4C) reported patterns</li>
            <li>Published academic research on ATM cash-out fraud patterns</li>
          </ul>
          <p>
            Dataset size, class balance, and geographic coverage depend on the generated artifacts.
            Use supplied model metadata where available; this page does not establish representative fraud rates or operational accuracy.
          </p>
          <div className="bg-white rounded-lg p-3 border border-[#D1D5DB] text-xs">
            <strong className="text-[#1F2937]">Note:</strong> Offline model artifacts and the API-connected prototype database serve different purposes.
            The database can store synthetic transaction records, case metadata, prediction snapshots, alerts, and audit records.
            Do not enter real sensitive data into this demonstration.
          </div>
        </div>
      </div>

      {/* Compliance */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-[#22c55e]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Prototype Controls — Not Legal Compliance</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { title: 'Privacy Controls', desc: 'The backend includes encryption for selected case fields. This does not establish full PII protection, consent management, or DPDP compliance; these require a separate assessment.', icon: Lock },
            { title: 'Audit Records', desc: 'Selected backend actions create audit records. Complete logging of every data access is not established; coverage and retention require review.', icon: FileText },
            { title: 'Synthetic Data', desc: 'No live UPI feed is connected. Calibration to public statistics and NPCI compliance have not been verified.', icon: Database },
            { title: 'Evidence Integrity', desc: 'Prototype evidence verification tools do not establish legal admissibility, a complete chain of custody, or regulatory certification.', icon: Shield },
          ].map(item => (
            <div key={item.title} className="bg-white rounded-lg p-4 border border-[#D1D5DB]">
              <div className="flex items-center gap-2 mb-2">
                <item.icon size={14} className="text-[#22c55e]" />
                <span className="text-sm font-medium text-[#1F2937]">{item.title}</span>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Eye size={18} className="text-[#8b5cf6]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Deployment Requirements</h3>
        </div>
        <div className="space-y-3 text-sm text-[#6B7280] leading-relaxed">
          <p>
            No real bank integration is implemented. Production deployment would require independently reviewed
            integrations, access controls, privacy safeguards, and operational validation. Potential future research areas, not implemented capabilities, include:
          </p>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: 'Federated Learning', desc: 'Not implemented; would require a cross-institution training protocol' },
              { label: 'Differential Privacy', desc: 'Not implemented; no mathematical privacy guarantee is provided' },
              { label: 'Secure Multi-Party', desc: 'Not implemented; would require a reviewed joint-computation protocol' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-lg p-3 border border-[#D1D5DB] text-center">
                <div className="text-xs font-medium text-[#1F2937] mb-1">{item.label}</div>
                <div className="text-[11px] text-[#6B7280]">{item.desc}</div>
              </div>
            ))}
          </div>
          <p className="mt-3">
            The prototype uses <strong className="text-[#1F2937]">FastAPI</strong> for the backend and{' '}
            <strong className="text-[#1F2937]">React + Leaflet</strong> for the frontend.
            Database capabilities depend on deployment configuration; this page does not verify production readiness.
          </p>
        </div>
      </div>

      {/* Model Transparency */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} className="text-[#f59e0b]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Model Transparency</h3>
        </div>
        <div className="space-y-3 text-sm text-[#6B7280] leading-relaxed">
          <p>
            Exact-ATM explanations depend on a stored feature snapshot and an available compatible model.
            Local SHAP, global importance fallback, and unavailable explanations are distinct states.
            Global importance is not an additive explanation of an individual prediction; risk scores are not verified calibrated probabilities.
          </p>
          <div className="bg-white rounded-lg p-4 border border-[#D1D5DB] text-sm">
            Explanation values are unavailable on this information page. Open a selected ATM's explanation to inspect
            the actual backend response, base value, units, and method. Local demo fixtures do not provide SHAP attributions.
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ExternalLink size={18} className="text-[#06b6d4]" />
          <h3 className="text-base font-semibold text-[#1F2937]">Public References — Not Verified Dataset Provenance</h3>
        </div>
        <div className="space-y-2 text-sm text-[#6B7280]">
          <p>These references are not evidence that the prototype dataset was sourced from, calibrated against, or endorsed by these organizations.</p>
          {[
            { name: 'RBI Annual Report 2023-24 — Bank Fraud Statistics', url: 'https://www.rbi.org.in' },
            { name: 'NPCI UPI Transaction Data — Monthly Statistics', url: 'https://www.npci.org.in' },
            { name: 'I4C — Indian Cybercrime Coordination Centre Reports', url: 'https://cybercrime.gov.in' },
            { name: 'OpenStreetMap — ATM Location Data for Indian Cities', url: 'https://www.openstreetmap.org' },
            { name: 'Kaggle Credit Card Fraud Dataset — Model Prototyping Reference', url: 'https://www.kaggle.com' },
          ].map(src => (
            <div key={src.name} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-[#D1D5DB]">
              <ExternalLink size={12} className="text-[#06b6d4] flex-shrink-0" />
              <span className="text-xs">{src.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
