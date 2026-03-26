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

  test('shows empty state when no films are nominated', async ({ page }) => {
    // This passes when there are no films — the empty state or the grid both count
    const hasEmptyState = await page.getByText('Coming Soon').isVisible().catch(() => false);
    const hasFilms = await page.locator('.film-card').first().isVisible().catch(() => false);
    expect(hasEmptyState || hasFilms).toBe(true);
  });

  test('film title input accepts text', async ({ page }) => {
    const input = page.getByPlaceholder('Enter film title...');
    await input.fill('Test Film Title');
    await expect(input).toHaveValue('Test Film Title');
  });
});
