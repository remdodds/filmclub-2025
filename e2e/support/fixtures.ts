/**
 * Extended Playwright test fixture.
 *
 * All spec files import { test, expect } from here instead of directly from
 * '@playwright/test'.  The fixture installs a small number of route
 * interceptors that must always apply (even in CI/prod runs), then — when
 * LOCAL_MOCKS=1 (set automatically by playwright.config.local.ts) — also
 * installs interceptors for every other backend API endpoint so the suite can
 * run entirely offline against a local Vite dev server.
 */
import { test as base, expect } from '@playwright/test';
import { createRequire } from 'module';
import { installMockRoutes } from './mock-routes';

// JSON imports in Node.js ESM require an import attribute; createRequire is
// the reliable cross-version alternative (matches the pattern in mock-routes.ts).
const require = createRequire(import.meta.url);
const authCheckFixture = require('../fixtures/auth-check.json');

export const test = base.extend<{ _mockRoutes: void }>({
  // auto: true — this fixture runs for every test without being explicitly
  // requested.
  _mockRoutes: [
    async ({ page }, use) => {
      // Always mock /auth/check in every test environment.
      //
      // The admin page calls api.checkSession() on every mount to verify admin
      // status server-side (added Apr 2025).  In CI / production tests the test
      // account may not be present in the Firestore admins collection, so the
      // live endpoint would return isAdmin:false and the page would redirect to
      // /home — breaking all admin tests.  Authentication itself is validated
      // once in globalSetup; re-hitting the endpoint on every page load adds
      // no additional test coverage here and causes flakiness.
      await page.route('**/api/auth/check', (route) =>
        route.fulfill({ json: authCheckFixture })
      );

      if (process.env.LOCAL_MOCKS === '1') {
        await installMockRoutes(page);
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
