import { test, expect } from '@playwright/test';

test.describe('Dashboard Welcome Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@atlas.gov');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/real/, { timeout: 15000 });
    await page.goto('/dashboard');
  });

  test('redirects to console after login', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@atlas.gov');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/real/);
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
    await page.waitForURL(/\/real/, { timeout: 15000 });
    await page.goto('/real');
    await page.waitForTimeout(3000);
  });

  test('shows stat cards', async ({ page }) => {
    await expect(page.locator('text=Active Cases').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=High-Risk Locations').first()).toBeVisible();
    await expect(page.locator('text=Alerts Today').first()).toBeVisible();
    await expect(page.locator('text=Avg. Lead Time').first()).toBeVisible();
  });

  test('shows impact metrics', async ({ page }) => {
    await expect(page.locator('text=Estimated Exposure')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Linked Accounts Flagged')).toBeVisible();
  });

  test('shows prediction card', async ({ page }) => {
    await expect(page.locator('text=Predicted Cash-Out Location')).toBeVisible({ timeout: 10000 });
  });

  test('shows demo mode indicator', async ({ page }) => {
    await expect(page.locator('text=Demonstration Portal').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows user profile in TopNav', async ({ page }) => {
    await expect(page.locator('text=Admin').first()).toBeVisible({ timeout: 10000 });
  });
});
