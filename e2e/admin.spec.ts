import { test, expect } from '@playwright/test';

test.describe('Admin panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  test('renders the Admin Panel heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
  });

  test('shows the voting round status section', async ({ page }) => {
    await page.waitForSelector('.loading', { state: 'detached', timeout: 10_000 }).catch(() => {});
    await expect(page.getByRole('heading', { name: 'Voting Round Status' })).toBeVisible();
  });

  test('shows a Refresh button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });

  test('shows back button that navigates to home', async ({ page }) => {
    await page.getByRole('button', { name: '← Back' }).click();
    await expect(page).toHaveURL('/home');
  });

  test('shows open or closed round status badge', async ({ page }) => {
    // Use .or() with toBeVisible() so Playwright retries until one of the badges appears
    const openBadge = page.getByText('Open', { exact: true });
    const closedBadge = page.getByText('Closed / No active round');
    await expect(openBadge.or(closedBadge)).toBeVisible({ timeout: 15_000 });
  });

  test('shows Open Voting Round button when no round is active', async ({ page }) => {
    await page.waitForSelector('.loading', { state: 'detached', timeout: 10_000 }).catch(() => {});

    const isClosed = await page.getByText('Closed / No active round').isVisible().catch(() => false);
    if (isClosed) {
      await expect(page.getByRole('button', { name: 'Open Voting Round' })).toBeVisible();
    }
  });

  test('shows Run Winner Selection button when a round is open', async ({ page }) => {
    await page.waitForSelector('.loading', { state: 'detached', timeout: 10_000 }).catch(() => {});

    const isOpen = await page.getByText('Open').isVisible().catch(() => false);
    if (isOpen) {
      await expect(page.getByRole('button', { name: 'Run Winner Selection' })).toBeVisible();
    }
  });
});
