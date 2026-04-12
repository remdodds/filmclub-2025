import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup() {
  const authDir = path.join('e2e', '.auth');
  const authFile = path.join(authDir, 'user.json');
  const baseURL = process.env.E2E_BASE_URL || 'https://filmclubapi.web.app';

  fs.mkdirSync(authDir, { recursive: true });

  // All API calls in e2e tests are intercepted by mock routes (mock-routes.ts /
  // fixtures.ts), so the session token never reaches the real backend. We write
  // fake-but-valid-looking auth state directly so the app's auth store initialises
  // in the logged-in + admin state, matching what the /auth/check mock returns.
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.evaluate(() => {
    localStorage.setItem('sessionToken', 'e2e-test-session');
    localStorage.setItem('visitorId', 'local-visitor-001');
    localStorage.setItem('isAdmin', 'true');
  });
  await context.storageState({ path: authFile });
  await browser.close();
}
