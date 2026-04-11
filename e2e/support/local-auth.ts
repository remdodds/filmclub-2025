/**
 * Local-only global setup — replaces e2e/global-setup.ts for local dev runs.
 *
 * Writes the Playwright storage-state JSON directly (no browser launch, no
 * Firebase calls).  The fake tokens are accepted by the app because every API
 * call — including /auth/check — is intercepted by mock-routes.ts before it
 * reaches the real backend.
 */
import * as fs from 'fs';
import * as path from 'path';

const LOCAL_SESSION_TOKEN = 'local-dev-session-token';
const LOCAL_VISITOR_ID = 'local-visitor-001';

export default async function globalSetup() {
  const authDir = path.join('e2e', '.auth');
  const authFile = path.join(authDir, 'user.json');
  const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';

  fs.mkdirSync(authDir, { recursive: true });

  // Write the storage-state file directly — no browser navigation required.
  // Playwright's storageState format: { cookies: [], origins: [{ origin, localStorage }] }
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          { name: 'sessionToken', value: LOCAL_SESSION_TOKEN },
          { name: 'visitorId', value: LOCAL_VISITOR_ID },
          { name: 'isAdmin', value: 'true' },
        ],
      },
    ],
  };

  fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));
  console.log('[local-auth] Fake session token written to e2e/.auth/user.json');
}
