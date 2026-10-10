import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OverviewPage from '../pages/OverviewPage';
import PredictionCard from '../components/PredictionCard';
import { FALLBACK_PREDICTION } from '../data/fallbackData';

const state = vi.hoisted(() => ({ dashboard: {} as Record<string, unknown> }));
vi.mock('../context/DashboardContext', () => ({ useDashboard: () => state.dashboard }));
vi.mock('../lib/auth', () => ({ authFetch: async () => ({ ok: false, status: 503 }) }));
vi.mock('../components/RiskTrendChart', () => ({ default: () => null }));
vi.mock('../components/SyntheticOperationalSimulation', () => ({ default: () => null }));

describe('dashboard null operational metrics', () => {
  it('shows backend Not measured/null without zero rupees or fake recovery impact', async () => {
    state.dashboard = {
      stats: { active_cases: 1, high_risk_locations: 2, alerts_today: 0, avg_lead_time: 'Not measured', prevented_fraud: null, mules_flagged: null, resolved_case_amount: 12345, metrics_note: 'Resolved amounts are not verified prevented fraud; mule counts and lead time are not measured' },
      prediction: FALLBACK_PREDICTION, isRefreshing: false, relativeTime: 'just now', liveAlertCount: 0,
      setEvidenceModalOpen: vi.fn(), setSelectedLocation: vi.fn(), selectedLocation: null, dataMode: 'live', lastUpdated: new Date('2026-10-07'),
    };
    render(<OverviewPage />);
    await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0));
    const impact = screen.getByText('Prevented Fraud').parentElement!;
    expect(impact.textContent).toContain('Not measured');
    expect(impact.textContent).not.toMatch(/₹|0\.0L|12,345/);
    expect(screen.getByText('Lead Time').parentElement!.textContent).toContain('Not measured');
    expect(screen.getByText('Linked Accounts Flagged').parentElement!.textContent).toContain('Not measured');
    expect(screen.getByText(/Resolved amounts are not verified/)).toBeDefined();
  });

  it('prediction card does not invent missing evidence or treat it as still loading', () => {
    const { container } = render(<PredictionCard prediction={{ ...FALLBACK_PREDICTION, evidence: {} }} onShowEvidence={vi.fn()} />);
    expect(screen.getByText('No evidence supplied')).toBeDefined();
    expect(container.textContent).not.toContain('Loading...');
    expect(screen.getByText(/lead time not measured/)).toBeDefined();
  });
});
