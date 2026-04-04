/**
 * Extended Playwright test fixture.
 *
 * All spec files import { test, expect } from here instead of directly from
 * '@playwright/test'.  The fixture is a transparent pass-through for CI/prod
 * runs.  When the LOCAL_MOCKS environment variable is set to '1' (done
 * automatically by playwright.config.local.ts), it also installs
 * page.route() interceptors for every backend API endpoint before each test,
 * so the suite can run entirely offline against a local Vite dev server.
 */
import { test as base, expect } from '@playwright/test';
import { installMockRoutes } from './mock-routes';

export const test = base.extend<{ _mockRoutes: void }>({
  // auto: true — this fixture runs for every test without being explicitly
  // requested.  It is a no-op unless LOCAL_MOCKS=1.
  _mockRoutes: [
    async ({ page }, use) => {
      if (process.env.LOCAL_MOCKS === '1') {
        await installMockRoutes(page);
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
