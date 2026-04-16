import { test, expect } from '@playwright/test';
import { CREDENTIALS } from './helpers/credentials';
import { login } from './helpers/login';

test.describe('Procurement', () => {
  test('employee can navigate to procurement and open create-request form', async ({ page }) => {
    await login(page, CREDENTIALS.employee.username, CREDENTIALS.employee.password);

    await page.locator('aside').getByRole('link', { name: /procurement|my requests/i }).first().click();
    await page.waitForURL(/\/procurement/);
    await expect(page.getByRole('heading', { name: /procurement|my requests/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /new request/i }).first().click();
    await page.waitForURL(/\/procurement\/new/);
    await expect(page.getByRole('heading', { name: /new purchase request/i })).toBeVisible();
  });
});
