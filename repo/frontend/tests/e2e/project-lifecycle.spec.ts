import { test, expect } from '@playwright/test';
import { CREDENTIALS } from './helpers/credentials';
import { login } from './helpers/login';

test.describe('Projects', () => {
  test('admin creates a project and opens its detail page', async ({ page }) => {
    await login(page, CREDENTIALS.admin.username, CREDENTIALS.admin.password);

    await page.locator('aside').getByRole('link', { name: /projects/i }).click();
    await page.waitForURL(/\/projects/);
    await expect(page.getByRole('heading', { name: /^projects$/i })).toBeVisible();

    await page.getByRole('button', { name: /new project/i }).first().click();
    await expect(page.getByRole('heading', { name: /new project/i })).toBeVisible();

    const title = `E2E Project ${Date.now()}`;
    await page.getByPlaceholder(/project title/i).fill(title);
    await page.getByPlaceholder(/optional description/i).fill('Created by Playwright e2e test.');

    await page.getByRole('button', { name: /create project/i }).click();

    // The newly created project should appear in the table.
    const row = page.locator('tr', { hasText: title });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Click into its detail page.
    await row.getByRole('button', { name: /view/i }).click();
    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 15_000 });
    await expect(page.getByText(title).first()).toBeVisible();
  });
});
