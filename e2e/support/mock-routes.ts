import type { Page } from '@playwright/test';
import { createRequire } from 'module';

// JSON imports in Node.js 22 ESM require an import attribute (with { type: 'json' }),
// which not all versions of esbuild/ts-node handle.  createRequire is the reliable
// cross-version alternative.
const require = createRequire(import.meta.url);

const authCheckFixture = require('../fixtures/auth-check.json');
const filmsFixture = require('../fixtures/films.json');
const filmsSearchFixture = require('../fixtures/films-search.json');
const filmsHistoryFixture = require('../fixtures/films-history.json');
const votesCurrentFixture = require('../fixtures/votes-current.json');
const historyFixture = require('../fixtures/history.json');
const adminVotesFixture = require('../fixtures/admin-votes.json');

/**
 * Installs page.route() interceptors for every backend endpoint the app calls.
 *
 * Patterns use the glob form "**\/api/<path>" rather than the full Cloud Functions hostname so
 * that Playwright's glob engine matches reliably.  Register more-specific
 * patterns first — Playwright evaluates routes in registration order and the
 * first match wins.
 */
export async function installMockRoutes(page: Page): Promise<void> {
  // ── Films ────────────────────────────────────────────────────────────────
  // /films/search?q=* — must come before /films/* and /films
  await page.route('**/api/films/search**', (route) =>
    route.fulfill({ json: filmsSearchFixture })
  );

  // /films/history — must come before /films/* (single-segment wildcard
  // would otherwise catch it first)
  await page.route('**/api/films/history', (route) =>
    route.fulfill({ json: filmsHistoryFixture })
  );

  // /films/:id  (GET detail, DELETE)
  await page.route('**/api/films/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 200, json: { message: 'Film deleted' } });
    } else {
      await route.fulfill({ status: 200, json: { message: 'ok' } });
    }
  });

  // /films  (GET list, POST new)
  await page.route('**/api/films', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, json: { message: 'Film added' } });
    } else {
      await route.fulfill({ json: filmsFixture });
    }
  });

  // ── Votes ────────────────────────────────────────────────────────────────
  // /votes/current — must come before /votes
  await page.route('**/api/votes/current', (route) =>
    route.fulfill({ json: votesCurrentFixture })
  );

  // /votes/results/latest — must come before /votes
  await page.route('**/api/votes/results/latest', (route) =>
    route.fulfill({ json: { results: [] } })
  );

  // /votes  (POST ballot)
  await page.route('**/api/votes', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { message: 'Ballot submitted' } });
    } else {
      await route.continue();
    }
  });

  // ── History ──────────────────────────────────────────────────────────────
  await page.route('**/api/history**', (route) =>
    route.fulfill({ json: historyFixture })
  );

  // ── Admin ────────────────────────────────────────────────────────────────
  // Single handler for all /admin/* routes — dispatch by URL so the
  // more-specific /admin/votes case is never accidentally continued.
  await page.route('**/api/admin/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/admin/votes')) {
      await route.fulfill({ json: adminVotesFixture });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({ json: { message: 'ok' } });
    } else {
      await route.fulfill({ json: { message: 'ok' } });
    }
  });

  // ── Auth ─────────────────────────────────────────────────────────────────
  // /auth/check — must come before /auth/**
  await page.route('**/api/auth/check', (route) =>
    route.fulfill({ json: authCheckFixture })
  );

  // /auth/logout, /auth/google
  await page.route('**/api/auth/**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { message: 'ok' } });
    } else {
      await route.continue();
    }
  });

  // ── External resources that block page load without internet access ───────
  // Google Fonts: the CSS @import is render-blocking; return empty CSS so the
  // load event fires immediately.
  await page.route('**/fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' })
  );
  await page.route('**/fonts.gstatic.com/**', (route) =>
    route.fulfill({ contentType: 'font/woff2', body: '' })
  );

  // Firebase Auth: injects a hidden <iframe> to *.firebaseapp.com for
  // cross-origin persistence.  Without network access the iframe hangs and
  // also blocks the load event.
  await page.route('**firebaseapp.com**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' })
  );
  await page.route('**/identitytoolkit.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{}' })
  );
  await page.route('**/securetoken.googleapis.com/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ access_token: 'fake', expires_in: 3600, token_type: 'Bearer' }),
    })
  );
}
