/**
 * Local development Playwright config.
 *
 * Run with:  npm run test:e2e:local
 *
 * Differences from playwright.config.ts (prod/CI):
 *  - baseURL points at the local Vite dev server (localhost:5173)
 *  - globalSetup uses local-auth.ts — injects fake tokens, no Firebase calls
 *  - Sets LOCAL_MOCKS=1 so the _mockRoutes fixture in e2e/support/fixtures.ts
 *    intercepts every Cloud Functions API call with local fixture data
 *  - webServer starts (or reuses) `npm run dev` automatically
 *  - No retries, HTML report stays closed
 */
import { defineConfig } from '@playwright/test';

// Tell the _mockRoutes auto-fixture to intercept API calls.
// Workers inherit process.env from the main process, so this flag is visible
// to every test that runs under this config.
process.env.LOCAL_MOCKS = '1';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/support/local-auth.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'unauthenticated',
      testMatch: '**/auth.spec.ts',
    },
    {
      name: 'authenticated',
      testIgnore: '**/auth.spec.ts',
      use: {
        storageState: 'e2e/.auth/user.json',
      },
    },
  ],
});
