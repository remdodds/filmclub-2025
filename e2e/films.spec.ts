import { test, expect } from '@playwright/test';

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
    await page.getByRole('button', { name: /Nominate a Film/i }).click();
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
