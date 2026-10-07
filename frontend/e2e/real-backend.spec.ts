import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { percent } from '../src/lib/metrics';

// Opt-in because this exercises installed Python dependencies and real model
// artifacts. It never connects to an existing backend/database or SMS provider.
test('real backend isolated investigation: login → case → exact ATM → transaction → acknowledgement → resolution', async ({ page }) => {
  test.skip(process.env.ATLAS_REAL_BACKEND_E2E !== '1', 'Set ATLAS_REAL_BACKEND_E2E=1 to run the isolated TestClient integration');
  test.setTimeout(120000);
  const child = spawn(process.env.ATLAS_TEST_PYTHON || 'python', ['-B', path.resolve('e2e/backend_bridge.py')], {
    cwd: process.cwd(), env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let diagnostics = '';
  let stopping = false;
  child.stderr.on('data', data => { diagnostics += String(data); });
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  let sequence = 0;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    try {
      const value = JSON.parse(line);
      if (value.ready) readyResolve();
      else if (value.fatal) readyReject(new Error(`${value.fatal}\n${diagnostics}`));
      else {
        const waiter = pending.get(value.id);
        pending.delete(value.id);
        if (value.error) waiter?.reject(new Error(value.error)); else waiter?.resolve(value);
      }
    } catch (error) { readyReject(new Error(`Invalid bridge response: ${String(error)}\n${diagnostics}`)); }
  });
  child.on('error', error => readyReject(error));
  child.on('exit', code => {
    if (code) readyReject(new Error(`Backend bridge exited ${code}\n${diagnostics}`));
    for (const waiter of pending.values()) waiter.reject(new Error(`Backend bridge exited ${code}\n${diagnostics}`));
    pending.clear();
  });
  const rpc = (body: Record<string, unknown>) => new Promise<any>((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ id, ...body }) + '\n');
  });
  const watchdog = setTimeout(() => { child.kill(); readyReject(new Error('Isolated backend exceeded 110-second bound')); }, 130000);
  try {
    await ready;
    const browserErrors: string[] = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    // Block external fonts/tiles and the production alert WebSocket. All API
    // requests below execute actual FastAPI handlers via TestClient transport.
    await page.route('**/*', route => new URL(route.request().url()).hostname !== 'localhost' ? route.abort() : route.continue());
    await page.routeWebSocket('**/ws/**', socket => socket.close());
    const snapshots: Record<string, any> = {};
    await page.route('**/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (stopping) { await route.abort(); return; }
      let response;
      try {
        response = await rpc({ method: request.method(), path: url.pathname + url.search, headers: await request.allHeaders(), body: request.postData() });
      } catch (error) {
        if (stopping) { await route.abort().catch(() => {}); return; }
        throw error;
      }
      if (response.status === 200) {
        try { snapshots[url.pathname + url.search] = JSON.parse(response.body); } catch { /* Non-JSON responses remain real transport responses. */ }
      }
      await route.fulfill({ status: response.status, headers: response.headers, body: response.body });
    });
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('frontend-e2e@example.invalid');
    await page.locator('input[type="password"]').fill('isolated-e2e-password');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/real', { timeout: 20000 });
    await expect(page.getByText('Prevented Fraud', { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Prevented Fraud', { exact: true }).locator('..')).toContainText('Not measured');
    await page.getByRole('navigation').getByRole('button', { name: 'Cases', exact: true }).click();
    await page.getByRole('button', { name: 'View prediction for case CASE-INTEGRATION-001', exact: true }).click();
    await expect(page.getByText(/Predictions: selected case CASE-INTEGRATION-001/)).toBeVisible({ timeout: 20000 });
    await page.getByRole('navigation').getByRole('button', { name: 'Predictions', exact: true }).click();
    await expect.poll(() => snapshots['/api/predictions/CASE-INTEGRATION-001']?.ranked_locations?.length).toBeGreaterThan(1);
    const prediction = snapshots['/api/predictions/CASE-INTEGRATION-001'];
    const atm = prediction.ranked_locations[1].atm_id;
    await page.getByRole('row', { name: `Select ${atm} for explanation` }).click();
    const explanationPath = `/api/model/shap/CASE-INTEGRATION-001?atm_id=${encodeURIComponent(atm)}`;
    await expect.poll(() => snapshots[explanationPath]?.atm_id, { timeout: 20000 }).toBe(atm);
    const explanation = snapshots[explanationPath];
    expect(explanation.case_id).toBe('CASE-INTEGRATION-001');
    await expect(page.getByRole('region', { name: 'Selected ATM explainability' })).not.toContainText('Explanation unavailable:');
    if (explanation.base_value == null) {
      await expect(page.getByText(/No base value supplied/)).toBeVisible();
      expect(explanation.shap_available).toBe(false);
    } else {
      await expect(page.getByText(String(explanation.base_value), { exact: true })).toBeVisible();
      if (explanation.explanation_units === 'probability') {
        const reconstructed = explanation.base_value + explanation.feature_contributions.reduce((sum: number, feature: any) => sum + feature.contribution, 0);
        expect(reconstructed).toBeCloseTo(explanation.explanation_probability, 4);
        expect(reconstructed * 100).toBeCloseTo(explanation.risk_score, 0);
      }
    }
    const transactionResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/transactions' && response.request().method() === 'POST');
    await page.getByLabel('Amount (₹)', { exact: true }).fill('32000');
    await page.getByRole('button', { name: 'Simulate', exact: true }).click();
    expect((await transactionResponse).status()).toBe(200);
    await expect.poll(() => snapshots['/api/transactions']?.updated_prediction?.case_id).toBe('CASE-INTEGRATION-001');
    await page.getByRole('navigation').getByRole('button', { name: 'Alerts', exact: true }).click();
    const seedAlert = page.locator('.card').filter({ has: page.getByText('Synthetic seeded investigation alert', { exact: true }) }).last();
    await seedAlert.getByRole('button', { name: 'Acknowledge', exact: true }).click();
    await expect(seedAlert.getByText(/Acknowledged at/)).toBeVisible();
    await page.getByRole('navigation').getByRole('button', { name: 'Cases', exact: true }).click();
    await page.getByRole('button', { name: 'Mark Resolved', exact: true }).click();
    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'CASE-INTEGRATION-001', exact: true }) });
    await expect(row.getByText('Resolved', { exact: true }).first()).toBeVisible();
    const { report } = await rpc({ operation: 'verify' });
    expect(report.case_status).toBe('resolved');
    expect(report.acknowledged).toBe(true);
    expect(report.transactions).toBe(1);
    expect(report.transaction_amount).toBe(32000);
    expect(report.audit_actions).toEqual(expect.arrayContaining(['Transaction Simulated', 'Case Resolved']));
    expect(report.notification_states.every((state: string) => state === 'queued')).toBe(true);
    await page.getByRole('navigation').getByRole('button', { name: 'Model Card', exact: true }).click();
    const performance = page.getByRole('heading', { name: 'Performance Metrics', exact: true }).locator('..');
    await expect(performance).toBeVisible({ timeout: 20000 });
    const card = snapshots['/api/model/card'];
    expect(card).toBeDefined();
    for (const [label, field] of [['Accuracy', 'accuracy'], ['Precision', 'precision'], ['Recall', 'recall'], ['F1 Score', 'f1_score']]) {
      await expect(performance.getByText(label, { exact: true }).locator('..')).toContainText(percent(card[field]));
    }
    if (card.roc_curve == null) await expect(page.getByText(/ROC curve: Unavailable/)).toBeVisible();
    expect(report.trace.filter((entry: any) => entry.status >= 500)).toEqual([]);
    expect(browserErrors).toEqual([]);
    console.log(`Real backend investigation passed: ${report.trace.length} API calls; ${report.notification_states.length} notification jobs queued, no dispatch.`);
  } finally {
    stopping = true;
    clearTimeout(watchdog);
    if (child.exitCode == null) {
      await Promise.race([rpc({ operation: 'shutdown' }).catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
      child.stdin.end();
      // Allow TestClient sessions and TemporaryDirectory to clean up before kill.
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
      if (child.exitCode == null) child.kill();
    }
    lines.close();
  }
});
