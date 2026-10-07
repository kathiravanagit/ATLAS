import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExplainabilityPanel from '../components/ExplainabilityPanel';
const request = vi.hoisted(() => vi.fn());
vi.mock('../lib/auth', () => ({ authFetch: request }));
const explanation = (atm = 'ATM-2', overrides = {}) => ({
  case_id: 'CASE-1', atm_id: atm, base_value: 0.314159, risk_score: 78,
  shap_available: true, shap_method: 'KernelExplainer',
  feature_contributions: [{ feature: 'distance', contribution: -0.12 }], ...overrides,
});
const response = (data: unknown) => ({ ok: true, json: async () => data });
beforeEach(() => { request.mockReset(); });

describe('selected ATM explainability', () => {
  it('requests the exact selected ATM and displays the service base value', async () => {
    request.mockResolvedValue(response(explanation()));
    render(<ExplainabilityPanel caseId="CASE-1" atmId="ATM-2" />);
    await waitFor(() => expect(screen.getByText('0.314159')).toBeDefined());
    expect(request).toHaveBeenCalledWith('/api/model/shap/CASE-1?atm_id=ATM-2', expect.anything());
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('-0.12')).toBeDefined();
  });

  it('distinguishes importance fallback from actual SHAP', async () => {
    request.mockResolvedValue(response(explanation('ATM-2', { shap_available: false, shap_method: 'MDI importance fallback' })));
    render(<ExplainabilityPanel caseId="CASE-1" atmId="ATM-2" />);
    await waitFor(() => expect(screen.getByText(/Importance fallback — not SHAP/)).toBeDefined());
    expect(screen.getByText(/not additive SHAP/)).toBeDefined();
  });

  it('accepts the real backend global fallback shape with null base and null local contributions', async () => {
      request.mockResolvedValue(response(explanation('ATM-2', {
        base_value: null, shap_available: false, shap_method: 'global_feature_importance',
        explained_model: 'global importance; not local SHAP', explanation_units: 'global_importance_not_local_attribution',
        feature_contributions: [{ feature: 'distance', contribution: null, importance: 0.23, direction: 'not_local' }],
        explanation_reason: 'No empirical training background saved', explanation_probability: null,
      })));
      const { container } = render(<ExplainabilityPanel caseId="CASE-1" atmId="ATM-2" />);
      await waitFor(() => expect(screen.getByText(/Importance fallback — not SHAP/)).toBeDefined());
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('0.23')).toBeDefined();
      expect(screen.getByText(/No base value supplied/)).toBeDefined();
      expect(container.textContent).not.toContain('+0.23');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('uses actual probability-unit base and signed contributions without mixing score scale', async () => {
      request.mockResolvedValue(response(explanation('ATM-2', {
        base_value: 0.4, risk_score: 78, shap_method: 'kernel_shap_ensemble', explained_model: 'stored ensemble',
        explanation_units: 'probability', explanation_probability: 0.78,
        feature_contributions: [{ feature: 'distance', contribution: 0.38 }],
      })));
      render(<ExplainabilityPanel caseId="CASE-1" atmId="ATM-2" />);
      await waitFor(() => expect(screen.getByText(/Base \+ signed contributions: 0.780000 probability \(78.00 on score scale\)/)).toBeDefined());
      expect(screen.getByText('0.4')).toBeDefined();
      expect(screen.getByText(/Units: probability/)).toBeDefined();
    });

    it('shows backend regeneration instructions on missing exact feature snapshots', async () => {
      request.mockResolvedValue({ ok: false, status: 409, json: async () => ({ detail: 'Legacy prediction has no exact feature snapshot; generate a fresh prediction' }) });
      render(<ExplainabilityPanel caseId="CASE-1" atmId="ATM-2" />);
      await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/generate a fresh prediction/));
    });

    it('rejects a primary-ATM explanation returned for another selection', async () => {
    request.mockResolvedValue(response(explanation('ATM-1')));
    render(<ExplainabilityPanel caseId="CASE-1" atmId="ATM-2" />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/exact case and ATM/));
    expect(screen.queryByText('0.314159')).toBeNull();
  });

  it('clears the displayed explanation immediately and ignores stale ATM results', async () => {
    let finish!: (value: unknown) => void;
    request.mockImplementation(url => url.includes('ATM-1') ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(response(explanation())));
    const { rerender } = render(<ExplainabilityPanel caseId="CASE-1" atmId="ATM-1" />);
    rerender(<ExplainabilityPanel caseId="CASE-1" atmId="ATM-2" />);
    await waitFor(() => expect(screen.getByText('0.314159')).toBeDefined());
    await act(async () => finish(response(explanation('ATM-1', { base_value: 99 }))));
    expect(screen.queryByText('99')).toBeNull();
  });

  it('reloads explanation after prediction revision without changing the selected ATM', async () => {
      request.mockResolvedValue(response(explanation()));
      const { rerender } = render(<ExplainabilityPanel caseId="CASE-1" atmId="ATM-2" refreshKey="v1" />);
      await waitFor(() => expect(screen.getByText('0.314159')).toBeDefined());
      request.mockResolvedValue(response(explanation('ATM-2', { base_value: 0.42 })));
      rerender(<ExplainabilityPanel caseId="CASE-1" atmId="ATM-2" refreshKey="v2" />);
      await waitFor(() => expect(screen.getByText('0.42')).toBeDefined());
      expect(screen.queryByText('0.314159')).toBeNull();
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('makes no API request or fake attribution in demo', () => {
    render(<ExplainabilityPanel caseId="DEMO" atmId="PNY-001" demoMode />);
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByText(/SHAP and base value are unavailable/)).toBeDefined();
  });

  it('reports failure rather than a permanent loading state or invented explanation', async () => {
    request.mockRejectedValue(new Error('offline'));
    render(<ExplainabilityPanel caseId="CASE-1" atmId="ATM-2" />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/offline/));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
