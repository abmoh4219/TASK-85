import { test, expect } from '@playwright/test';
import { ALL_ROLES, CREDENTIALS } from './helpers/credentials';
import { login } from './helpers/login';

test.describe('Role-specific dashboards', () => {
  for (const cred of ALL_ROLES) {
    test(`${cred.role} dashboard renders without error`, async ({ page }) => {
      await login(page, cred.username, cred.password);

      await expect(page.getByRole('heading', { name: cred.dashboardHeading })).toBeVisible();

      // No error boundary fallback was triggered.
      await expect(page.getByText(/something went wrong/i)).not.toBeVisible();

      // Each role shows at least one dashboard card section. We assert on
      // text labels the DashboardPage renders per role.
      if (cred.role === 'admin') {
        await expect(page.getByText(/active alerts/i).first()).toBeVisible();
        await expect(page.getByText(/open orders/i).first()).toBeVisible();
      } else if (cred.role === 'supervisor') {
        await expect(page.getByText(/pending approvals/i).first()).toBeVisible();
        await expect(page.getByText(/active projects/i).first()).toBeVisible();
      } else if (cred.role === 'hr') {
        await expect(page.getByText(/total plans/i).first()).toBeVisible();
      } else {
        await expect(page.getByText(/my open requests/i).first()).toBeVisible();
        await expect(page.getByText(/active lab samples/i).first()).toBeVisible();
      }
    });
  }

});
