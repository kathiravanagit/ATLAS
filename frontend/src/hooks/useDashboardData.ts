import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../lib/auth';
import { timeAgo } from '../lib/utils';
import {
  FALLBACK_STATS, FALLBACK_CASES, FALLBACK_PREDICTION, FALLBACK_ALERTS,
  DEMO_CASE_ID, FALLBACK_PREDICTIONS
} from '../data/fallbackData';
import { DashboardStats, Case, Prediction, Alert, PredictionLocation, EvidenceItem } from '../types';

const API_BASE = '/api';

async function fetchApi<T>(url: string): Promise<T> {
  const res = await authFetch(`${API_BASE}${url}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${url} returned ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`);
  }
  return await res.json() as T;
}

export function useDashboardData(selectedCity: string = 'puducherry', opts?: { forceFallback?: boolean }) {
  const forceFallback = opts?.forceFallback ?? false;
  const [stats, setStats] = useState<DashboardStats>(FALLBACK_STATS);
  const [cases, setCases] = useState<Case[]>(FALLBACK_CASES);
  const [prediction, setPrediction] = useState<Prediction>(FALLBACK_PREDICTION);
  const [alerts, setAlerts] = useState<Alert[]>(FALLBACK_ALERTS);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(DEMO_CASE_ID);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastPredictionUpdate, setLastPredictionUpdate] = useState<Date>(new Date());
  const [relativeTime, setRelativeTime] = useState('just now');
  const [selectedLocation, setSelectedLocation] = useState<PredictionLocation | null>(null);
  const [liveAlertCount] = useState(0);
  const [dataMode, setDataMode] = useState<'live' | 'demo' | 'unavailable'>(forceFallback ? 'demo' : 'unavailable');
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cityCenter, setCityCenter] = useState<[number, number] | undefined>(undefined);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    // /demo route: never touch the live API — explicit synthetic-data console.
    if (forceFallback) {
      setStats(FALLBACK_STATS);
      setCases(FALLBACK_CASES);
      setAlerts(FALLBACK_ALERTS);
      setPrediction(FALLBACK_PREDICTION);
      setDataMode('demo');
      setDataError(null);
      setIsRefreshing(false);
      return;
    }
    try {
      const [s, c, a] = await Promise.all([
        fetchApi<DashboardStats>('/dashboard'),
        fetchApi<Case[]>('/cases'),
        fetchApi<Alert[]>('/alerts'),
      ]);
      setStats(s);
      setCases(c);
      setAlerts(a);

      if (selectedCity) {
        const cityPred = await fetchApi<{
          case_id?: string;
          city?: string;
          center?: [number, number];
          ranked_locations?: PredictionLocation[];
          risk_trend?: number[];
          evidence?: Record<string, EvidenceItem>;
        }>(`/cities/${selectedCity}/predictions`);
        const topLoc = cityPred.ranked_locations?.[0];
        if (!topLoc) throw new Error(`No ranked prediction returned for ${selectedCity}`);
        const transformed: Prediction = {
          case_id: cityPred.case_id || selectedCaseId,
          status: topLoc.risk_score > 70 ? 'HIGH PRIORITY' : 'MEDIUM PRIORITY',
          primary_location: topLoc,
          ranked_locations: cityPred.ranked_locations || [],
          risk_trend: cityPred.risk_trend || [],
          evidence: cityPred.evidence || {},
        };
          setPrediction(transformed);
          setCityCenter(cityPred.center || undefined);
          setSelectedLocation(null);
          if (cityPred.case_id && cityPred.case_id !== selectedCaseId) {
            setSelectedCaseId(cityPred.case_id);
          }
      } else {
        setPrediction(await fetchApi<Prediction>(`/predictions/${selectedCaseId}`));
      }
      setDataMode('live');
      setDataError(null);
      setLastPredictionUpdate(new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The live data service is unavailable.';
      setDataMode('unavailable');
      setDataError(`Live data unavailable. No operational data is being shown. ${message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedCity, forceFallback, selectedCaseId]);

  useEffect(() => { loadData(); const i = setInterval(loadData, 30000); return () => clearInterval(i); }, [loadData]);
  useEffect(() => { const i = setInterval(() => setRelativeTime(timeAgo(lastPredictionUpdate)), 5000); return () => clearInterval(i); }, [lastPredictionUpdate]);

  const handleCaseSelect = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    if (forceFallback) {
      setPrediction(FALLBACK_PREDICTIONS[caseId] || FALLBACK_PREDICTION);
    }
  }, [forceFallback]);

  const handleAcknowledge = useCallback(async (alertId: string) => {
    try {
      const res = await authFetch(`${API_BASE}/alerts/${alertId}/acknowledge`, { method: 'POST' });
      if (!res.ok) throw new Error(`Alert acknowledgement failed (${res.status})`);
      setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, acknowledged: true, acknowledged_at: new Date().toLocaleTimeString() } : a));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Alert acknowledgement failed.');
    }
  }, []);

  const handleResolveCase = useCallback(async (caseId: string) => {
    try {
      const res = await authFetch(`${API_BASE}/cases/${caseId}/resolve`, { method: 'POST' });
      if (!res.ok) throw new Error(`Case resolution failed (${res.status})`);
      setCases(prev => prev.map(c => c.case_id === caseId ? { ...c, status: 'resolved' as const, current_risk: 'Resolved' } : c));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Case resolution failed.');
    }
  }, []);

  return {
    stats, cases, prediction, alerts, selectedCaseId, setSelectedCaseId,
    isRefreshing, relativeTime, selectedLocation, setSelectedLocation,
    liveAlertCount, handleCaseSelect, handleAcknowledge, handleResolveCase,
    loadData, setPrediction, setLastPredictionUpdate, dataMode, dataError, actionError,
    clearActionError: () => setActionError(null),
    lastUpdated: lastPredictionUpdate, cityCenter,
  };
}
