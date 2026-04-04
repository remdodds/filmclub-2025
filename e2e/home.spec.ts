import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/home');
  });

  test('renders the Film Club heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Film Club' })).toBeVisible();
  });

  test('shows all navigation cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Nominated Films' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nominate a Film' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cast Your Vote' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Past Premieres' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Exit' })).toBeVisible();
  });

  test('navigates to films page', async ({ page }) => {
    await page.getByRole('heading', { name: 'Nominated Films' }).click();
    await expect(page).toHaveURL('/films');
  });

  test('navigates to nominate a film page', async ({ page }) => {
    await page.getByRole('heading', { name: 'Nominate a Film' }).click();
    await expect(page).toHaveURL('/films/nominate');
  });

  test('navigates to vote page', async ({ page }) => {
    await page.getByRole('heading', { name: 'Cast Your Vote' }).click();
    await expect(page).toHaveURL('/vote');
  });

  test('navigates to history page', async ({ page }) => {
    await page.getByRole('heading', { name: 'Past Premieres' }).click();
    await expect(page).toHaveURL('/history');
  });

  test('navigates to admin page', async ({ page }) => {
    await page.getByRole('heading', { name: 'Admin' }).click();
    await expect(page).toHaveURL('/admin');
  });
});
