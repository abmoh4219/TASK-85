import { test, expect } from '@playwright/test';
import { ALL_ROLES, CREDENTIALS } from './helpers/credentials';
import { login, logout } from './helpers/login';

test.describe('Authentication', () => {
  for (const cred of ALL_ROLES) {
    test(`logs in as ${cred.role} and sees role dashboard`, async ({ page }) => {
      await login(page, cred.username, cred.password);
      await expect(page.getByRole('heading', { name: cred.dashboardHeading })).toBeVisible();
      await expect(page.getByText(new RegExp(`welcome back, ${cred.username}`, 'i'))).toBeVisible();
    });
  }

  test('shows an error for invalid credentials', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await page.getByLabel(/username/i).fill('admin');
    await page.getByLabel(/password/i).fill('definitely-wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid username or password/i)).toBeVisible();
    // Should still be on the login screen
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('logout returns to the login page', async ({ page }) => {
    const admin = CREDENTIALS.admin;
    await login(page, admin.username, admin.password);
    await expect(page.getByRole('heading', { name: admin.dashboardHeading })).toBeVisible();
    await logout(page);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});
