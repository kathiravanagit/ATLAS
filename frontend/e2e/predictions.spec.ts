import { test, expect } from '@playwright/test';

async function loginAs(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@atlas.gov');
  await page.locator('input[type="password"]').fill('admin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/real/, { timeout: 15000 });
}

test.describe('Simulate Transaction', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/real/predictions');
    await page.waitForTimeout(3000);
  });

  test('shows simulate transaction section', async ({ page }) => {
    const heading = page.locator('text=Simulate').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('shows ephemeral disclaimer', async ({ page }) => {
    await expect(page.locator('text=ephemeral')).toBeVisible({ timeout: 10000 });
  });
});
