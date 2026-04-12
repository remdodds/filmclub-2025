import { test, expect } from './support/fixtures';

test.describe('Admin panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    // Wait for the page to be interactive: the Refresh button only becomes
    // enabled once the admin/votes API call completes, which also ensures
    // SvelteKit's client-side router has fully initialised before any test
    // interacts with the page.
    await page.getByRole('button', { name: 'Refresh' }).waitFor({ timeout: 10_000 }).catch(() => {});
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

  test('shows the Change Club Password section', async ({ page }) => {
    await page.waitForSelector('.loading', { state: 'detached', timeout: 10_000 }).catch(() => {});
    await expect(page.getByRole('heading', { name: 'Change Club Password' })).toBeVisible();
  });

  test('change password form has current, new, and confirm fields', async ({ page }) => {
    await page.waitForSelector('.loading', { state: 'detached', timeout: 10_000 }).catch(() => {});
    await expect(page.locator('#currentPassword')).toBeVisible();
    await expect(page.locator('#newPassword')).toBeVisible();
    await expect(page.locator('#confirmNewPassword')).toBeVisible();
  });

  test('Change Password button is disabled when fields are empty', async ({ page }) => {
    await page.waitForSelector('.loading', { state: 'detached', timeout: 10_000 }).catch(() => {});
    await expect(page.getByRole('button', { name: 'Change Password' })).toBeDisabled();
  });

  test('Change Password button enables when all fields are filled', async ({ page }) => {
    await page.waitForSelector('.loading', { state: 'detached', timeout: 10_000 }).catch(() => {});
    await page.locator('#currentPassword').fill('OldPass123!');
    await page.locator('#newPassword').fill('NewPass123!');
    await page.locator('#confirmNewPassword').fill('NewPass123!');
    await expect(page.getByRole('button', { name: 'Change Password' })).toBeEnabled();
  });

  test('shows the Change Club Name section', async ({ page }) => {
    await page.waitForSelector('.loading', { state: 'detached', timeout: 10_000 }).catch(() => {});
    await expect(page.getByRole('heading', { name: 'Change Club Name' })).toBeVisible();
  });

  test('Save Club Name button is disabled when field is empty', async ({ page }) => {
    await page.waitForSelector('.loading', { state: 'detached', timeout: 10_000 }).catch(() => {});
    await expect(page.getByRole('button', { name: 'Save Club Name' })).toBeDisabled();
  });

  test('Save Club Name button enables when a name is entered', async ({ page }) => {
    await page.waitForSelector('.loading', { state: 'detached', timeout: 10_000 }).catch(() => {});
    await page.locator('#newClubName').fill('New Club Name');
    await expect(page.getByRole('button', { name: 'Save Club Name' })).toBeEnabled();
  });
});
