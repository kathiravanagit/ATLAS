import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@atlas.gov');
  await page.locator('input[type="password"]').fill('admin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/real/, { timeout: 15000 });
}

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('navigates to overview', async ({ page }) => {
    await page.goto('/real');
    await expect(page.locator('text=Cash-Out Risk Intelligence')).toBeVisible({ timeout: 15000 });
  });

  test('navigates to map', async ({ page }) => {
    await page.goto('/real/map');
    await expect(page.locator('text=Predicted Cash-Out Locations')).toBeVisible({ timeout: 15000 });
  });

  test('navigates to cases', async ({ page }) => {
    await page.goto('/real/cases');
    await expect(page.locator('text=Case').first()).toBeVisible({ timeout: 15000 });
  });

  test('navigates to data privacy', async ({ page }) => {
    await page.goto('/real/data-privacy');
    await expect(page.locator('text=Synthetic Data').first()).toBeVisible({ timeout: 15000 });
  });

  test('shows offline or live status', async ({ page }) => {
    await page.goto('/real');
    await page.waitForTimeout(2000);
    const status = page.locator('text=Offline').or(page.locator('text=Connected'));
    await expect(status.first()).toBeVisible({ timeout: 10000 });
  });
});
