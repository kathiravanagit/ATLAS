import { test, expect } from '@playwright/test';
import { FALLBACK_STATS, FALLBACK_CASES, FALLBACK_ALERTS, FALLBACK_PREDICTIONS } from '../src/data/fallbackData';

const selectedCase = 'CC-2026-0146';

test('public demo navigates every console route without backend calls or an authenticated session', async ({ page }) => {
  const apiRequests: string[] = [];
  const sockets: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
  // Vite's dev-only HMR socket is not a backend connection.
  page.on('websocket', socket => { if (new URL(socket.url()).pathname.startsWith('/ws/')) sockets.push(socket.url()); });
  await page.route('**/api/**', route => route.abort());
  await page.goto('/demo');
  await expect(page.getByText(/^LOCAL DEMO —/)).toBeVisible();
  await expect(page.getByText('PNY-001', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: /Puducherry Puducherry/ }).click();
  await page.getByRole('button', { name: 'Chennai Tamil Nadu' }).click();
  await expect(page.getByText('CHN-001', { exact: true }).first()).toBeVisible();
  for (const [label, suffix] of [
    ['Predictions', 'predictions'], ['Risk Map', 'map'], ['Cases', 'cases'], ['Alerts', 'alerts'],
    ['Evidence', 'evidence'], ['Audit Log', 'audit'], ['Data & Privacy', 'data-privacy'],
    ['Model Card', 'model-card'], ['System Health', 'health'], ['Overview', ''],
  ]) {
    await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click();
    await expect(page).toHaveURL(`/demo${suffix ? '/' + suffix : ''}`);
    await expect(page.locator('#main-content')).toBeVisible();
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Cases', exact: true }).click();
  await page.getByRole('button', { name: 'View prediction for case CC-2026-0144', exact: true }).click();
  await expect(page.getByText(/No local prediction fixture for case CC-2026-0144/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Case Registry', exact: true, level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View prediction for case CC-2026-0144', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Prediction data is unavailable' })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: 'Predictions', exact: true }).click();
  await expect(page.getByText('CHN-001', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simulate', exact: true })).toBeDisabled();
  expect(apiRequests).toEqual([]);
  expect(sockets).toEqual([]);
  await page.goto('/real');
  await expect(page).toHaveURL('/login');
});

test('selected case → selected ATM explanation → synthetic transaction → alert acknowledgement → case resolution', async ({ page }) => {
  let prediction = structuredClone(FALLBACK_PREDICTIONS[selectedCase]);
  let alerts = structuredClone(FALLBACK_ALERTS);
  let cases = structuredClone(FALLBACK_CASES);
  const mutations: string[] = [];
  const explanations: string[] = [];
  let transactionBody: Record<string, unknown> | undefined;
  await page.addInitScript(() => {
    localStorage.setItem('atlas_token', 'fixture-access');
    localStorage.setItem('atlas_token_expires', String(Date.now() + 3600000));
    localStorage.setItem('investigator', JSON.stringify({ id: 'fixture', name: 'Fixture Officer', role: 'inspector' }));
  });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data: unknown;
    if (path === '/api/dashboard') data = FALLBACK_STATS;
    else if (path === '/api/cases') data = cases;
    else if (path === '/api/alerts') data = alerts;
    else if (path === '/api/cities') data = [];
    else if (path === '/api/cities/puducherry/predictions') data = FALLBACK_PREDICTIONS['CC-2026-0147'];
    else if (path === `/api/predictions/${selectedCase}`) data = prediction;
    else if (path === '/api/csrf-token') data = { csrf_token: 'fixture-csrf' };
    else if (path === `/api/model/shap/${selectedCase}`) {
      const atm = url.searchParams.get('atm_id')!;
      explanations.push(atm);
      data = { case_id: selectedCase, atm_id: atm, base_value: 0.271828, risk_score: prediction.ranked_locations.find(loc => loc.atm_id === atm)?.risk_score,
        shap_available: false, shap_method: 'MDI importance fallback', feature_contributions: [{ feature: 'distance', contribution: 0.12 }] };
    } else if (path === '/api/transactions') {
      transactionBody = route.request().postDataJSON();
      mutations.push(path);
      prediction = { ...prediction, status: 'FIXTURE TRANSACTION PROCESSED' };
      data = { updated_prediction: prediction };
    } else if (path.endsWith('/acknowledge')) {
      mutations.push(path);
      alerts = alerts.map(alert => path.includes(alert.alert_id) ? { ...alert, acknowledged: true } : alert);
      data = { ok: true };
    } else if (path === `/api/cases/${selectedCase}/resolve`) {
      mutations.push(path);
      cases = cases.map(c => c.case_id === selectedCase ? { ...c, status: 'resolved', current_risk: 'Resolved' } : c);
      data = { ok: true };
    } else {
      await route.fulfill({ status: 503, json: { detail: 'Auxiliary fixture unavailable' } });
      return;
    }
    await route.fulfill({ json: data });
  });
  await page.goto('/real/cases');
  await page.getByRole('button', { name: `View prediction for case ${selectedCase}`, exact: true }).click();
  await expect(page.getByText(`Predictions: selected case ${selectedCase}`, { exact: false })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Predictions', exact: true }).click();
  const secondAtm = prediction.ranked_locations[1].atm_id;
  await page.getByRole('row', { name: `Select ${secondAtm} for explanation` }).click();
  await expect(page.getByText('0.271828', { exact: true })).toBeVisible();
  await expect(page.getByText(/Importance fallback — not SHAP/)).toBeVisible();
  expect(explanations).toContain(secondAtm);
  await page.getByLabel('Amount (₹)', { exact: true }).fill('32000');
  await page.getByRole('button', { name: 'Simulate', exact: true }).click();
  await expect(page.getByText('FIXTURE TRANSACTION PROCESSED', { exact: true })).toBeVisible();
  expect(transactionBody).toMatchObject({ case_id: selectedCase, amount: 32000 });
  await page.getByRole('navigation').getByRole('button', { name: 'Alerts', exact: true }).click();
  await page.getByRole('button', { name: 'Acknowledge', exact: true }).first().click();
  await expect.poll(() => mutations.filter(path => path.endsWith('/acknowledge')).length).toBe(1);
  await page.getByRole('navigation').getByRole('button', { name: 'Cases', exact: true }).click();
  await page.getByRole('button', { name: 'Mark Resolved', exact: true }).click();
  await expect.poll(() => mutations.includes(`/api/cases/${selectedCase}/resolve`)).toBe(true);
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: selectedCase, exact: true }) });
  await expect(row.getByText('Resolved', { exact: true }).first()).toBeVisible();
});

test('API loading and failure never display bundled predictions', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('atlas_token', 'fixture-access');
    localStorage.setItem('atlas_token_expires', String(Date.now() + 3600000));
    localStorage.setItem('investigator', JSON.stringify({ role: 'inspector' }));
  });
  await page.route('**/api/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 503, json: { detail: 'offline' } });
  });
  await page.goto('/real');
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByText('ATM-027', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Prediction data is unavailable' })).toBeVisible();
  await expect(page.getByText('ATM-027', { exact: true })).toHaveCount(0);
});
