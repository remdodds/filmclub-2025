import { test, expect } from './support/fixtures';

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
});
