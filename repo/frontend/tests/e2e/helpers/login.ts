import { expect, type Page } from '@playwright/test';

/**
 * Log in through the real UI. Starts from `/` and waits for the dashboard
 * heading to become visible before returning.
 */
export async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // After successful login the router navigates to /dashboard. Wait for either
  // the URL change or the presence of an authenticated UI element.
  await Promise.race([
    page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
    page.locator('aside').waitFor({ timeout: 30_000 }),
  ]);
}

/**
 * Log out through the user menu.
 */
export async function logout(page: Page): Promise<void> {
  const signOut = page.getByRole('button', { name: /sign out/i });
  if (!(await signOut.isVisible().catch(() => false))) {
    const menuTrigger = page
      .locator('header button')
      .filter({ hasText: /admin|supervisor|hr|employee/i })
      .first();
    await menuTrigger.click();
  }
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
}
