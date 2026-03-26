import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://filmclubapi.web.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
