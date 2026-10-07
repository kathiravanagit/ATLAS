import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ModelPerformanceCard from '../components/ModelPerformanceCard';
import ModelHealthCard from '../components/ModelHealthCard';
import ModelCardPanel from '../components/ModelCardPanel';
import ModelCardPage from '../pages/ModelCardPage';
import SystemHealthPage from '../pages/SystemHealthPage';
import DriftIndicator from '../components/DriftIndicator';
import CostRoiCard from '../components/CostRoiCard';
import AnimatedNumber from '../components/AnimatedNumber';
import { percent, ratio, formatMetric, featureImportances } from '../lib/metrics';
import { ConfusionMatrixChart, RocChart } from '../components/ModelMetricCharts';

const request = vi.hoisted(() => vi.fn());
vi.mock('../lib/auth', () => ({ authFetch: request, isDemoRoute: () => false }));
const emptyScores = { accuracy: null, precision: null, recall: null, f1_score: null, confusion_matrix: null };
// Mirrors main.model_metrics: individual models have accuracy only, not a complete metric set.
const legacyMetrics = { ensemble: emptyScores, random_forest: { accuracy: null }, xgboost: { accuracy: null }, roc_auc: null, pr_auc: null, cv_accuracy: null, cv_std: null, training_date: null, n_samples: null, n_features: null, cities: null, atms: null };
const legacyCard = { ...emptyScores, model_type: 'Ensemble', model_version: 'legacy', pr_auc: null, roc_auc: null, rf_accuracy: null, xgb_accuracy: null, positive_ratio: null, n_samples: null, n_features: null, training_date: null, ensemble_method: null, feature_columns: ['distance'], feature_importances: null, roc_curve: null, top_k_accuracy: null, validation_protocol: { baseline_majority_accuracy: null, holdout_revalidation: null } };
let metrics: unknown;
let card: unknown;
let drift: unknown;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {} unobserve() {} disconnect() {}
  });
  metrics = structuredClone(legacyMetrics); card = structuredClone(legacyCard);
  drift = { data_source: 'synthetic simulated distribution, not live telemetry', metric_method: 'heuristic normalized mean shift; not population stability index (PSI)', verified: false, overall_heuristic_score: null, status: null, features: null, total_features: null, critical_count: null, warning_count: null };
  request.mockReset();
  request.mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () => url === '/api/model/metrics' ? metrics : url === '/api/model/card' ? card : url === '/api/model/drift' ? drift : { feature_stats: { distance: { mean: null, std: null } } } }));
});
function assertNoInventedValues(container: HTMLElement) {
  expect(container.textContent).not.toMatch(/NaN|Infinity|undefined|null%|0\.0%|8\.2x|3\.8 Cr|2\.8 L|39\.4%|28\.8%/);
  expect(container.textContent).toMatch(/Unavailable|Not measured/);
}

