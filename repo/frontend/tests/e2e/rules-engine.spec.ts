import { test, expect } from '@playwright/test';
import { CREDENTIALS } from './helpers/credentials';
import { login } from './helpers/login';

test.describe('Rules engine', () => {
  test('admin can navigate to the rules engine page', async ({ page }) => {
    await login(page, CREDENTIALS.admin.username, CREDENTIALS.admin.password);

    await page.locator('aside').getByRole('link', { name: /rules engine/i }).click();
    await page.waitForURL(/\/rules-engine/);

    await expect(page.getByRole('heading', { name: /rules engine|business rules/i }).first())
      .toBeVisible();
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});
