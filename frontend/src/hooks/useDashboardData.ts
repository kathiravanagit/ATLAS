import { useState, useEffect, useCallback } from 'react';
import { authFetch, getAccessToken } from '../lib/auth';
import { timeAgo } from '../lib/utils';
import {
  FALLBACK_STATS, FALLBACK_CASES, FALLBACK_PREDICTION, FALLBACK_ALERTS,
  DEMO_CASE_ID, FALLBACK_PREDICTIONS
} from '../data/fallbackData';
import { DashboardStats, Case, Prediction, Alert, PredictionLocation } from '../types';

const API_BASE = '/api';

async function fetchApi<T>(url: string, fallback: T): Promise<{ data: T; fromFallback: boolean }> {
  try {
    const res = await authFetch(`${API_BASE}${url}`);
    if (!res.ok) throw new Error('API error');
    return { data: await res.json(), fromFallback: false };
  } catch {
    return { data: fallback, fromFallback: true };
  }
}

export function useDashboardData(selectedCity: string = 'puducherry') {
  const [stats, setStats] = useState<DashboardStats>(FALLBACK_STATS);
  const [cases, setCases] = useState<Case[]>(FALLBACK_CASES);
  const [prediction, setPrediction] = useState<Prediction>(FALLBACK_PREDICTION);
  const [alerts, setAlerts] = useState<Alert[]>(FALLBACK_ALERTS);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(DEMO_CASE_ID);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastPredictionUpdate, setLastPredictionUpdate] = useState<Date>(new Date());
  const [relativeTime, setRelativeTime] = useState('just now');
  const [selectedLocation, setSelectedLocation] = useState<PredictionLocation | null>(null);
  const [liveAlertCount, setLiveAlertCount] = useState(0);
  const [usingFallback, setUsingFallback] = useState(false);
  const [cityCenter, setCityCenter] = useState<[number, number] | undefined>(undefined);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    let anyFallback = false;
    try {
      const [s, c, a] = await Promise.all([
        fetchApi<DashboardStats>('/dashboard', FALLBACK_STATS),
        fetchApi<Case[]>('/cases', FALLBACK_CASES),
        fetchApi<Alert[]>('/alerts', FALLBACK_ALERTS),
      ]);
      if (s.fromFallback || c.fromFallback || a.fromFallback) anyFallback = true;
      setStats(s.data);
      setCases(c.data);
      setAlerts(a.data);

      if (selectedCity) {
        const cityResult = await fetchApi<any>(`/cities/${selectedCity}/predictions`, null);
        if (!cityResult.fromFallback && cityResult.data) {
          const cityPred = cityResult.data;
          const topLoc = cityPred.ranked_locations?.[0];
          const transformed: Prediction = {
            case_id: cityPred.case_id || selectedCaseId,
            status: topLoc && topLoc.risk_score > 70 ? 'HIGH PRIORITY' : 'MEDIUM PRIORITY',
            primary_location: {
              rank: 1,
              atm_id: topLoc?.atm_id || 'N/A',
              location_name: topLoc?.location_name || cityPred.city || '',
              risk_score: topLoc?.risk_score || 0,
              expected_window: topLoc?.expected_window || '18:00-20:00',
              distance: topLoc?.distance || '0 km',
              reason: topLoc?.reason || 'City-based prediction',
              status: topLoc?.status || 'Medium',
              latitude: topLoc?.latitude || 0,
              longitude: topLoc?.longitude || 0,
            },
            ranked_locations: (cityPred.ranked_locations || []).map((loc: any, i: number) => ({
              rank: loc.rank || i + 1,
              atm_id: loc.atm_id,
              location_name: loc.location_name,
              risk_score: loc.risk_score,
              expected_window: loc.expected_window || '18:00-20:00',
              distance: loc.distance || '0 km',
              reason: loc.reason || 'Historical pattern match',
              status: loc.status || 'Medium',
              latitude: loc.latitude,
              longitude: loc.longitude,
            })),
            risk_trend: cityPred.risk_trend || Array.from({ length: 6 }, (_, i) => Math.round(10 + Math.sin(i * 0.9) * 35 + i * 10)),
            evidence: cityPred.evidence || {},
          };
          setPrediction(transformed);
          setCityCenter(cityPred.center || undefined);
          setSelectedLocation(null);
          if (cityPred.case_id && cityPred.case_id !== selectedCaseId) {
            setSelectedCaseId(cityPred.case_id);
          }
        } else {
          anyFallback = true;
        }
      } else {
        const p = await fetchApi<Prediction>(`/predictions/${selectedCaseId}`, FALLBACK_PREDICTION);
        if (p.fromFallback) anyFallback = true;
        setPrediction(p.data);
      }
      setLastPredictionUpdate(new Date());
    } finally {
      setUsingFallback(anyFallback);
      setIsRefreshing(false);
    }
  }, [selectedCity]);

  useEffect(() => { loadData(); const i = setInterval(loadData, 30000); return () => clearInterval(i); }, [loadData]);
  useEffect(() => { const i = setInterval(() => setRelativeTime(timeAgo(lastPredictionUpdate)), 5000); return () => clearInterval(i); }, [lastPredictionUpdate]);

  const handleCaseSelect = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setPrediction(FALLBACK_PREDICTIONS[caseId] || FALLBACK_PREDICTION);
  }, []);

  const handleAcknowledge = useCallback(async (alertId: string) => {
    setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, acknowledged: true, acknowledged_at: new Date().toLocaleTimeString() } : a));
    try { await authFetch(`${API_BASE}/alerts/${alertId}/acknowledge`, { method: 'POST' }); } catch {}
  }, []);

  const handleResolveCase = useCallback(async (caseId: string) => {
    setCases(prev => prev.map(c => c.case_id === caseId ? { ...c, status: 'resolved' as const, current_risk: 'Resolved' } : c));
    try { await authFetch(`${API_BASE}/cases/${caseId}/resolve`, { method: 'POST' }); } catch {}
  }, []);

  return {
    stats, cases, prediction, alerts, selectedCaseId, setSelectedCaseId,
    isRefreshing, relativeTime, selectedLocation, setSelectedLocation,
    liveAlertCount, handleCaseSelect, handleAcknowledge, handleResolveCase,
    loadData, setPrediction, setLastPredictionUpdate, usingFallback,
    lastUpdated: lastPredictionUpdate, cityCenter,
  };
}
