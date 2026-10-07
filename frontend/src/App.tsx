import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './components/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import DashboardLayout from './pages/DashboardLayout';
import OverviewPage from './pages/OverviewPage';
import CasesPage from './pages/CasesPage';
import AlertsPage from './pages/AlertsPage';
import AuditPage from './pages/AuditPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import DataPrivacyPage from './pages/DataPrivacyPage';
import SystemHealthPage from './pages/SystemHealthPage';
// Heavy visualization routes are code-split so the initial bundle stays lean.
const PredictionsPage = lazy(() => import('./pages/PredictionsPage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const EvidencePage = lazy(() => import('./pages/EvidencePage'));
const ModelCardPage = lazy(() => import('./pages/ModelCardPage'));
import { getAccessToken, getUser } from './lib/auth';

/**
 * RequireAuth — the investigator console must never render as a usable screen
 * without a valid session. API routes are protected server-side; this guard
 * stops the UI from showing fallback/demo data to an unauthenticated visitor.
 */
function PageFallback() {
  return (
    <div className="p-6 space-y-3" aria-busy="true" aria-label="Loading page">
      <div className="h-4 bg-[#E5E7EB] rounded animate-pulse w-1/3" />
      <div className="h-40 bg-[#E5E7EB] rounded-lg animate-pulse" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const authed = Boolean(getAccessToken() && getAccessToken() !== 'offline-token' && getUser());
  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<Navigate to="/real" replace />} />
          {/* Explicit demo console: fallback data only, visibly labelled. */}
          <Route path="/demo" element={<DashboardLayout key="demo" demoMode />}>
            <Route index element={<OverviewPage />} />
            <Route path="predictions" element={<Suspense fallback={<PageFallback />}><PredictionsPage /></Suspense>} />
            <Route path="map" element={<Suspense fallback={<PageFallback />}><MapPage /></Suspense>} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="data-privacy" element={<DataPrivacyPage />} />
            <Route path="model-card" element={<Suspense fallback={<PageFallback />}><ModelCardPage /></Suspense>} />
            {['evidence', 'audit', 'health', 'profile'].map(page => <Route key={page} path={page} element={
              <section className="card p-6"><h1 className="text-xl font-semibold capitalize">{page}</h1><p className="mt-3 text-sm">Backend-backed {page} tools are disabled in local demo. No API requests or mutations are made. Local prediction evidence is available from the prediction card.</p></section>
            } />)}
          </Route>
          <Route path="/real" element={<RequireAuth><DashboardLayout key="api" /></RequireAuth>}>
            <Route index element={<OverviewPage />} />
            <Route path="predictions" element={<Suspense fallback={<PageFallback />}><PredictionsPage /></Suspense>} />
            <Route path="map" element={<Suspense fallback={<PageFallback />}><MapPage /></Suspense>} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="evidence" element={<Suspense fallback={<PageFallback />}><EvidencePage /></Suspense>} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="data-privacy" element={<DataPrivacyPage />} />
            <Route path="model-card" element={<Suspense fallback={<PageFallback />}><ModelCardPage /></Suspense>} />
            <Route path="health" element={<SystemHealthPage />} />
            <Route path="profile" element={<ProfileSettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
