import { createContext, useContext } from 'react';
import { DashboardStats, Case, Prediction, Alert, PredictionLocation } from '../types';

export interface DashboardData {
  stats: DashboardStats;
  cases: Case[];
  prediction: Prediction;
  alerts: Alert[];
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  isRefreshing: boolean;
  relativeTime: string;
  selectedLocation: PredictionLocation | null;
  setSelectedLocation: (loc: PredictionLocation | null) => void;
  liveAlertCount: number;
  handleCaseSelect: (caseId: string) => void;
  handleAcknowledge: (alertId: string) => void;
  handleResolveCase: (caseId: string) => void;
  loadData: () => Promise<void>;
  setPrediction: (p: Prediction) => void;
  setLastPredictionUpdate: (d: Date) => void;
  evidenceModalOpen: boolean;
  setEvidenceModalOpen: (open: boolean) => void;
  usingFallback: boolean;
  lastUpdated: Date;
  cityCenter?: [number, number];
}

export const DashboardDataContext = createContext<DashboardData>(null!);

export function useDashboard() {
  return useContext(DashboardDataContext);
}
