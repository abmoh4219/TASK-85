import { test, expect } from '@playwright/test';
import { CREDENTIALS } from './helpers/credentials';
import { login } from './helpers/login';

test.describe('Lab samples', () => {
  test('employee can open the lab page and the new sample form', async ({ page }) => {
    await login(page, CREDENTIALS.employee.username, CREDENTIALS.employee.password);

    await page.locator('aside').getByRole('link', { name: /lab/i }).first().click();
    await page.waitForURL(/\/lab/);
    await expect(page.getByRole('heading', { name: /lab operations/i })).toBeVisible();

    await page.getByRole('button', { name: /new sample/i }).first().click();
    await page.waitForURL(/\/lab\/new/);
    await expect(page.getByRole('heading', { name: /new lab sample/i })).toBeVisible();

    // Form fields are present
    await expect(page.getByPlaceholder(/blood, urine, tissue/i)).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /submit sample/i })).toBeVisible();
  });
});
