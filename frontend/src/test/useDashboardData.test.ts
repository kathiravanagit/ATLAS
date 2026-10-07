import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardData } from '../hooks/useDashboardData';
import { getDemoCity } from '../data/demoData';
import { FALLBACK_STATS, FALLBACK_CASES, FALLBACK_ALERTS, FALLBACK_PREDICTION } from '../data/fallbackData';

const request = vi.hoisted(() => vi.fn());
vi.mock('../lib/auth', () => ({ authFetch: request }));
const response = (data: unknown) => ({ ok: true, json: async () => data });
function defaults(url: string) {
  if (url === '/api/dashboard') return Promise.resolve(response(FALLBACK_STATS));
  if (url === '/api/cases') return Promise.resolve(response(FALLBACK_CASES));
  if (url === '/api/alerts') return Promise.resolve(response(FALLBACK_ALERTS));
  return Promise.resolve(response(FALLBACK_PREDICTION));
}
beforeEach(() => { request.mockReset(); request.mockImplementation(defaults); });

describe('dashboard source and selection safety', () => {
  it('gates API loading without any initial fallback prediction', async () => {
    let finish!: (value: unknown) => void;
    request.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result, unmount } = renderHook(() => useDashboardData());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasData).toBe(false);
    expect(result.current.prediction).toBeUndefined();
    unmount();
    await act(async () => finish(response({})));
  });

  it('uses case predictions for explicit selection, and resets to city overview on city change', async () => {
    const { result, rerender } = renderHook(({ city }) => useDashboardData(city), { initialProps: { city: 'puducherry' } });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    request.mockImplementation(url => url === '/api/predictions/CASE-2'
      ? Promise.resolve(response({ ...FALLBACK_PREDICTION, case_id: 'CASE-2' })) : defaults(url));
    act(() => result.current.handleCaseSelect('CASE-2'));
    await waitFor(() => expect(result.current.prediction?.case_id).toBe('CASE-2'));
    expect(request).toHaveBeenCalledWith('/api/predictions/CASE-2', expect.anything());
    rerender({ city: 'chennai' });
    expect(result.current.hasData).toBe(false);
    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.predictionScope).toBe('city');
    expect(request).toHaveBeenCalledWith('/api/cities/chennai/predictions', expect.anything());
  });

  it('ignores a late response from an older city even when transport ignores abort', async () => {
    let old!: (value: unknown) => void;
    request.mockImplementation(url => url.includes('/puducherry/')
      ? new Promise(resolve => { old = resolve; })
      : url.includes('/chennai/') ? Promise.resolve(response({ ...FALLBACK_PREDICTION, case_id: 'NEW' })) : defaults(url));
    const { result, rerender } = renderHook(({ city }) => useDashboardData(city), { initialProps: { city: 'puducherry' } });
    rerender({ city: 'chennai' });
    await waitFor(() => expect(result.current.prediction?.case_id).toBe('NEW'));
    await act(async () => old(response({ ...FALLBACK_PREDICTION, case_id: 'OLD' })));
    expect(result.current.prediction.case_id).toBe('NEW');
  });

  it.each(['failure', 'empty'])('does not substitute predictions on %s', async mode => {
    request.mockImplementation(url => url.includes('/predictions')
      ? mode === 'failure' ? Promise.reject(new Error('offline')) : Promise.resolve(response({ ranked_locations: [] }))
      : defaults(url));
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.dataMode).toBe('unavailable'));
    expect(result.current.hasData).toBe(false);
    expect(result.current.prediction).toBeUndefined();
    expect(result.current.dataError).toMatch(mode === 'failure' ? /offline/ : /Prediction missing/);
  });

  it('switches real city-specific fixtures without network calls and keeps local actions local', async () => {
    const { result, rerender } = renderHook(({ city }) => useDashboardData(city, { forceFallback: true }), { initialProps: { city: 'puducherry' } });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.prediction.primary_location.atm_id).toBe('PNY-001');
    expect(result.current.prediction.primary_location.risk_score).toBe(85);
    const alertId = result.current.alerts[0].alert_id;
    await act(async () => result.current.handleAcknowledge(alertId));
    expect(result.current.alerts[0].acknowledged).toBe(true);
    await act(async () => result.current.handleResolveCase(result.current.cases[0].case_id));
    expect(result.current.cases[0].status).toBe('resolved');
    rerender({ city: 'chennai' });
    await waitFor(() => expect(result.current.prediction?.primary_location.atm_id).toBe('CHN-001'));
    expect(result.current.cityCenter).toEqual([13.0827, 80.2707]);
    expect(request).not.toHaveBeenCalled();
  });

  it('explains a missing demo case without substituting a prediction or hiding the registry', async () => {
    const { result } = renderHook(() => useDashboardData('delhi', { forceFallback: true }));
    await waitFor(() => expect(result.current.hasData).toBe(true));
    const prior = result.current.prediction;
    act(() => result.current.handleCaseSelect('missing'));
    expect(result.current.selectionInfo).toMatch(/No local prediction fixture/);
    expect(result.current.hasData).toBe(true);
    expect(result.current.prediction).toBe(prior);
    expect(result.current.selectedCaseId).not.toBe('missing');
    expect(result.current.cases.length).toBeGreaterThan(0);
    expect(request).not.toHaveBeenCalled();
  });

  it('retains all fixture cities and unique ATM identities', () => {
    const ids = ['puducherry', 'chennai', 'delhi', 'mumbai', 'bangalore', 'kolkata', 'hyderabad', 'ahmedabad'];
    const atms = ids.flatMap(id => getDemoCity(id).prediction.ranked_locations.map(atm => atm.atm_id));
    expect(atms).toHaveLength(64);
    expect(new Set(atms).size).toBe(64);
  });
});
