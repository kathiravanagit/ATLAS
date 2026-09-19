import { test, expect } from '@playwright/test';

test.describe('Dashboard Welcome Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@atlas.gov');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  });

  test('redirects to dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('shows welcome content', async ({ page }) => {
    await expect(page.locator('text=Welcome').or(page.locator('text=Investigator')).first()).toBeVisible({ timeout: 10000 });
  });

  test('has link to enter console', async ({ page }) => {
    const enterBtn = page.locator('text=Enter Console').or(page.locator('text=Investigator Console')).first();
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Console Overview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@atlas.gov');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await page.goto('/real');
    await page.waitForTimeout(3000);
  });

  test('shows stat cards', async ({ page }) => {
    await expect(page.locator('text=Active Cases')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=High-Risk Locations')).toBeVisible();
    await expect(page.locator('text=Alerts Today')).toBeVisible();
    await expect(page.locator('text=Avg. Lead Time')).toBeVisible();
  });

  test('shows impact metrics', async ({ page }) => {
    await expect(page.locator('text=Prevented Fraud')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Mules Flagged')).toBeVisible();
  });

  test('shows prediction card', async ({ page }) => {
    await expect(page.locator('text=Predicted Cash-Out Location')).toBeVisible({ timeout: 10000 });
  });

  test('shows demo mode indicator', async ({ page }) => {
    await expect(page.locator('text=Demo Mode')).toBeVisible({ timeout: 10000 });
  });

  test('shows user profile in TopNav', async ({ page }) => {
    await expect(page.locator('text=Admin').first()).toBeVisible({ timeout: 10000 });
  });
});
