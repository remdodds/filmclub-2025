import { test, expect } from '@playwright/test';

test.describe('Nominated Films page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/films');
  });

  test('renders the Nominations heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Nominations' })).toBeVisible();
  });

  test('shows the Add Film form', async ({ page }) => {
    await expect(page.getByLabel('Add Film')).toBeVisible();
    await expect(page.getByPlaceholder('Enter film title...')).toBeVisible();
    await expect(page.getByRole('button', { name: /Nominate/i })).toBeVisible();
  });

  test('shows the nominated films count', async ({ page }) => {
    // The subtitle shows "N film(s) nominated"
    await expect(page.getByText(/film.*nominated/i)).toBeVisible();
  });

  test('back button returns to home', async ({ page }) => {
    await page.getByRole('button', { name: 'Back to home' }).click();
    await expect(page).toHaveURL('/home');
  });

  test('shows empty state or film list after loading', async ({ page }) => {
    // Wait for onMount + API call to complete — input is inside {#if mounted}
    await expect(page.getByPlaceholder('Enter film title...')).toBeVisible();

    const hasEmptyState = await page.getByRole('heading', { name: 'Coming Soon' }).isVisible().catch(() => false);
    const hasFilms = await page.locator('h3').first().isVisible().catch(() => false);
    expect(hasEmptyState || hasFilms).toBe(true);
  });

  test('film title input accepts text', async ({ page }) => {
    const input = page.getByPlaceholder('Enter film title...');
    await input.fill('Test Film Title');
    await expect(input).toHaveValue('Test Film Title');
  });

  test('film cards show release year when metadata is available', async ({ page }) => {
    await expect(page.getByPlaceholder('Enter film title...')).toBeVisible();
    const yearSpans = page.locator('h3 span').filter({ hasText: /^\(\d{4}\)$/ });
    const count = await yearSpans.count();
    // If any films have metadata, years are shown in (YYYY) format
    if (count > 0) {
      await expect(yearSpans.first()).toBeVisible();
    }
  });

  test('film cards show poster image when metadata is available', async ({ page }) => {
    await expect(page.getByPlaceholder('Enter film title...')).toBeVisible();
    const posters = page.locator('img[alt$=" poster"]');
    const count = await posters.count();
    if (count > 0) {
      await expect(posters.first()).toBeVisible();
      await expect(posters.first()).toHaveAttribute('src', /image\.tmdb\.org/);
    }
  });

  test('shows TMDB attribution when any film has metadata', async ({ page }) => {
    await expect(page.getByPlaceholder('Enter film title...')).toBeVisible();
    const posters = page.locator('img[alt$=" poster"]');
    const hasPoster = (await posters.count()) > 0;
    if (hasPoster) {
      await expect(page.getByText('Film data provided by TMDB')).toBeVisible();
    }
  });
});
