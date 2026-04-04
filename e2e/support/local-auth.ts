/**
 * Local-only global setup — replaces e2e/global-setup.ts for local dev runs.
 *
 * Instead of calling Firebase and the production API, this injects hardcoded
 * fake tokens into the browser's localStorage and saves the storage state so
 * all authenticated tests can reuse it.
 *
 * The tokens are accepted by the app because every API call is intercepted by
 * mock-routes.ts before it reaches the real backend.
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const LOCAL_SESSION_TOKEN = 'local-dev-session-token';
const LOCAL_VISITOR_ID = 'local-visitor-001';

export default async function globalSetup() {
  const authDir = path.join('e2e', '.auth');
  const authFile = path.join(authDir, 'user.json');
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

  fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the app so we are on the correct origin before touching
  // localStorage.  The page may redirect to the login route while loading
  // (no real auth check can succeed here) — that is fine.
  await page.goto(baseURL).catch(() => {});

  await page.evaluate(
    ({ token, id }) => {
      localStorage.setItem('sessionToken', token);
      localStorage.setItem('visitorId', id);
    },
    { token: LOCAL_SESSION_TOKEN, id: LOCAL_VISITOR_ID }
  );

  await context.storageState({ path: authFile });
  await browser.close();

  console.log('[local-auth] Fake session token written to e2e/.auth/user.json');
}
