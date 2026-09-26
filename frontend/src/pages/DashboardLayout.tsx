import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNav from '../components/TopNav';
import FloatingDockNav from '../components/FloatingDockNav';
import LiveAlertToast from '../components/LiveAlertToast';
import EvidenceModal from '../components/EvidenceModal';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardDataContext } from '../context/DashboardContext';

export default function DashboardLayout({ demoMode = false }: { demoMode?: boolean }) {
  const [selectedCity, setSelectedCity] = useState('puducherry');
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const data = useDashboardData(selectedCity, demoMode ? { forceFallback: true } : undefined);
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
      <div className="min-h-screen bg-[#F8F9FA] text-[#1F2937]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[1200] focus:bg-white focus:px-3 focus:py-2 focus:rounded focus:text-sm"
        >
          Skip to main content
        </a>
        {demoMode && (
          <div className="bg-[#1D355B] px-4 md:px-6 py-1.5" role="note">
            <p className="text-center text-[10px] md:text-[11px] text-white font-semibold">
              DEMO ROUTE — explicit synthetic-data console. No live data is shown here by design.
            </p>
          </div>
        )}
        <TopNav
          selectedCity={selectedCity}
          onCityChange={setSelectedCity}
          usingFallback={data.usingFallback}
          lastUpdated={data.lastUpdated}
        />
        <main id="main-content" className="p-6 pb-32" tabIndex={-1}>
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
