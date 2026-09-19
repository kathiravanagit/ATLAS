import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './components/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import DashboardLayout from './pages/DashboardLayout';
import OverviewPage from './pages/OverviewPage';
import PredictionsPage from './pages/PredictionsPage';
import MapPage from './pages/MapPage';
import CasesPage from './pages/CasesPage';
import AlertsPage from './pages/AlertsPage';
import EvidencePage from './pages/EvidencePage';
import AuditPage from './pages/AuditPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import DataPrivacyPage from './pages/DataPrivacyPage';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/real" element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="predictions" element={<PredictionsPage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="evidence" element={<EvidencePage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="data-privacy" element={<DataPrivacyPage />} />
            <Route path="profile" element={<ProfileSettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
