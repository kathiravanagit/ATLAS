import { useState } from 'react';
import { motion } from 'motion/react';
import { useDashboard } from '../context/DashboardContext';
import CasesTable from '../components/CasesTable';
import CaseDetail from '../components/CaseDetail';
import NlpComplaintTriage from '../components/NlpComplaintTriage';
import { ExternalLink } from 'lucide-react';

export default function CasesPage() {
  const { cases, prediction, selectedCaseId, handleCaseSelect, handleResolveCase, evidenceModalOpen, setEvidenceModalOpen } = useDashboard();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Case Registry</h2>
          <p className="text-base text-[#e4e4e7] mt-1">Complaints filed on cybercrime.gov.in — investigative view</p>
        </div>
        <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer"
          className="px-4 py-2 bg-white text-black text-base font-medium rounded-lg hover:bg-[#e4e4e7] transition-colors flex items-center gap-2">
          <ExternalLink size={16} /> Govt Portal
        </a>
      </div>
      <NlpComplaintTriage />
      <CasesTable cases={cases} onSelectCase={handleCaseSelect} onResolveCase={handleResolveCase} />
      {selectedCaseId && (
        <CaseDetail caseId={selectedCaseId} prediction={prediction} onShowEvidence={() => setEvidenceModalOpen(true)} onResolve={handleResolveCase} />
      )}
    </motion.div>
  );
}
