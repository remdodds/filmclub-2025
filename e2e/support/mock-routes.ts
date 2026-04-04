import type { Page } from '@playwright/test';

import authCheckFixture from '../fixtures/auth-check.json';
import filmsFixture from '../fixtures/films.json';
import filmsSearchFixture from '../fixtures/films-search.json';
import filmsHistoryFixture from '../fixtures/films-history.json';
import votesCurrentFixture from '../fixtures/votes-current.json';
import historyFixture from '../fixtures/history.json';
import adminVotesFixture from '../fixtures/admin-votes.json';

const API = 'https://us-central1-filmclubapi.cloudfunctions.net/api';

/**
 * Installs page.route() interceptors for every backend endpoint the app calls.
 * Register more-specific patterns first — Playwright matches routes in
 * registration order (first match wins).
 */
export async function installMockRoutes(page: Page): Promise<void> {
  // ── Films ────────────────────────────────────────────────────────────────
  // /films/search?q=* — must come before /films/* and /films
  await page.route(`${API}/films/search**`, (route) =>
    route.fulfill({ json: filmsSearchFixture })
  );

  // /films/history — must come before /films/* (single-segment wildcard
  // would otherwise catch it first)
  await page.route(`${API}/films/history`, (route) =>
    route.fulfill({ json: filmsHistoryFixture })
  );

  // /films/:id  (GET detail, DELETE)
  await page.route(`${API}/films/*`, async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 200, json: { message: 'Film deleted' } });
    } else {
      await route.fulfill({ status: 200, json: { message: 'ok' } });
    }
  });

  // /films  (GET list, POST new)
  await page.route(`${API}/films`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, json: { message: 'Film added' } });
    } else {
      await route.fulfill({ json: filmsFixture });
    }
  });

  // ── Votes ────────────────────────────────────────────────────────────────
  // /votes/current — must come before /votes
  await page.route(`${API}/votes/current`, (route) =>
    route.fulfill({ json: votesCurrentFixture })
  );

  // /votes/results/latest — must come before /votes
  await page.route(`${API}/votes/results/latest`, (route) =>
    route.fulfill({ json: { results: [] } })
  );

  // /votes  (POST ballot)
  await page.route(`${API}/votes`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { message: 'Ballot submitted' } });
    } else {
      await route.continue();
    }
  });

  // ── History ──────────────────────────────────────────────────────────────
  await page.route(`${API}/history**`, (route) =>
    route.fulfill({ json: historyFixture })
  );

  // ── Admin ────────────────────────────────────────────────────────────────
  // /admin/votes — must come before /admin/**
  await page.route(`${API}/admin/votes`, (route) =>
    route.fulfill({ json: adminVotesFixture })
  );

  // /admin/open-round, /admin/select-winner
  await page.route(`${API}/admin/**`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { message: 'ok' } });
    } else {
      await route.continue();
    }
  });

  // ── Auth ─────────────────────────────────────────────────────────────────
  // /auth/check — must come before /auth/**
  await page.route(`${API}/auth/check`, (route) =>
    route.fulfill({ json: authCheckFixture })
  );

  // /auth/logout, /auth/google
  await page.route(`${API}/auth/**`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { message: 'ok' } });
    } else {
      await route.continue();
    }
  });
}
