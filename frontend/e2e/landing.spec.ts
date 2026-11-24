import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('loads successfully and shows title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ATLAS|SIH|Cybercrime/i);
  });

  test('displays hero section with project name', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Rank the cash-out locations/i })).toBeVisible();
  });

  test('shows the investigator console button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Open investigator console/i })).toBeVisible();
  });

  test('navigates to login on CTA click', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Open investigator console/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows problem statement reference', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=cybercrime').first()).toBeVisible();
  });
});
