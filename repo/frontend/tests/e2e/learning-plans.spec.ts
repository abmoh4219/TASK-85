import { test, expect } from '@playwright/test';
import { CREDENTIALS } from './helpers/credentials';
import { login } from './helpers/login';

test.describe('Learning plans', () => {
  test('HR sees the learning plans list', async ({ page }) => {
    await login(page, CREDENTIALS.hr.username, CREDENTIALS.hr.password);

    await page.locator('aside').getByRole('link', { name: /learning/i }).click();
    await page.waitForURL(/\/learning/);

    await expect(page.getByRole('heading', { name: /learning/i }).first()).toBeVisible();

    // Either a table row or an empty-state is visible — both are valid.
    const anyRow = page.locator('tbody tr').first();
    const emptyState = page.getByText(/no learning plans|no plans|empty/i).first();
    await expect(anyRow.or(emptyState)).toBeVisible({ timeout: 15_000 });

    // No error boundary fallback
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});
