import { test, expect } from '@playwright/test';

test.describe('Voting page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vote');
  });

  test('renders the Cast Your Votes heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Cast Your Votes' })).toBeVisible();
  });

  test('shows back button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Back to home' })).toBeVisible();
  });

  test('back button returns to home', async ({ page }) => {
    await page.getByRole('button', { name: 'Back to home' }).click();
    await expect(page).toHaveURL('/home');
  });

  test('shows voting interface or no-round message', async ({ page }) => {
    // Wait for onMount + API call to complete — heading is inside {#if mounted}
    await expect(page.getByRole('heading', { name: 'Cast Your Votes' })).toBeVisible();

    const hasNoRound = await page.getByText('No Active Voting Round').isVisible().catch(() => false);
    const hasClosed = await page.getByText('Voting Has Closed').isVisible().catch(() => false);
    const hasVotingCards = await page.getByText('Rate each film with 0-3 stars').isVisible().catch(() => false);
    expect(hasNoRound || hasClosed || hasVotingCards).toBe(true);
  });

  test('shows Submit Ballot button when voting is open', async ({ page }) => {
    const isOpen = await page.getByText('Rate each film with 0-3 stars').isVisible().catch(() => false);
    if (isOpen) {
      await expect(page.getByRole('button', { name: /Submit Ballot/i })).toBeVisible();
    }
  });

  test('voting cards show poster image when metadata is available', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Cast Your Votes' })).toBeVisible();
    const isOpen = await page.getByText('Rate each film with 0-3 stars').isVisible().catch(() => false);
    if (isOpen) {
      const posters = page.locator('img[alt$=" poster"]');
      const count = await posters.count();
      if (count > 0) {
        await expect(posters.first()).toBeVisible();
        await expect(posters.first()).toHaveAttribute('src', /image\.tmdb\.org/);
      }
    }
  });
});
