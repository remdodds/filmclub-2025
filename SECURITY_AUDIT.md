# Security Audit — Film Club 2025

Audit date: 2026-05-08  
Auditor: Claude (automated review)

Each finding has a status field. When starting a new session to fix an issue, update it to `In Progress`. When resolved, update it to `Fixed` and note the commit.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `Open` | Not yet addressed |
| `In Progress` | Being worked on |
| `Fixed` | Resolved — commit noted |
| `Accepted` | Known risk, accepted as-is |
| `Won't Fix` | Decided not to fix (reason noted) |

---

## Summary Table

| ID | Severity | Status | Issue |
|----|----------|--------|-------|
| [C-1](#c-1-hardcoded-production-password-in-committed-scripts) | Critical | `Open` | Hardcoded password `filmclub2025` in 4 committed shell scripts |
| [C-2](#c-2-firestore-rules-expose-passwordhash-to-unauthenticated-clients) | Critical | `Open` | Firestore exposes `passwordHash` to anyone via client SDK |
| [C-3](#c-3-protobufjs-arbitrary-code-execution-transitive-dependency) | Critical | `Open` | `protobufjs` — arbitrary code execution (GHSA-xq3m-2v4x-88gg) |
| [C-4](#c-4-handlebars-javascript-injection--rce-transitive-dependency) | Critical | `Open` | `handlebars` — JavaScript injection / RCE (multiple CVEs) |
| [H-1](#h-1-vote-stuffing-visitorid-taken-from-request-body-not-session) | High | `Open` | Vote-stuffing: `visitorId` accepted from request body instead of session |
| [H-2](#h-2-any-member-can-modify-the-voting-schedule-missing-adminmiddleware) | High | `Open` | Any member can modify voting schedule — missing `adminMiddleware` |
| [H-3](#h-3-any-member-can-delete-any-other-members-film-nomination) | High | `Open` | Any member can delete any other member's nomination — no ownership check |
| [H-4](#h-4-cors-wildcard-in-production) | High | `Open` | CORS is `*` wildcard in production |
| [H-5](#h-5-session-token-not-format-validated-before-firestore-lookup) | High | `Open` | Session token not validated before Firestore lookup — quota DoS |
| [H-6](#h-6-rollup-path-traversal--arbitrary-file-write-in-build-tooling) | High | `Open` | `rollup` path traversal / arbitrary file write (GHSA-mw96-cpmx-2vgc) |
| [M-1](#m-1-isadmin-flag-trusted-from-localstorage) | Medium | `Open` | `isAdmin` flag trusted from `localStorage` — admin UI bypass |
| [M-2](#m-2-get-votescurrent-leaks-any-users-ballot) | Medium | `Open` | `GET /votes/current?visitorId=` leaks any user's ballot |
| [M-3](#m-3-post-configsetup-is-unauthenticated-and-has-a-race-condition) | Medium | `Open` | `POST /config/setup` unauthenticated and non-atomic |
| [M-4](#m-4-firestore-rules-dont-cover-votingrounds-subcollections) | Medium | `Open` | Firestore rules don't explicitly cover `votingRounds` subcollections |
| [M-5](#m-5-tmdb-api-key-exposed-in-url-query-parameter) | Medium | `Open` | TMDB API key passed as URL query param — logged by infrastructure |
| [M-6](#m-6-no-rate-limiting-on-the-authentication-endpoint) | Medium | `Open` | No rate limiting on `POST /auth/google` |
| [M-7](#m-7-fast-xml-parser-entity-expansion-dos-transitive-dependency) | Medium | `Open` | `fast-xml-parser` entity expansion DoS (transitive via `firebase-admin`) |
| [L-1](#l-1-session-tokens-are-uuid-v4) | Low | `Open` | Session tokens are UUID v4 — consider 256-bit random bytes |
| [L-2](#l-2-production-firebase-project-id-hardcoded-in-frontend-source) | Low | `Open` | Production Firebase project ID hardcoded in frontend source |
| [L-3](#l-3-film-ids-use-datenow--collision-prone-under-concurrency) | Low | `Open` | Film IDs use `Date.now()` — predictable and collision-prone |
| [L-4](#l-4-no-content-security-policy-headers) | Low | `Open` | No Content Security Policy headers |
| [L-5](#l-5-full-google-uids-returned-in-admin-ballot-api-response) | Low | `Open` | Full Google UIDs returned in admin ballot API response |

---

## Critical

---

### C-1: Hardcoded production password in committed scripts

- **Severity:** Critical
- **Status:** `Open`
- **Files:**
  - `add-test-votes.sh:13`
  - `close-voting-production.sh:13`
  - `open-voting-production.sh:13`
  - `update-voting-schedule.sh:13`

**What the vulnerability is:**

The string `filmclub2025` (the production club password) is hardcoded in plaintext in four shell scripts that are committed to the git repository. The password appears on line 13 of each script, likely as a curl argument like `--data '{"password":"filmclub2025"}'`.

Because it is in git history, even if the scripts are edited now, the password is still visible in `git log -p`. Anyone who has ever cloned or forked the repository already has it.

**What an attacker can do:**

An attacker with read access to the repository can immediately log in as a club member. If the admin UID they guess or enumerate happens to match an existing admin session, they gain full administrative access — changing the password, locking out legitimate users, manipulating voting rounds.

**How to fix:**

1. **Rotate the password immediately** via the `/admin/change-password` endpoint. Do this before anything else — fixing the scripts while the leaked password is still active doesn't help.
2. Edit each script to remove the hardcoded value. Replace with an interactive prompt or environment variable:
   ```bash
   # Option A: prompt at runtime
   read -s -p "Club password: " CLUB_PASSWORD
   
   # Option B: read from env
   CLUB_PASSWORD="${CLUB_PASSWORD:?CLUB_PASSWORD env var required}"
   ```
3. To scrub the password from git history, use `git filter-repo` or BFG Repo Cleaner. Note: this rewrites history and requires force-pushing, which is disruptive if others have cloned the repo.
4. Consider adding a pre-commit hook (e.g., `git-secrets` or `detect-secrets`) to prevent credentials being committed in future.

---

### C-2: Firestore rules expose `passwordHash` to unauthenticated clients

- **Severity:** Critical
- **Status:** `Open`
- **File:** `firestore.rules:7-10`

**What the vulnerability is:**

The Firestore security rules contain:
```
match /config/{document=**} {
  allow read: if true;
}
```

This allows any unauthenticated user — including anyone on the internet — to read the `config/club` document directly via the Firebase client SDK (e.g., `getDoc(doc(db, 'config', 'club'))`). This document contains the `passwordHash` field, which is the bcrypt hash of the club password.

The Cloud Function `GET /config` endpoint correctly strips the hash before responding, but that protection is bypassed entirely when clients read Firestore directly.

**What an attacker can do:**

An attacker makes one unauthenticated Firestore read and receives the bcrypt hash. They then run an offline dictionary/brute-force attack with no rate limiting. Tools like `hashcat` on consumer GPU hardware can test millions of bcrypt guesses per hour. A weak or predictable password (like `filmclub2025`) would fall in seconds. Even a moderately strong password may fall within hours to days given enough compute.

**How to fix:**

Separate the public config from the sensitive auth config into two Firestore documents:

1. Move `passwordHash` (and any other sensitive auth fields) to a new document, e.g., `config/auth`.
2. Update the Firestore rules to explicitly deny client reads on that document:
   ```
   match /config/auth {
     allow read: if false;
     allow write: if false;
   }
   
   match /config/{document=**} {
     allow read: if true;  // public config fields only
   }
   ```
3. Update the Cloud Functions that verify the password to read from `config/auth` instead of `config/club`.
4. Migrate the existing `passwordHash` field from `config/club` to `config/auth` in Firestore.

---

### C-3: `protobufjs` arbitrary code execution (transitive dependency)

- **Severity:** Critical
- **Status:** `Open`
- **Files:** `package.json` (frontend), `functions/package.json` (backend)
- **CVE/Advisory:** GHSA-xq3m-2v4x-88gg

**What the vulnerability is:**

Both the frontend and backend dependency trees include a vulnerable version of `protobufjs` as a transitive dependency (pulled in by `firebase` and `firebase-admin` respectively). The vulnerability allows arbitrary code execution via a prototype pollution gadget — an attacker can craft a malicious protobuf message that, when parsed, executes arbitrary JavaScript.

**What an attacker can do:**

If the vulnerable code path in `protobufjs` is reachable through the application's use of Firebase, an attacker could achieve remote code execution within the Cloud Functions environment (server-side), potentially accessing environment variables, the Firestore database with admin credentials, or making outbound network calls. On the frontend, it could result in XSS-equivalent impact in the user's browser.

**How to fix:**

```bash
# In both the root and functions directories:
npm audit fix

# If that doesn't resolve it:
npm audit fix --force  # may include breaking changes — review the diff

# Check which package pulls it in:
npm ls protobufjs
```

If a non-breaking fix is not available, check whether your Firebase SDK version has a patched release and upgrade `firebase`/`firebase-admin` to that version.

---

### C-4: `handlebars` JavaScript injection / RCE (transitive dependency)

- **Severity:** Critical
- **Status:** `Open`
- **File:** `functions/package.json`
- **CVEs:** GHSA-3mfm-83xf-c92r, GHSA-2w6w-674q-4c4q (and others)

**What the vulnerability is:**

The backend dependency tree includes a vulnerable version of `handlebars` as a transitive dependency. Multiple CVEs affect it, including JavaScript injection via AST type confusion — where a specially crafted template object can escape the template sandbox and execute arbitrary JavaScript code on the server.

**What an attacker can do:**

If attacker-controlled input reaches Handlebars template compilation or rendering, it results in remote code execution within the Cloud Functions Node.js process. Even if Handlebars is only used internally (not with user input), the version should still be updated as a matter of hygiene — a future refactor could unknowingly introduce user-controlled data into a Handlebars call.

**How to fix:**

```bash
cd functions
npm audit fix

# Identify the dependency chain:
npm ls handlebars
```

Update whichever direct dependency is pulling in the old Handlebars version to a release that pins a safe version. If `npm audit fix` cannot resolve it automatically, you may need `npm audit fix --force` or a manual version override in `package.json` using the `overrides` field (npm 8.3+):
```json
{
  "overrides": {
    "handlebars": "^4.7.8"
  }
}
```

---

## High

---

### H-1: Vote-stuffing — `visitorId` taken from request body, not session

- **Severity:** High
- **Status:** `Open`
- **File:** `functions/src/api/votes.ts:117-163`

**What the vulnerability is:**

The `POST /votes` endpoint destructures `visitorId` from `req.body` (the untrusted client-supplied request body):

```typescript
const { visitorId, votes } = req.body;
// ...
await db.collection('votingRounds').doc(roundDoc.id)
        .collection('ballots').doc(visitorId).set({ ... });
```

The auth middleware validates the session token and sets `req.visitorId` to the authenticated user's ID — but that value is ignored. Because ballot documents are keyed by `visitorId`, a malicious user can write a ballot under any arbitrary ID they choose.

**What an attacker can do:**

- Submit multiple ballots under different made-up `visitorId` values to stuff the ballot box.
- Overwrite a known user's ballot by using their `visitorId`.
- Delete another user's effective vote by overwriting their ballot with a blank or conflicting one.

**How to fix:**

Ignore `visitorId` from the request body entirely. Use the session-derived value the middleware already provides:

```typescript
// Before (vulnerable):
const { visitorId, votes } = req.body;

// After (fixed):
const { votes } = req.body;
const visitorId = (req as any).visitorId; // set by authMiddleware from validated session
```

Apply the same fix to `GET /votes/current` (see M-2), which also accepts `visitorId` from the query string.

---

### H-2: Any member can modify the voting schedule (missing `adminMiddleware`)

- **Severity:** High
- **Status:** `Open`
- **File:** `functions/src/index.ts:122`

**What the vulnerability is:**

The route for updating the voting schedule is protected only by `authMiddleware` (requiring a valid club session), but not by `adminMiddleware` (requiring the session to belong to a designated admin):

```typescript
// Current (vulnerable):
app.put('/config/voting-schedule', authMiddleware, configApi.updateVotingSchedule);

// Compare with admin-protected routes:
app.put('/admin/change-password', authMiddleware, adminMiddleware, configApi.changePassword);
```

Any club member with a valid session token can call `PUT /config/voting-schedule` and change when voting opens and closes.

**What an attacker can do:**

A disgruntled member can repeatedly open and close voting windows at will, open a window while votes are being counted, or set past timestamps to immediately trigger scheduled Cloud Functions. They can effectively disrupt or nullify any voting round.

**How to fix:**

Add `adminMiddleware` to the route:

```typescript
app.put('/config/voting-schedule', authMiddleware, adminMiddleware, configApi.updateVotingSchedule);
```

---

### H-3: Any member can delete any other member's film nomination

- **Severity:** High
- **Status:** `Open`
- **File:** `functions/src/api/films.ts:163-188`

**What the vulnerability is:**

The `DELETE /films/:id` endpoint checks that the film exists and is in `nominated` status, but does not verify that the requesting user is the person who added it. The `data.addedBy` field is stored on every film document but is never compared against the session's `visitorId`.

**What an attacker can do:**

Any club member can silently delete any other member's film nomination. If they know (or can enumerate) film IDs, they can remove a film they don't want to win before the voting round opens. The victim gets no notification.

**How to fix:**

Add an ownership check before allowing deletion:

```typescript
const film = await filmRef.get();
const data = film.data();

if (data.addedBy !== (req as any).visitorId) {
  // Allow admins to override
  const isAdmin = await checkIsAdmin((req as any).visitorId);
  if (!isAdmin) {
    return res.status(403).json({ error: 'You can only delete your own nominations' });
  }
}
```

---

### H-4: CORS wildcard in production

- **Severity:** High
- **Status:** `Open`
- **File:** `functions/src/index.ts:32-44`

**What the vulnerability is:**

The Cloud Functions API sets `Access-Control-Allow-Origin: *`, allowing requests from any origin. The code even contains a comment acknowledging this should be restricted in production, but it never was:

```typescript
// allow all origins for now - restrict in production
```

**What an attacker can do:**

Any website on the internet can make cross-origin requests to the API. In isolation this is limited (the attacker still needs a valid session token), but combined with any XSS vulnerability on an unrelated site that has access to the victim's localStorage, it becomes a token exfiltration pathway. It also means phishing sites can silently interact with the API on behalf of users.

**How to fix:**

Restrict allowed origins to your specific Firebase Hosting domain:

```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://filmclubapi.web.app',
  credentials: true,
}));
```

Set `ALLOWED_ORIGIN` as a Firebase Functions environment variable so it can differ between dev and production environments.

---

### H-5: Session token not format-validated before Firestore lookup

- **Severity:** High
- **Status:** `Open`
- **File:** `functions/src/utils/auth.ts:67-83`

**What the vulnerability is:**

The `validateSession()` function immediately performs a Firestore document read using the raw bearer token value from the `Authorization` header, without first checking whether it looks like a valid session token:

```typescript
async function validateSession(token: string) {
  const doc = await db.collection('sessions').doc(token).get(); // token is unvalidated
  // ...
}
```

A `isValidSessionToken()` function exists in `auth.logic.ts` (presumably a UUID regex check) but is never called here.

**What an attacker can do:**

By flooding the endpoint with requests containing garbage bearer tokens (arbitrary strings, very long strings, etc.), an attacker forces a Firestore read on every request. This burns through the project's free-tier Firestore quota, increases latency for real users, and potentially incurs unexpected cost. This is a cheap denial-of-service attack.

**How to fix:**

Validate the token format before touching Firestore:

```typescript
import { isValidSessionToken } from '../auth/auth.logic';

async function validateSession(token: string) {
  if (!isValidSessionToken(token)) {
    return null; // reject immediately, no Firestore read
  }
  const doc = await db.collection('sessions').doc(token).get();
  // ...
}
```

---

### H-6: `rollup` path traversal / arbitrary file write in build tooling

- **Severity:** High
- **Status:** `Open`
- **File:** `package.json`
- **Advisory:** GHSA-mw96-cpmx-2vgc

**What the vulnerability is:**

The frontend's `rollup` dependency (used by Vite under the hood) has a path traversal vulnerability that allows an attacker to write arbitrary files to the filesystem during a build. This is exploitable if a malicious rollup plugin or a compromised dependency is used during the build process.

**What an attacker can do:**

In a CI/CD pipeline or developer's machine, a supply-chain-compromised build plugin could exploit this to write malicious files anywhere the build process has filesystem access — potentially overwriting built output, injecting code into the deployed frontend bundle, or writing to system paths.

**How to fix:**

```bash
npm audit fix
```

Check that rollup is upgraded to the patched version. If Vite pins a specific rollup version, you may need to upgrade Vite as well.

---

## Medium

---

### M-1: `isAdmin` flag trusted from `localStorage`

- **Severity:** Medium
- **Status:** `Open`
- **File:** `src/lib/stores.ts:18, 34`

**What the vulnerability is:**

After a successful login, `isAdmin: true` or `false` is written to `localStorage`. On subsequent page loads, this value is read back with `localStorage.getItem('isAdmin') === 'true'` and used to control rendering of the admin navigation link and admin UI components.

A user can open browser DevTools and run `localStorage.setItem('isAdmin', 'true')` to make the admin UI appear.

**What an attacker can do:**

Any club member (or anyone who gets past the password screen) can reveal the admin panel's UI. The backend still enforces `adminMiddleware` on actual API calls, so they can't take admin actions — but they can see what admin functionality exists, what endpoints are called, and what data structures are used, which reduces the effort required for further attacks.

**How to fix:**

Do not use `localStorage` as the source of truth for the `isAdmin` state. The `/auth/check` endpoint already returns `isAdmin` from the server. Re-derive the admin state from that response on each page load instead of from localStorage:

```typescript
// On app load, fetch fresh state from server rather than reading localStorage
const { isAdmin } = await api.checkAuth(); // use server response, not localStorage
```

If you want to avoid a flash of the wrong UI on load, you can keep a cached value in localStorage as a hint for the initial render, but always immediately overwrite it with the server response.

---

### M-2: `GET /votes/current` leaks any user's ballot

- **Severity:** Medium
- **Status:** `Open`
- **File:** `functions/src/api/votes.ts:29`

**What the vulnerability is:**

The endpoint `GET /votes/current?visitorId=<id>` accepts a `visitorId` query parameter and returns that user's ballot. There is no check that the requesting user's session matches the `visitorId` they're querying for.

**What an attacker can do:**

Any authenticated club member can retrieve any other member's ballot, violating vote privacy. If visitorIds are Google UIDs (which are sometimes guessable or obtainable from other Google services), an attacker can enumerate all ballots.

**How to fix:**

Derive the `visitorId` from the authenticated session, not the query string:

```typescript
// Before (vulnerable):
const visitorId = req.query.visitorId;

// After (fixed):
const visitorId = (req as any).visitorId; // from authMiddleware
```

---

### M-3: `POST /config/setup` is unauthenticated and has a race condition

- **Severity:** Medium
- **Status:** `Open`
- **Files:** `functions/src/index.ts:121`, `functions/src/api/config.ts:51`

**What the vulnerability is:**

The `/config/setup` endpoint — which sets the initial club password and admin user — has no authentication requirement. It checks whether the club is already configured with a plain Firestore read before writing, but this check-then-set is not atomic. Two simultaneous requests could both see "not configured," both proceed, and the second write would overwrite the first.

**What an attacker can do:**

During the brief window after a fresh deployment before a legitimate admin runs setup, an attacker who knows the endpoint URL can set their own password and nominate their own UID as admin. The race condition could also be exploited with a precise timing attack against an existing setup if the Firestore document is ever deleted.

**How to fix:**

Use a Firestore transaction to make the check-then-set atomic:

```typescript
await db.runTransaction(async (transaction) => {
  const configRef = db.collection('config').doc('club');
  const configDoc = await transaction.get(configRef);
  if (configDoc.exists && configDoc.data()?.configured) {
    throw new Error('Already configured');
  }
  transaction.set(configRef, { ...newConfig, configured: true });
});
```

Additionally, consider gating this endpoint with an environment variable (`ALLOW_SETUP=true`) that is only set during the initial deployment and disabled afterwards.

---

### M-4: Firestore rules don't explicitly cover `votingRounds` subcollections

- **Severity:** Medium
- **Status:** `Open`
- **File:** `firestore.rules:19-22`

**What the vulnerability is:**

The Firestore rules cover `match /votingRounds/{roundId}` (the top-level document) but not the subcollections beneath it: `/votingRounds/{roundId}/ballots/{ballotId}` and `/votingRounds/{roundId}/metadata/results`. Firestore defaults to deny for paths without an explicit rule, so currently these are implicitly denied.

The problem is architectural fragility: if the rule is ever updated to use `{roundId=**}` (recursive wildcard) to make the top-level rule simpler, it would inadvertently grant whatever permission is stated to all subcollection documents too. The implicit deny is also misleading — a developer reading the rules would assume subcollections inherit the parent's rule.

**How to fix:**

Add explicit deny rules for the subcollections to make the intent unambiguous:

```
match /votingRounds/{roundId} {
  allow read: if true;
  allow write: if false;
}

match /votingRounds/{roundId}/ballots/{ballotId} {
  allow read: if false;
  allow write: if false;
}

match /votingRounds/{roundId}/metadata/{document} {
  allow read: if false;
  allow write: if false;
}
```

---

### M-5: TMDB API key exposed in URL query parameter

- **Severity:** Medium
- **Status:** `Open`
- **File:** `functions/src/tmdb/tmdb.ts:43, 87, 142`

**What the vulnerability is:**

All three TMDB API calls pass the API key as a URL query parameter (`?api_key=<key>`). Query parameters are recorded in:
- Cloud Functions request logs (visible to anyone with GCP IAM access)
- Any reverse proxy or CDN access logs between the function and TMDB
- TMDB's own server-side access logs
- Browser DevTools Network tab if calls are proxied through the client

**What an attacker can do:**

Anyone with access to GCP logs can extract the TMDB API key. With the key, they can make unlimited TMDB API calls billed to the project's account, potentially exhausting the rate limit or incurring charges.

**How to fix:**

TMDB supports `Authorization: Bearer <token>` header authentication. Switch to using the header instead:

```typescript
const response = await fetch(`https://api.themoviedb.org/3/search/movie?query=${query}`, {
  headers: {
    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
    'Content-Type': 'application/json',
  },
});
```

Remove `api_key=` from all three call sites in `tmdb.ts`.

---

### M-6: No rate limiting on the authentication endpoint

- **Severity:** Medium
- **Status:** `Open`
- **File:** `functions/src/index.ts:90`

**What the vulnerability is:**

The `POST /auth/google` endpoint (which verifies the club password via bcrypt) has no rate limiting. While bcrypt's computational cost provides some natural slowdown per request, an attacker using multiple IPs or cloud VMs can still make a large number of attempts per hour.

**What an attacker can do:**

An attacker can perform an online dictionary attack against the club password, trying common passwords, wordlists, or variations of known strings (such as the club name and year). With no lockout or throttle, this runs indefinitely.

**How to fix:**

Add `express-rate-limit` to the functions package:

```bash
cd functions && npm install express-rate-limit
```

Apply it to the auth route:

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per 15 minutes
  message: { error: 'Too many login attempts, please try again later' },
});

app.post('/auth/google', authLimiter, authApi.login);
```

Alternatively, implement Firebase App Check to require a valid app attestation token on all requests.

---

### M-7: `fast-xml-parser` entity expansion DoS (transitive dependency)

- **Severity:** Medium
- **Status:** `Open`
- **File:** `functions/package.json`
- **CVEs:** GHSA-m7jm-9gc2-mpf2, GHSA-jmr7-xgp7-cmfj

**What the vulnerability is:**

The backend dependency tree includes a vulnerable version of `fast-xml-parser` as a transitive dependency (pulled in by `firebase-admin`). Vulnerabilities include XML entity expansion (billion laughs attack) and entity encoding bypass that can lead to injection.

**What an attacker can do:**

If the vulnerable XML parsing code path is reachable from attacker-controlled input (e.g., via Firebase Admin SDK handling of XML-formatted data), it could cause a denial of service via memory exhaustion or allow injection attacks.

**How to fix:**

```bash
cd functions && npm audit fix
```

If the fix requires a newer `firebase-admin`, upgrade it and run the test suite to check for breaking changes.

---

## Low

---

### L-1: Session tokens are UUID v4

- **Severity:** Low
- **Status:** `Open`
- **File:** `functions/src/utils/auth.ts:9`

**What the vulnerability is:**

Session tokens are generated with `uuidv4()`, which provides 122 bits of actual randomness (128 bits minus the version/variant bits). This is sufficient for a small-scale application but below the 256-bit standard recommended for session tokens.

**How to fix:**

```typescript
import crypto from 'crypto';
const sessionToken = crypto.randomBytes(32).toString('hex'); // 256-bit
```

Update `isValidSessionToken()` in `auth.logic.ts` to accept the new hex format (64-character hex string) instead of UUID format.

---

### L-2: Production Firebase project ID hardcoded in frontend source

- **Severity:** Low
- **Status:** `Open`
- **File:** `src/lib/api.ts:3`

**What the vulnerability is:**

```typescript
const API_BASE = 'https://us-central1-filmclubapi.cloudfunctions.net/api';
```

The production Cloud Functions URL, including the Firebase project name `filmclubapi`, is hardcoded. This makes it impossible to test against a local emulator or staging environment without editing source code, and exposes the project name for enumeration.

**How to fix:**

Use a Vite environment variable:

```typescript
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5001/filmclubapi/us-central1/api';
```

Set `VITE_API_BASE=https://us-central1-filmclubapi.cloudfunctions.net/api` in `.env.production`. Add `.env.production` to `.gitignore` if it contains sensitive values, or commit it if it's non-sensitive (the URL itself is not a secret but the pattern is good practice).

---

### L-3: Film IDs use `Date.now()` — collision-prone under concurrency

- **Severity:** Low
- **Status:** `Open`
- **File:** `functions/src/films/films.logic.ts:133`

**What the vulnerability is:**

```typescript
id: id || `film-${Date.now()}`  // UUID would be better in production
```

The code comment even acknowledges the issue. `Date.now()` returns millisecond-precision timestamps. Under concurrent nominations, two requests arriving within the same millisecond produce the same ID — the second Firestore write silently overwrites the first, losing one nomination with no error.

**How to fix:**

```typescript
import { v4 as uuidv4 } from 'uuid'; // already in the project dependencies

id: id || `film-${uuidv4()}`
```

---

### L-4: No Content Security Policy headers

- **Severity:** Low
- **Status:** `Open`
- **Files:** `firebase.json`, `functions/src/index.ts`

**What the vulnerability is:**

The application sets no Content Security Policy (CSP) headers. CSP is a browser security feature that restricts which scripts, styles, and resources can load on a page. Without it, any XSS vulnerability that is introduced in the future has no additional browser-level mitigation.

**How to fix:**

Add CSP headers in `firebase.json` under the hosting configuration:

```json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self'; img-src 'self' https://image.tmdb.org; connect-src 'self' https://us-central1-filmclubapi.cloudfunctions.net; frame-ancestors 'none';"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          }
        ]
      }
    ]
  }
}
```

Adjust the `connect-src` and `img-src` directives to match actual external origins used by the app.

---

### L-5: Full Google UIDs returned in admin ballot API response

- **Severity:** Low
- **Status:** `Open`
- **Files:** `functions/src/api/admin.ts:72`, `src/routes/admin/+page.svelte:629`

**What the vulnerability is:**

`GET /admin/votes` returns the full `visitorId` (Google UID) for each ballot. The admin UI truncates it to 8 characters for display, but the full UID is present in the API JSON response. Google UIDs are stable, long-lived identifiers that can potentially be linked to other Google services or used to correlate a user across platforms.

**How to fix:**

Truncate or hash the UID server-side before including it in the response, since the admin has no need for the full UID:

```typescript
// In admin.ts, when building the ballot list:
ballots.map(b => ({
  ...b,
  visitorId: b.visitorId.substring(0, 8), // truncate server-side
}))
```

---

## Dependency Audit Commands

Run these in a fresh session to get a current vulnerability list (the above reflects findings at audit time and may not be exhaustive after package updates):

```bash
# Frontend dependencies
npm audit

# Backend dependencies
cd functions && npm audit

# Attempt automatic fixes
npm audit fix
cd functions && npm audit fix
```

---

*Last updated: 2026-05-08*
