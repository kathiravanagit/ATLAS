import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@atlas.gov');
  await page.locator('input[type="password"]').fill('admin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.describe('Map Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/real/map');
    await page.waitForTimeout(4000);
  });

  test('loads map container', async ({ page }) => {
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });
  });

  test('shows filter panel', async ({ page }) => {
    await expect(page.locator('text=Predicted Cash-Out Locations')).toBeVisible({ timeout: 10000 });
  });

  test('shows risk filter tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Critical' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Elevated' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Normal' })).toBeVisible();
  });
});
