import { test as browserlessTest, type Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { isPearlHarbor } from '../src/lib/easterEggs';

/**
 * Intercepts POST /films for the current test (so nothing is ever nominated
 * against a real backend) and records each POST body that gets through.
 * Routes registered later take precedence over the shared mock routes.
 */
async function stubFilmPosts(page: Page): Promise<string[]> {
  const posts: string[] = [];
  await page.route('**/api/films', async (route) => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postData() ?? '');
      await route.fulfill({ status: 201, json: { message: 'Film added' } });
    } else {
      await route.fallback();
    }
  });
  return posts;
}

/** Enough fake time for the nominate page's 350ms search debounce to fire. */
const SEARCH_DEBOUNCE_SETTLE_MS = 500;

/** The search result card containing the given film title. */
function resultCard(page: Page, title: string) {
  return page
    .locator('.results-list > div')
    .filter({ has: page.getByText(title, { exact: true }) })
    .first();
}

/**
 * Searches for a film and clicks its Nominate button.  Pass advanceClock when
 * the test has installed a fake clock, so the search debounce still fires.
 */
async function nominateFromSearch(page: Page, title: string, { advanceClock = false } = {}) {
  await page.getByPlaceholder('Type a film title...').fill(title);
  if (advanceClock) await page.clock.runFor(SEARCH_DEBOUNCE_SETTLE_MS);
  await resultCard(page, title).getByRole('button', { name: /Nominate/i }).click();
}

test.describe('Nominated Films page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/films');
  });

  test('renders the Nominated Films heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Nominated Films' })).toBeVisible();
  });

  test('shows a Nominate a Film button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nominate a Film/i })).toBeVisible();
  });

  test('Nominate a Film button navigates to nominate page', async ({ page }) => {
    // Use .first() because the page renders a second "Nominate a Film" button
    // in the empty-state section when no films exist, which would cause a strict
    // mode violation.  The header button is always the first one.
    await page.getByRole('button', { name: /Nominate a Film/i }).first().click();
    await expect(page).toHaveURL('/films/nominate');
  });

  test('shows the nominated films count', async ({ page }) => {
    await expect(page.getByText(/film.*nominated/i)).toBeVisible();
  });

  test('back button returns to home', async ({ page }) => {
    await page.getByRole('button', { name: 'Back to home' }).click();
    await expect(page).toHaveURL('/home');
  });

  test('shows empty state or film list after loading', async ({ page }) => {
    // Wait for mount to complete — heading is inside {#if mounted}
    await expect(page.getByRole('heading', { name: 'Nominated Films' })).toBeVisible();

    const hasEmptyState = await page.getByRole('heading', { name: 'No Films Yet' }).isVisible().catch(() => false);
    const hasFilms = await page.locator('h3').first().isVisible().catch(() => false);
    expect(hasEmptyState || hasFilms).toBe(true);
  });

  test('film cards show release year when metadata is available', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Nominated Films' })).toBeVisible();
    const yearSpans = page.locator('h3 span').filter({ hasText: /^\(\d{4}\)$/ });
    const count = await yearSpans.count();
    if (count > 0) {
      await expect(yearSpans.first()).toBeVisible();
    }
  });

  test('film cards show poster image when metadata is available', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Nominated Films' })).toBeVisible();
    const posters = page.locator('img[alt$=" poster"]');
    const count = await posters.count();
    if (count > 0) {
      await expect(posters.first()).toBeVisible();
      await expect(posters.first()).toHaveAttribute('src', /image\.tmdb\.org/);
    }
  });

  test('shows TMDB attribution when any film has metadata', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Nominated Films' })).toBeVisible();
    const posters = page.locator('img[alt$=" poster"]');
    const hasPoster = (await posters.count()) > 0;
    if (hasPoster) {
      await expect(page.getByText('Film data provided by TMDB')).toBeVisible();
    }
  });
});

