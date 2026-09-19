import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNav from '../components/TopNav';
import FloatingDockNav from '../components/FloatingDockNav';
import LiveAlertToast from '../components/LiveAlertToast';
import EvidenceModal from '../components/EvidenceModal';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardDataContext } from '../context/DashboardContext';

export default function DashboardLayout() {
  const [selectedCity, setSelectedCity] = useState('puducherry');
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const data = useDashboardData(selectedCity);
  const location = useLocation();

  const activeView = (() => {
    const path = location.pathname;
    if (path === '/real') return 'overview';
    if (path.startsWith('/real/predictions')) return 'predictions';
    if (path.startsWith('/real/map')) return 'map';
    if (path.startsWith('/real/cases')) return 'cases';
    if (path.startsWith('/real/alerts')) return 'alerts';
    if (path.startsWith('/real/evidence')) return 'evidence';
    if (path.startsWith('/real/audit')) return 'audit';
    return 'overview';
  })();

  return (
    <DashboardDataContext.Provider value={{ ...data, evidenceModalOpen, setEvidenceModalOpen }}>
      <div className="min-h-screen bg-[#0a0a0f]">
        <TopNav selectedCity={selectedCity} onCityChange={setSelectedCity} />
        <main className="p-6 pb-32">
          <Outlet />
        </main>
        <FloatingDockNav activeView={activeView} />
        <LiveAlertToast />
        <EvidenceModal
          isOpen={evidenceModalOpen}
          onClose={() => setEvidenceModalOpen(false)}
          evidence={data.prediction.evidence}
          atmId={data.prediction.primary_location.atm_id}
        />
      </div>
    </DashboardDataContext.Provider>
  );
}
