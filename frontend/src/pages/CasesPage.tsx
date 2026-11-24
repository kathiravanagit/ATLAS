import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import CasesTable from '../components/CasesTable';
import CaseDetail from '../components/CaseDetail';
import NlpComplaintTriage from '../components/NlpComplaintTriage';
import DemoNotice from '../components/DemoNotice';
import { ExternalLink } from 'lucide-react';

export default function CasesPage() {
  const { cases, prediction, selectedCaseId, handleCaseSelect, handleResolveCase, evidenceModalOpen, setEvidenceModalOpen, loadData, predictionScope, dataMode } = useDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#1A1C1F]">Case registry</h2>
          <p className="mt-1 text-sm text-[#43474C]">Complaints across all cities · illustrative records</p>
        </div>
        <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-[#D2D1CA] bg-white px-3.5 py-2 text-sm font-medium text-[#1A1C1F] transition-colors hover:bg-[#FAFAF7]">
          <ExternalLink size={15} strokeWidth={1.6} aria-hidden="true" /> Govt portal
        </a>
      </div>
      {dataMode === 'demo' ? (
        <DemoNotice
          inline
          title="Complaint classification"
          description="Free-text complaints are classified by the backend model. The demo keeps the fixture categories untouched rather than guessing new ones."
        />
      ) : <NlpComplaintTriage />}
      <CasesTable cases={cases} onSelectCase={handleCaseSelect} onResolveCase={handleResolveCase} onCaseUpdated={loadData} />
      {predictionScope === 'case' && selectedCaseId && (
        <CaseDetail
          caseId={selectedCaseId}
          caseData={cases.find(c => c.case_id === selectedCaseId)}
          prediction={prediction}
          onShowEvidence={() => setEvidenceModalOpen(true)}
          onResolve={handleResolveCase}
        />
      )}
    </div>
  );
}
