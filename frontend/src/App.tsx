import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './components/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import DashboardLayout from './pages/DashboardLayout';
import DemoNotice from './components/DemoNotice';
import OverviewPage from './pages/OverviewPage';
import CasesPage from './pages/CasesPage';
import LoopPage from './pages/LoopPage';
import AlertsPage from './pages/AlertsPage';
import AuditPage from './pages/AuditPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import DataPrivacyPage from './pages/DataPrivacyPage';
import CampaignsPage from './pages/CampaignsPage';
import I4CPage from './pages/I4CPage';
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
const DEMO_PAGES = {
  evidence: {
    title: 'Evidence register',
    description: 'The register, hash chain and ledger are written by backend actions. The local demo never writes a record, so this screen stays empty rather than showing invented entries.',
    linkTo: '/demo/predictions',
    linkLabel: 'See the evidence behind a prediction',
  },
  audit: {
    title: 'Audit log',
    description: 'Every entry here is signed by the backend when an action is recorded. The demo makes no backend writes, so there is nothing to list.',
    linkTo: '/demo/cases',
    linkLabel: 'Open the case registry',
  },
  health: {
    title: 'System health',
    description: 'Service, database and model health are read from the running API. The demo runs on local fixtures with no service behind it, so no status is reported here.',
    linkTo: '/demo',
    linkLabel: 'Back to overview',
  },
  profile: {
    title: 'Profile',
    description: 'Profile details and jurisdiction scope are stored by the backend auth service. Demo sign-in uses fixture accounts and never contacts a server.',
    linkTo: '/demo',
    linkLabel: 'Back to overview',
  },
};

function PageFallback() {
  return (
    <div className="p-6 space-y-3" aria-busy="true" aria-label="Loading page">
      <div className="h-4 bg-[#E2E1DB] rounded animate-pulse w-1/3" />
      <div className="h-40 bg-[#E2E1DB] rounded-lg animate-pulse" />
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
            <Route path="loop" element={<LoopPage />} />
            <Route path="predictions" element={<Suspense fallback={<PageFallback />}><PredictionsPage /></Suspense>} />
            <Route path="map" element={<Suspense fallback={<PageFallback />}><MapPage /></Suspense>} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="i4c" element={<I4CPage />} />
            <Route path="data-privacy" element={<DataPrivacyPage />} />
            <Route path="model-card" element={<Suspense fallback={<PageFallback />}><ModelCardPage /></Suspense>} />
            <Route path="evidence" element={<DemoNotice {...DEMO_PAGES.evidence} />} />
            <Route path="audit" element={<DemoNotice {...DEMO_PAGES.audit} />} />
            <Route path="health" element={<DemoNotice {...DEMO_PAGES.health} />} />
            <Route path="profile" element={<DemoNotice {...DEMO_PAGES.profile} />} />
          </Route>
          <Route path="/real" element={<RequireAuth><DashboardLayout key="api" /></RequireAuth>}>
            <Route index element={<OverviewPage />} />
            <Route path="loop" element={<LoopPage />} />
            <Route path="predictions" element={<Suspense fallback={<PageFallback />}><PredictionsPage /></Suspense>} />
            <Route path="map" element={<Suspense fallback={<PageFallback />}><MapPage /></Suspense>} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="i4c" element={<I4CPage />} />
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
