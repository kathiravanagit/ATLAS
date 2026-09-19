import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('loads successfully and shows title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ATLAS|SIH|Cybercrime/i);
  });

  test('displays hero section with project name', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ATLAS' })).toBeVisible();
  });

  test('shows Access Investigator Console button', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('text=Access Investigator Console').first();
    await expect(cta).toBeVisible();
  });

  test('navigates to login on CTA click', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=Access Investigator Console').first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows problem statement reference', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=cybercrime').first()).toBeVisible();
  });
});
