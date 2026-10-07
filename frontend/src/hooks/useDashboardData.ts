import { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '../lib/auth';
import { timeAgo } from '../lib/utils';
import { getDemoCity, getDemoCase } from '../data/demoData';
import type { DashboardStats, Case, Prediction, Alert, PredictionLocation } from '../types';

async function fetchApi<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await authFetch(`/api${url}`, { signal });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return await res.json() as T;
}

type Snapshot = {
  key: string; stats: DashboardStats; cases: Case[]; alerts: Alert[];
  prediction: Prediction; center?: [number, number];
};

export function useDashboardData(selectedCity = 'puducherry', opts?: { forceFallback?: boolean }) {
  const demo = opts?.forceFallback ?? false;
  const [explicitCase, setExplicitCase] = useState<{ city: string; id: string } | null>(null);
  const caseId = explicitCase?.city === selectedCity ? explicitCase.id : null;
  const key = `${demo ? 'demo' : 'api'}:${selectedCity}:${caseId ?? 'overview'}`;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const dataError = failure?.key === key ? failure.message : null;
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectionInfo, setSelectionInfo] = useState<string | null>(null);
  const [lastPredictionUpdate, setLastPredictionUpdate] = useState(new Date());
  const [relativeTime, setRelativeTime] = useState('just now');
  const [selectedLocation, setSelectedLocation] = useState<PredictionLocation | null>(null);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const currentKey = useRef(key);
  currentKey.current = key;

  const loadData = useCallback(async () => {
    if (currentKey.current !== key) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const request = ++sequence.current;
    setIsRefreshing(true);
    setFailure(null);
    try {
      let next: Snapshot;
      if (demo) {
        const fixture = getDemoCity(selectedCity);
        const prediction = caseId ? getDemoCase(caseId) : fixture.prediction;
        next = { ...fixture, prediction, key, center: caseId
          ? [prediction.primary_location.latitude, prediction.primary_location.longitude] : fixture.center };
      } else {
        const [stats, cases, alerts, raw] = await Promise.all([
          fetchApi<DashboardStats>('/dashboard', abort.signal),
          fetchApi<Case[]>('/cases', abort.signal),
          fetchApi<Alert[]>('/alerts', abort.signal),
          caseId
            ? fetchApi<Prediction>(`/predictions/${encodeURIComponent(caseId)}`, abort.signal)
            : fetchApi<Prediction & { center?: [number, number] }>(`/cities/${encodeURIComponent(selectedCity)}/predictions`, abort.signal),
        ]);
        const top = raw.primary_location ?? raw.ranked_locations?.[0];
        if (!top || !raw.ranked_locations?.length || !raw.case_id) {
          throw new Error(`Prediction missing for ${caseId ?? selectedCity}. No substitute prediction is shown.`);
        }
        if (caseId && raw.case_id !== caseId) throw new Error('Prediction case does not match the selection.');
        const prediction: Prediction = { ...raw, primary_location: top,
          status: raw.status ?? 'CITY OVERVIEW', risk_trend: raw.risk_trend ?? [], evidence: raw.evidence ?? {} };
        next = { key, stats, cases, alerts, prediction, center: caseId
          ? [top.latitude, top.longitude] : ('center' in raw ? raw.center as [number, number] : undefined) };
      }
      if (abort.signal.aborted || request !== sequence.current || currentKey.current !== key) return;
      setSnapshot(previous => demo && previous?.key === key
        ? { ...next, cases: previous.cases, alerts: previous.alerts } : next);
      setSelectedLocation(previous => previous ? next.prediction.ranked_locations.find(location => location.atm_id === previous.atm_id) ?? null : null);
      setLastPredictionUpdate(new Date());
    } catch (error) {
      if (abort.signal.aborted || request !== sequence.current || currentKey.current !== key) return;
      setSnapshot(null);
      setFailure({ key, message: error instanceof Error ? error.message : 'Data service unavailable.' });
    } finally {
      if (request === sequence.current && currentKey.current === key) setIsRefreshing(false);
    }
  }, [demo, selectedCity, caseId, key]);

  useEffect(() => {
    if (explicitCase && explicitCase.city !== selectedCity) setExplicitCase(null);
  }, [explicitCase, selectedCity]);

  useEffect(() => {
    setSelectedLocation(null);
    setActionError(null);
    setSelectionInfo(null);
    void loadData();
    const requestController = controller.current;
    const interval = demo ? undefined : setInterval(() => void loadData(), 30000);
    return () => { clearInterval(interval); requestController?.abort(); };
  }, [loadData, demo]);
  useEffect(() => {
    const interval = setInterval(() => setRelativeTime(timeAgo(lastPredictionUpdate)), 5000);
    return () => clearInterval(interval);
  }, [lastPredictionUpdate]);

  const handleCaseSelect = useCallback((id: string) => {
    if (id === caseId) return;
    if (demo) {
      try { getDemoCase(id); } catch {
        setSelectionInfo(`No local prediction fixture for case ${id}. Selection was not applied; the current view and registry remain available. No case outcome or substitute prediction is generated.`);
        return;
      }
    }
    setSelectionInfo(null);
    controller.current?.abort();
    sequence.current++;
    setSnapshot(null);
    setExplicitCase({ city: selectedCity, id });
    setSelectedLocation(null);
  }, [selectedCity, caseId, demo]);

  const mutate = useCallback(async (kind: 'alerts' | 'cases', id: string) => {
    const actionKey = key;
    setActionError(null);
    try {
      if (!demo) {
        const res = await authFetch(`/api/${kind}/${encodeURIComponent(id)}/${kind === 'alerts' ? 'acknowledge' : 'resolve'}`, { method: 'POST' });
        if (!res.ok) throw new Error(`Action failed (${res.status})`);
      }
      if (currentKey.current !== actionKey) return;
      setSnapshot(previous => previous?.key !== actionKey ? previous : {
        ...previous,
        alerts: kind === 'alerts' ? previous.alerts.map(a => a.alert_id === id ? { ...a, acknowledged: true, acknowledged_at: new Date().toLocaleTimeString() } : a) : previous.alerts,
        cases: kind === 'cases' ? previous.cases.map(c => c.case_id === id ? { ...c, status: 'resolved', current_risk: 'Resolved' } : c) : previous.cases,
      });
    } catch (error) {
      if (currentKey.current === actionKey) setActionError(error instanceof Error ? error.message : 'Action failed.');
    }
  }, [demo, key]);

  const ready = snapshot?.key === key;
  // Consumers are mounted only after the layout's loading/error gate.
  return {
    stats: snapshot?.stats as DashboardStats, cases: snapshot?.cases ?? [],
    prediction: snapshot?.prediction as Prediction, alerts: snapshot?.alerts ?? [],
    selectedCaseId: caseId ?? (ready ? snapshot.prediction.case_id : ''),
    setSelectedCaseId: handleCaseSelect, handleCaseSelect,
    isLoading: !ready && !dataError, hasData: ready, isRefreshing, relativeTime,
    selectedLocation, setSelectedLocation, liveAlertCount: 0,
    handleAcknowledge: (id: string) => mutate('alerts', id),
    handleResolveCase: (id: string) => mutate('cases', id),
    loadData, setPrediction: (prediction: Prediction) => setSnapshot(previous =>
      previous?.key === key && prediction.case_id === previous.prediction.case_id ? { ...previous, prediction } : previous),
    setLastPredictionUpdate, dataMode: (dataError ? 'unavailable' : demo ? 'demo' : 'live') as 'live' | 'demo' | 'unavailable',
    dataError, actionError, selectionInfo, clearActionError: () => setActionError(null),
    lastUpdated: lastPredictionUpdate, cityCenter: ready ? snapshot.center : undefined,
    predictionScope: caseId ? 'case' : 'city',
    showCityOverview: () => { if (caseId) { setSnapshot(null); setExplicitCase(null); } else { void loadData(); } },
  };
}
