import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://us-central1-filmclubapi.cloudfunctions.net/api';

async function getFirebaseIdToken(apiKey: string, email: string, password: string): Promise<string> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Firebase sign-in failed: ${err?.error?.message ?? res.status}`);
  }
  const data = await res.json();
  return data.idToken as string;
}

async function getSessionToken(idToken: string, clubPassword: string): Promise<{ sessionToken: string; visitorId: string; isAdmin: boolean }> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, password: clubPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Backend auth failed: ${err?.error ?? res.status}`);
  }
  return res.json();
}

export default async function globalSetup() {
  const authDir = path.join('e2e', '.auth');
  const authFile = path.join(authDir, 'user.json');
  const baseURL = process.env.E2E_BASE_URL || 'https://filmclubapi.web.app';

  const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY;
  const testEmail = process.env.E2E_TEST_EMAIL;
  const testPassword = process.env.E2E_TEST_PASSWORD;
  const clubPassword = process.env.E2E_CLUB_PASSWORD;

  fs.mkdirSync(authDir, { recursive: true });

  if (!firebaseApiKey || !testEmail || !testPassword || !clubPassword) {
    console.warn(
      'Missing E2E auth env vars (VITE_FIREBASE_API_KEY, E2E_TEST_EMAIL, E2E_TEST_PASSWORD, E2E_CLUB_PASSWORD).\n' +
      'Authenticated tests will be skipped or fail.'
    );
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  // Get a fresh Firebase ID token on every run — no expiry concerns
  const idToken = await getFirebaseIdToken(firebaseApiKey, testEmail, testPassword);
  const { sessionToken, visitorId, isAdmin } = await getSessionToken(idToken, clubPassword);

  // Inject into browser localStorage and save storageState
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.evaluate(
    ({ token, id, admin }) => {
      localStorage.setItem('sessionToken', token);
      localStorage.setItem('visitorId', id);
      localStorage.setItem('isAdmin', String(admin));
    },
    { token: sessionToken, id: visitorId, admin: isAdmin }
  );
  await context.storageState({ path: authFile });
  await browser.close();
}
