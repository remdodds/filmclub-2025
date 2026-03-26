import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup() {
  const authDir = path.join('e2e', '.auth');
  const authFile = path.join(authDir, 'user.json');

  const sessionToken = process.env.E2E_SESSION_TOKEN;
  const visitorId = process.env.E2E_VISITOR_ID;
  const baseURL = process.env.E2E_BASE_URL || 'https://filmclubapi.web.app';

  if (!sessionToken || !visitorId) {
    console.warn(
      'E2E_SESSION_TOKEN or E2E_VISITOR_ID not set — authenticated tests will be skipped or fail.\n' +
      'Set these env vars with valid credentials to run the full test suite.'
    );
    // Write empty storage state so the config reference doesn't error
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(baseURL);

  // Inject the session token directly into localStorage (matches how auth.login works)
  await page.evaluate(
    ({ token, id }) => {
      localStorage.setItem('sessionToken', token);
      localStorage.setItem('visitorId', id);
    },
    { token: sessionToken, id: visitorId }
  );

  fs.mkdirSync(authDir, { recursive: true });
  await context.storageState({ path: authFile });
  await browser.close();
}
