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
  const data = useDashboardData(selectedCity, { forceFallback: demoMode });
  const location = useLocation();
  const activeView = location.pathname.split('/')[2] || 'overview';

  return (
    <DashboardDataContext.Provider value={{ ...data, evidenceModalOpen, setEvidenceModalOpen }}>
      <div className="min-h-screen bg-[#F8F9FA] text-[#1F2937]">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[1200] focus:bg-white focus:px-3 focus:py-2 focus:rounded focus:text-sm">Skip to main content</a>
        {demoMode && <div className="bg-[#1D355B] px-4 py-2 text-center text-sm text-white" role="note">LOCAL DEMO — synthetic fixtures, no backend connection or API mutations.</div>}
        <TopNav selectedCity={selectedCity} demoMode={demoMode}
          onCityChange={(city) => { data.showCityOverview(); setSelectedCity(city); setEvidenceModalOpen(false); }}
          dataMode={data.dataMode} lastUpdated={data.lastUpdated} />
        {data.actionError && <div className="mx-6 mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {data.actionError}<button className="ml-3 underline" onClick={data.clearActionError}>Dismiss</button>
        </div>}
        <main id="main-content" className="p-4 md:p-6 pb-40 md:pb-40" tabIndex={-1}>
          {data.isLoading ? <div aria-busy="true" role="status">Loading {demoMode ? 'local fixtures' : 'API-connected synthetic records'}…</div>
            : !data.hasData ? <div className="mx-auto max-w-2xl rounded-xl border border-red-300 bg-red-50 p-8 text-center" role="alert">
              <h1 className="text-xl font-bold text-red-900">Prediction data is unavailable</h1>
              <p className="mt-3 text-sm text-red-800">No substitute or cached prediction is shown. {demoMode ? 'This selection has no local prediction fixture.' : 'Check the backend and database before continuing.'}</p>
              <p className="mt-3 break-words text-sm text-red-700">{data.dataError}</p>
              <button onClick={data.loadData} className="mt-5 rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white">Retry data</button>
              <button onClick={data.showCityOverview} className="ml-4 underline text-sm">Return to city overview</button>
            </div> : <>
              <div className="mb-4 text-sm text-[#374151]" role="note">
                Predictions: {data.predictionScope === 'case' ? `selected case ${data.selectedCaseId}` : 'selected city overview'} · Registry, alerts and headline metrics: all cities.
                {data.predictionScope === 'case' && <button onClick={data.showCityOverview} className="ml-2 underline">Return to city overview</button>}
                {demoMode && <span className="block mt-1">Acknowledgement and resolution are local only. Other backend actions are disabled in demo.</span>}
              </div>
              {data.selectionInfo && <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="note">{data.selectionInfo}</p>}
                            <Outlet />
            </>}
        </main>
        <FloatingDockNav activeView={activeView} />
        {!demoMode && data.hasData && <LiveAlertToast />}
        {data.hasData && <EvidenceModal isOpen={evidenceModalOpen} onClose={() => setEvidenceModalOpen(false)}
          evidence={data.prediction.evidence} atmId={(data.selectedLocation ?? data.prediction.primary_location).atm_id} />}
      </div>
    </DashboardDataContext.Provider>
  );
}
