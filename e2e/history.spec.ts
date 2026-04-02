import { test, expect } from '@playwright/test';

test.describe('Voting History page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history');
  });

  test('renders the Voting History heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '📊 Voting History' })).toBeVisible();
  });

  test('shows history records or empty state', async ({ page }) => {
    const historyItem = page.getByText(/vote(s)?/).first();
    const emptyState = page.getByText('No voting history yet');
    await expect(historyItem.or(emptyState)).toBeVisible({ timeout: 15_000 });
  });

  test('can expand a history round to see details', async ({ page }) => {
    await page.waitForSelector('.loading', { state: 'detached', timeout: 10_000 }).catch(() => {});

    const showDetailsButton = page.getByRole('button', { name: /Show Details/i }).first();
    const hasRounds = await showDetailsButton.isVisible().catch(() => false);

    if (hasRounds) {
      await showDetailsButton.click();
      await expect(page.getByRole('button', { name: /Hide Details/i }).first()).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
    }
  });
});
