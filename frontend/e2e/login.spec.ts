import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('loads login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('shows demo login quick buttons', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Inspector').first()).toBeVisible();
    await expect(page.locator('text=Analyst').first()).toBeVisible();
    await expect(page.locator('text=Bank Officer').first()).toBeVisible();
    await expect(page.locator('text=Admin').first()).toBeVisible();
  });

  test('demo button fills credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('text=Inspector').first().click();
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveValue('inspector@atlas.gov');
  });

  test('shows error on wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@atlas.gov');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 30000 });
  });

  test('shows register link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Register', exact: true })).toBeVisible();
  });

  test('navigates to register page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Register', exact: true }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});
