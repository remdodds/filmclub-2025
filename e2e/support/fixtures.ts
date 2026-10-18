/**
 * Extended Playwright test fixture.
 *
 * All spec files import { test, expect } from here instead of directly from
 * '@playwright/test'.
 *
 * The _mockRoutes fixture runs automatically for every test.  It always
 * installs the full set of API route interceptors so the suite works in every
 * environment — CI, local dev, or against the deployed app — without requiring
 * real-network access to Cloud Functions.
 *
 * Strategy (important — Playwright uses LIFO route matching):
 *   1. Call installMockRoutes() first.  Its handlers are registered "early"
 *      so they have lower priority in LIFO.
 *   2. Register admin-restricted overrides *after* installMockRoutes so they
 *      are tried *first* and always win over the broader /auth/** catch-all
 *      that mock-routes registers (which does route.continue() for GETs and
 *      would otherwise send /auth/check to the real backend).
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
  // auto: true — runs for every test without being explicitly requested.
  _mockRoutes: [
    async ({ page }, use) => {
      // Step 1: install the full set of mocks (history, films, votes, etc.).
      // These are registered "early" → lower LIFO priority.
      await installMockRoutes(page);

      // Step 2: register admin-restricted overrides *after* installMockRoutes
      // so they take LIFO precedence over mock-routes' /auth/** catch-all.
      //
      // /auth/check — admin page calls this on every mount.  The CI test
      // account is not in the Firestore admins collection, so the live
      // endpoint returns isAdmin:false and the page redirects to /home.
      await page.route('**/api/auth/check', (route) =>
        route.fulfill({ json: authCheckFixture })
      );

      // /admin/** — single handler with URL dispatch to avoid a second LIFO
      // ordering problem between a specific /admin/votes pattern and a
      // broader /admin/** catch-all.
      await page.route('**/api/admin/**', async (route) => {
        if (route.request().url().includes('/admin/votes')) {
          await route.fulfill({ json: adminVotesFixture });
        } else {
          await route.fulfill({ json: { message: 'ok' } });
        }
      });

      await use();
    },
    { auto: true },
  ],
});

export { expect };