test.describe('Nominate a Film page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/films/nominate');
  });

  test('renders the Nominate a Film heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Nominate a Film' })).toBeVisible();
  });

  test('shows the search input', async ({ page }) => {
    await expect(page.getByPlaceholder('Type a film title...')).toBeVisible();
  });

  test('back button returns to nominated films list', async ({ page }) => {
    await page.getByRole('button', { name: 'Back to nominations' }).click();
    await expect(page).toHaveURL('/films');
  });

  test('shows empty prompt before typing', async ({ page }) => {
    await expect(page.getByText('Start typing to find a film')).toBeVisible();
  });

  test('shows results list after typing a search query', async ({ page }) => {
    const input = page.getByPlaceholder('Type a film title...');
    await input.fill('The');

    // Wait for either results or no-results state
    await expect(
      page.locator('.results-list, :text("No films found"), :text("Keep typing")')
    ).toBeVisible({ timeout: 10000 });
  });

  test('search input accepts text', async ({ page }) => {
    const input = page.getByPlaceholder('Type a film title...');
    await input.fill('Inception');
    await expect(input).toHaveValue('Inception');
  });

  test('results show poster images from TMDB when available', async ({ page }) => {
    const input = page.getByPlaceholder('Type a film title...');
    await input.fill('Inception');

    // Wait for results to load
    await page.waitForSelector('.results-list', { timeout: 10000 }).catch(() => null);

    const posters = page.locator('.results-list img[alt$=" poster"]');
    const count = await posters.count();
    if (count > 0) {
      await expect(posters.first()).toHaveAttribute('src', /image\.tmdb\.org/);
    }
  });

  test('nominating Pearl Harbor shows the GET FUCKED overlay instead of submitting', async ({ page }) => {
    const filmPosts = await stubFilmPosts(page);

    await nominateFromSearch(page, 'Pearl Harbor');

    const overlay = page.getByRole('alertdialog');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('GET FUCKED');
    await expect(page).toHaveURL('/films/nominate');
    expect(filmPosts).toHaveLength(0);
  });

  test('the Pearl Harbor overlay covers the whole screen', async ({ page }) => {
    await stubFilmPosts(page);

    await nominateFromSearch(page, 'Pearl Harbor');

    const overlay = page.getByRole('alertdialog');
    await expect(overlay).toBeVisible();
    const box = await overlay.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
  });

  test('the Pearl Harbor overlay can be dismissed with its button', async ({ page }) => {
    const filmPosts = await stubFilmPosts(page);

    await nominateFromSearch(page, 'Pearl Harbor');

    const overlay = page.getByRole('alertdialog');
    await expect(overlay).toBeVisible();
    await overlay.getByRole('button', { name: /dismiss/i }).click();

    await expect(overlay).toHaveCount(0);
    await expect(page).toHaveURL('/films/nominate');
    expect(filmPosts).toHaveLength(0);
  });

  test('the Pearl Harbor overlay can be dismissed by tapping anywhere on it', async ({ page }) => {
    await stubFilmPosts(page);

    await nominateFromSearch(page, 'Pearl Harbor');

    const overlay = page.getByRole('alertdialog');
    await expect(overlay).toBeVisible();
    await overlay.click({ position: { x: 10, y: 10 } });

    await expect(overlay).toHaveCount(0);
  });

  test('the Pearl Harbor overlay can be dismissed with the Escape key', async ({ page }) => {
    await stubFilmPosts(page);

    await nominateFromSearch(page, 'Pearl Harbor');

    const overlay = page.getByRole('alertdialog');
    await expect(overlay).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(overlay).toHaveCount(0);
  });

  test('the Pearl Harbor overlay dismisses itself after 5 seconds', async ({ page }) => {
    await stubFilmPosts(page);
    await page.clock.install();

    await nominateFromSearch(page, 'Pearl Harbor', { advanceClock: true });

    const overlay = page.getByRole('alertdialog');
    await expect(overlay).toBeVisible();

    await page.clock.runFor(4_000);
    await expect(overlay).toBeVisible();

    await page.clock.runFor(1_500);
    await expect(overlay).toHaveCount(0);
  });

  test('re-opening the Pearl Harbor overlay restarts its auto-dismiss timer', async ({ page }) => {
    await stubFilmPosts(page);
    await page.clock.install();

    const overlay = page.getByRole('alertdialog');

    await nominateFromSearch(page, 'Pearl Harbor', { advanceClock: true });
    await expect(overlay).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);

    await page.clock.runFor(3_000);
    await resultCard(page, 'Pearl Harbor').getByRole('button', { name: /Nominate/i }).click();
    await expect(overlay).toBeVisible();

    // 3s into the second showing — the first showing's timer would have fired by now
    await page.clock.runFor(3_000);
    await expect(overlay).toBeVisible();
  });

  test('nominating a normal film still submits it and returns to the list', async ({ page }) => {
    const filmPosts = await stubFilmPosts(page);

    await nominateFromSearch(page, 'Inception');

    await expect(page).toHaveURL('/films');
    expect(filmPosts).toHaveLength(1);
    expect(JSON.parse(filmPosts[0])).toEqual({ title: 'Inception' });
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('each result has a Nominate button', async ({ page }) => {
    const input = page.getByPlaceholder('Type a film title...');
    await input.fill('Inception');

    await page.waitForSelector('.results-list', { timeout: 10000 }).catch(() => null);

    const hasResults = await page.locator('.results-list').isVisible().catch(() => false);
    if (hasResults) {
      await expect(page.locator('.results-list').getByRole('button', { name: /Nominate/i }).first()).toBeVisible();
    }
  });
});

// Pure, browser-free checks for the title matcher behind the easter egg.
// The frontend has no unit runner, so these run under Playwright in Node
// using the plain test object (no page, so no browser is launched).
browserlessTest.describe('Pearl Harbor title matcher', () => {
  browserlessTest('matches the British spelling "pearl harbour"', () => {
    expect(isPearlHarbor('pearl harbour')).toBe(true);
  });

  browserlessTest('matches an upper-case title with a release year "PEARL HARBOR (2001)"', () => {
    expect(isPearlHarbor('PEARL HARBOR (2001)')).toBe(true);
  });

  browserlessTest('ignores punctuation and extra whitespace', () => {
    expect(isPearlHarbor('  Pearl-Harbor!! ')).toBe(true);
    expect(isPearlHarbor('pearl   harbor')).toBe(true);
    expect(isPearlHarbor('Pearl Harbor.')).toBe(true);
  });

  browserlessTest('does not match other films', () => {
    for (const title of ['Inception', 'Pearl', 'Harbor', 'Tora! Tora! Tora!', 'Pearl Harbor 2', 'The Pearl Harbor Story', '']) {
      expect(isPearlHarbor(title), title).toBe(false);
    }
  });
});
