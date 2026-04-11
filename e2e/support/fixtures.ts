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
const adminVotesFixture = require('../fixtures/admin-votes.json');

export const test = base.extend<{ _mockRoutes: void }>({
  // auto: true — this fixture runs for every test without being explicitly
  // requested.
  _mockRoutes: [
    async ({ page }, use) => {
      // Always mock admin-restricted endpoints in every test environment.
      //
      // These routes require the test account to exist in the Firestore admins
      // collection.  In CI the test account is a regular member, so the live
      // backend returns 403 / isAdmin:false — breaking all admin-page tests.
      // Authentication is verified once in globalSetup; these mocks let the
      // admin UI tests run regardless of Firestore membership.

      // /auth/check — admin page calls this on every mount to verify admin status.
      await page.route('**/api/auth/check', (route) =>
        route.fulfill({ json: authCheckFixture })
      );

      // Single handler for all /admin/** routes — mirrors the approach in
      // mock-routes.ts to avoid LIFO-ordering problems.  Playwright processes
      // routes in reverse-registration order (last-in, first-matched), so two
      // separate registrations (**/api/admin/votes then **/api/admin/**) would
      // always have the catch-all win and return the wrong shape, causing a
      // Svelte rendering crash (data.candidates is undefined).
      await page.route('**/api/admin/**', async (route) => {
        if (route.request().url().includes('/admin/votes')) {
          await route.fulfill({ json: adminVotesFixture });
        } else {
          await route.fulfill({ json: { message: 'ok' } });
        }
      });

      if (process.env.LOCAL_MOCKS === '1') {
        await installMockRoutes(page);
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