describe('nullable backend evaluation contracts', () => {
  it.each([
    ['Model Performance', ModelPerformanceCard], ['Model Monitoring', ModelHealthCard], ['ML Model Card', ModelCardPanel],
  ] as const)('%s handles null and absent legacy metrics without fake zeroes or crashes', async (heading, Component) => {
    const { container } = render(<Component />);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: new RegExp(heading) }));
    assertNoInventedValues(container);
    expect(screen.getByText(/Confusion matrix: Unavailable/)).toBeDefined();
    expect(container.querySelector('[style*="null%"]')).toBeNull();
  });

  it('model card page keeps all absent reports explicitly unavailable', async () => {
    const { container } = render(<MemoryRouter><ModelCardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Top-K Accuracy (Headline Metric)')).toBeDefined());
    assertNoInventedValues(container);
    expect(container.textContent).not.toMatch(/50\/50|50%|0%|97\.7/);
    expect(screen.getByText(/ROC curve: Unavailable/)).toBeDefined();
    expect(screen.getByText(/no feature importance values supplied/)).toBeDefined();
  });

  it.each([ModelPerformanceCard, ModelHealthCard, ModelCardPanel])('renders an API failure instead of perpetual loading or fallback metrics', async Component => {
    request.mockResolvedValue({ ok: false, status: 503 });
    render(<Component />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/unavailable/));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('system health renders withdrawn metrics as unavailable, not measured zero', async () => {
    request.mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () => url === '/api/health'
      ? { status: 'healthy', mode: 'sqlite', version: 'test', model_loaded: true, model_accuracy: null, model_recall: null, model_f1: null, model_precision: null, model_pr_auc: null, top_k_accuracy: null }
      : url === '/api/health/db-check'
        ? { status: 'healthy', predictions_count: 1, ranked_locations_count: 2, latest_prediction_case: 'CASE-TEST', verdict: 'stored' }
        : drift }));
    const { container } = render(<MemoryRouter><SystemHealthPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('CASE-TEST')).toBeDefined());
    assertNoInventedValues(container);
    for (const label of ['Accuracy', 'Recall', 'F1 Score', 'Precision']) {
      expect(screen.getByText(label).parentElement?.textContent).toContain('Unavailable');
    }
  });

  it('system health failures do not leave perpetual loading or a fabricated sync time', async () => {
    request.mockResolvedValue({ ok: false, status: 503 });
    const { container } = render(<MemoryRouter><SystemHealthPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/One or more health services are unavailable/)).toBeDefined());
    expect(container.textContent).not.toContain('Loading');
    expect(screen.getByText('Last complete refresh: Unavailable')).toBeDefined();
  });

  it('preserves supplied benchmark values, zeroes, comparisons and confusion chart', async () => {
    metrics = { ...legacyMetrics, ensemble: { accuracy: 87.4, precision: 0, recall: 76.2, f1_score: 72.1, confusion_matrix: { tp: 123, fp: 4, fn: 8, tn: 321 } }, random_forest: { accuracy: 84 }, xgboost: { accuracy: 88 }, roc_auc: 0.91, pr_auc: 0.81 };
    const { container } = render(<ModelPerformanceCard />);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    fireEvent.click(screen.getByRole('button'));
    expect(container.textContent).toContain('87.4%');
    expect(container.textContent).toContain('0.0%');
    expect(container.textContent).toContain('0.910');
    expect(screen.getByText('Confusion Matrix (n=456)')).toBeDefined();
    await waitFor(() => expect(container.querySelector('[style*="84%"]')).not.toBeNull());
    expect(container.textContent).not.toContain('NaN');
  });

  it('preserves actual card importance, distributions, holdout tables, top-k and zero metrics', async () => {
    card = { ...legacyCard, accuracy: 0, top_k_accuracy: { top_1_hit_rate: 0, top_3_hit_rate: 0.8 }, feature_importances: { distance: 0.23 }, validation_protocol: { holdout_revalidation: { protocol: 'frozen', slices: { time_holdout: { n: 20, precision: null, recall: 0, f1: null, pr_auc: 0.7 } }, threshold_sweep: [{ threshold: 0.5, precision: null, recall: 0.3, f1: 0, flagged: 5 }] } } };
    const { container } = render(<MemoryRouter><ModelCardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('0.2300')).toBeDefined());
    expect(container.textContent).toContain('80.0%');
    expect(container.textContent).toContain('Time holdout');
    expect(container.textContent).toContain('Threshold Sweep');
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('does not treat a zero-denominator confusion matrix as measured error rates', () => {
    const { container } = render(<ConfusionMatrixChart matrix={{ tp: 0, fp: 0, fn: 0, tn: 0 }} />);
    expect(container.textContent).toContain('False negative rate: Unavailable');
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('draws ROC only from supplied points and does not synthesize an AUC-shaped curve', () => {
    const { rerender } = render(<RocChart curve={null} />);
    expect(screen.getByText(/ROC curve: Unavailable/)).toBeDefined();
    expect(screen.queryByTestId('roc-chart')).toBeNull();
    rerender(<RocChart curve={{ fpr: [0, 0.2, 1], tpr: [0, 0.8, 1] }} />);
    expect(screen.getByTestId('roc-chart')).toBeDefined();
    expect(screen.queryByText(/ROC curve: Unavailable/)).toBeNull();
  });

  it('drift uses backend heuristic fields, preserves a measured zero and labels simulated means', async () => {
    drift = { data_source: 'synthetic simulated distribution, not live telemetry', metric_method: 'heuristic normalized mean shift; not population stability index (PSI)', verified: false, overall_heuristic_score: 0, status: 'stable', total_features: 1, critical_count: 0, warning_count: 0, features: [{ feature: 'distance', train_mean: null, live_mean: 0.15, heuristic_score: 0, mean_shift_z: null, status: 'stable' }] };
    const { container } = render(<DriftIndicator />);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    fireEvent.click(screen.getByRole('button'));
    expect(container.textContent).toContain('Heuristic: 0.0000');
    expect(container.textContent).toContain('Training mean: Unavailable');
    expect(container.textContent).toContain('Simulated mean: 0.150');
    expect(container.textContent).not.toContain('Live:');
    expect(container.textContent).not.toMatch(/NaN|undefined|NaN stable/);
  });

  it('null drift remains unavailable rather than green/stable', async () => {
    const { container } = render(<DriftIndicator />);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    fireEvent.click(screen.getByRole('button'));
    assertNoInventedValues(container);
    expect(container.textContent).not.toMatch(/\d stable|Reported status: stable/);
  });

  it('ROI has no invented operational impact defaults', () => {
    const { container } = render(<CostRoiCard />);
    fireEvent.click(screen.getByRole('button'));
    assertNoInventedValues(container);
    expect(container.textContent).not.toContain('₹');
    expect(request).not.toHaveBeenCalled();
  });

  it('ROI preserves explicitly supplied costs and scaling data', () => {
    const { container } = render(<CostRoiCard metrics={{ cost_per_atm: 12345, roi: 0, scaling: [{ scale: '50 ATMs', cost: 500, savings: 700, roi: 1.4 }] }} />);
    fireEvent.click(screen.getByRole('button'));
    expect(container.textContent).toContain('₹12,345');
    expect(container.textContent).toContain('0.0x');
    expect(container.textContent).toContain('50 ATMs');
  });

  it.each([null, undefined, NaN, Infinity])('animated numbers never coerce missing %s to zero', value => {
    const { container } = render(<AnimatedNumber value={value} suffix="%" />);
    expect(container.textContent).toBe('Unavailable');
  });

  it('numeric helpers distinguish missing values from measured zero', () => {
    expect(percent(null)).toBe('Unavailable'); expect(percent(0)).toBe('0.0%');
    expect(formatMetric(NaN)).toBe('Unavailable'); expect(ratio(0, 0)).toBeNull();
    expect(featureImportances({ feature_columns: ['distance'] })).toEqual([]);
  });
});
