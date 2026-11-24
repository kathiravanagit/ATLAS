import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNav from '../components/TopNav';
import SideRail, { MobileNav } from '../components/SideRail';
import LiveAlertToast from '../components/LiveAlertToast';
import EvidenceModal from '../components/EvidenceModal';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardDataContext } from '../context/DashboardContext';

export default function DashboardLayout({ demoMode = false }: { demoMode?: boolean }) {
  const [selectedCity, setSelectedCity] = useState('puducherry');
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const data = useDashboardData(selectedCity, { forceFallback: demoMode });
  const location = useLocation();
  const base = demoMode ? '/demo' : '/real';
  const scopedRoute = ['', '/predictions', '/map', '/loop'].some(
    route => location.pathname.replace(/\/$/, '') === `${base}${route}`,
  );

  return (
    <DashboardDataContext.Provider value={{ ...data, evidenceModalOpen, setEvidenceModalOpen }}>
      <div className="min-h-screen bg-[#F6F6F3] text-[#1A1C1F]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[1200] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to main content
        </a>
        <SideRail base={base} />
        <div className="lg:pl-[248px]">
          <TopNav
            selectedCity={selectedCity}
            demoMode={demoMode}
            onCityChange={city => {
              data.showCityOverview();
              setSelectedCity(city);
              setEvidenceModalOpen(false);
            }}
            dataMode={data.dataMode}
            lastUpdated={data.lastUpdated}
          />
          <MobileNav base={base} />

          {data.actionError && (
            <div className="mx-4 mt-4 rounded-lg border border-[#B91C1C]/30 bg-[#B91C1C]/5 px-4 py-3 text-sm text-[#B91C1C] md:mx-6" role="alert">
              {data.actionError}
              <button className="ml-3 underline" onClick={data.clearActionError}>
                Dismiss
              </button>
            </div>
          )}

          <main id="main-content" className="mx-auto max-w-[1500px] px-4 py-5 pb-16 md:px-6" tabIndex={-1}>
            {data.isLoading ? (
              <div aria-busy="true" role="status" className="py-10 text-sm text-[#5F6368]">
                Loading {demoMode ? 'local fixtures' : 'API-connected synthetic records'}…
              </div>
            ) : !data.hasData ? (
              <div className="mx-auto max-w-2xl rounded-xl border border-[#B91C1C]/30 bg-white p-8 text-center" role="alert">
                <h1 className="text-lg font-semibold text-[#1A1C1F]">Prediction data is unavailable</h1>
                <p className="mt-3 text-sm text-[#43474C]">
                  No substitute or cached prediction is shown.{' '}
                  {demoMode
                    ? 'This selection has no local prediction fixture.'
                    : 'Check the backend and database before continuing.'}
                </p>
                <p className="mt-3 break-words text-sm text-[#B91C1C]">{data.dataError}</p>
                <button onClick={data.loadData} className="mt-5 rounded-lg bg-[#17406F] px-4 py-2 text-sm font-medium text-white">
                  Retry data
                </button>
                <button onClick={data.showCityOverview} className="ml-4 text-sm underline">
                  Return to city overview
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-x-2 text-[12px] text-[#5F6368]" role="note">
                  {scopedRoute ? (
                    <>
                      <span>
                        Predictions: {data.predictionScope === 'case' ? `case ${data.selectedCaseId}` : 'city overview'}
                      </span>
                      <span className="text-[#D2D1CA]">/</span>
                      <span>Registry, alerts and headline metrics: all cities</span>
                      {data.predictionScope === 'case' && (
                        <button onClick={data.showCityOverview} className="underline">
                          Return to city overview
                        </button>
                      )}
                    </>
                  ) : (
                    <span>
                      {demoMode
                        ? 'Registry records are national fixtures; actions are recorded locally in this demo.'
                        : 'Registry records are synthetic; recorded actions are signed by the backend.'}
                    </span>
                  )}
                </div>
                {data.selectionInfo && (
                  <p className="mb-4 rounded-lg border border-[#B45309]/30 bg-[#B45309]/5 p-3 text-sm text-[#7C3A06]" role="note">
                    {data.selectionInfo}
                  </p>
                )}
                <Outlet />
              </>
            )}
          </main>
        </div>
        {!demoMode && data.hasData && <LiveAlertToast />}
        {data.hasData && (
          <EvidenceModal
            isOpen={evidenceModalOpen}
            onClose={() => setEvidenceModalOpen(false)}
            evidence={data.prediction.evidence}
            atmId={(data.selectedLocation ?? data.prediction.primary_location).atm_id}
          />
        )}
      </div>
    </DashboardDataContext.Provider>
  );
}
