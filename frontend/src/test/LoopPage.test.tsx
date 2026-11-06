import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoopPage from '../pages/LoopPage';
import { FALLBACK_CASES, FALLBACK_PREDICTION, FALLBACK_ALERTS } from '../data/fallbackData';

const state = vi.hoisted(() => ({ dashboard: {} as Record<string, unknown> }));
vi.mock('../context/DashboardContext', () => ({ useDashboard: () => state.dashboard }));
vi.mock('@/lib/auth', () => ({ isDemoRoute: () => false }));
vi.mock('@/lib/roles', () => ({ can: () => true }));

function setup(overrides: Record<string, unknown> = {}) {
  state.dashboard = {
    cases: FALLBACK_CASES,
    prediction: FALLBACK_PREDICTION,
    alerts: FALLBACK_ALERTS,
    selectedCaseId: 'CC-2026-0147',
    handleCaseSelect: vi.fn(),
    setSelectedCaseId: vi.fn(),
    handleResolveCase: vi.fn(),
    setEvidenceModalOpen: vi.fn(),
    dataMode: 'live',
    ...overrides,
  };
  render(
    <BrowserRouter>
      <LoopPage />
    </BrowserRouter>,
  );
}

describe('LoopPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the five loop steps with the first active', () => {
    setup();
    expect(screen.getByText('The Loop')).toBeDefined();
    expect(screen.getByText('Complaint')).toBeDefined();
    expect(screen.getByText('Prediction')).toBeDefined();
    expect(screen.getByText('Zone')).toBeDefined();
    expect(screen.getByText('Alert')).toBeDefined();
    expect(screen.getByText('Resolve')).toBeDefined();
    // first step content visible
    expect(screen.getByText('CC-2026-0147')).toBeDefined();
  });

  it('advances to the prediction step and shows no predicted window claim', async () => {
    setup();
    fireEvent.click(screen.getByText('Prediction'));
    await screen.findByText(FALLBACK_PREDICTION.primary_location.atm_id);
    expect(screen.getByText(/no predicted window/i)).toBeDefined();
  });

  it('empty case list does not invent a loop', () => {
    setup({ cases: [], selectedCaseId: '' });
    expect(screen.getByText(/Select a case in/)).toBeDefined();
    expect(screen.queryByText('Primary ATM')).toBeNull();
  });

  it('resolve is a human action; stats unchanged', async () => {
    setup();
    fireEvent.click(screen.getByText('Resolve'));
    const btn = await screen.findByText('Resolve case');
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(state.dashboard.handleResolveCase).toHaveBeenCalledWith('CC-2026-0147');
  });

  it('demo mode does not call the backend resolve', async () => {
    setup({ dataMode: 'demo' });
    fireEvent.click(screen.getByText('Resolve'));
    const btn = await screen.findByText('Resolve case');
    fireEvent.click(btn);
    expect(state.dashboard.handleResolveCase).not.toHaveBeenCalled();
    expect(screen.getByText(/Demo mode/)).toBeDefined();
  });
});
