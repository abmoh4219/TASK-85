import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for MeridianMed frontend.
 *
 * Services (frontend-test + backend-test + postgres-test) are started
 * externally by docker-compose. This config has NO webServer block.
 *
 * Override base URL / creds via env vars:
 *   E2E_BASE_URL=http://localhost:3000
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    ignoreHTTPSErrors: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        },
      },
    },
  ],
});
