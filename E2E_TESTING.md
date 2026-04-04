# E2E Testing — Playwright

## Overview

Frontend behaviour is covered by Playwright end-to-end tests, not unit tests. There are no Svelte component unit tests. If you change a page — heading text, a placeholder, a URL, a button label, or the empty-state copy — the corresponding spec **must** be updated in the same commit.

## Running Tests

```bash
# Run all E2E tests (requires E2E env vars — see below)
npx playwright test

# Run a single spec
npx playwright test e2e/films.spec.ts

# UI mode (headed, step-through)
npx playwright test --ui

# CI mode (set in playwright.config.ts automatically)
CI=true npx playwright test
```

## Environment Variables Required

```
VITE_FIREBASE_API_KEY    # Firebase API key
E2E_TEST_EMAIL           # Google account email for test user
E2E_TEST_PASSWORD        # Google account password for test user
E2E_CLUB_PASSWORD        # Shared club password
E2E_BASE_URL             # Override base URL (default: https://filmclubapi.web.app)
```

Authentication is handled once in `e2e/global-setup.ts`, which fires before any spec runs. It authenticates via Firebase and stores the session token in `e2e/.auth/user.json`. All specs in the `authenticated` project reuse this stored state.

## Spec Files and What They Cover

| File | Route(s) | Tests |
|------|----------|-------|
| `e2e/auth.spec.ts` | `/` | Login form, Google button, unauthenticated redirects |
| `e2e/home.spec.ts` | `/home` | Heading, all nav cards visible, navigation to each page |
| `e2e/films.spec.ts` | `/films`, `/films/nominate` | Nominations list page + nominate search page |
| `e2e/vote.spec.ts` | `/vote` | Voting interface, submit ballot, no-round state |
| `e2e/history.spec.ts` | `/history` | History records, expand/collapse round details |
| `e2e/admin.spec.ts` | `/admin` | Round status, open/close round buttons |

## Route → Spec Mapping

When you modify a route, these are the spec files you **must** check:

| Route | Spec file(s) |
|-------|-------------|
| `/` | `auth.spec.ts` |
| `/home` | `home.spec.ts` |
| `/films` | `films.spec.ts` (first describe block) |
| `/films/nominate` | `films.spec.ts` (second describe block) |
| `/vote` | `vote.spec.ts` |
| `/history` | `history.spec.ts` |
| `/admin` | `admin.spec.ts` |

Also check `home.spec.ts` whenever you add, remove, or rename a nav card on the home page.

## Common Selectors Used

Tests rely on semantic selectors wherever possible:

```typescript
page.getByRole('heading', { name: '...' })   // h1/h2/h3 by text
page.getByRole('button', { name: /regex/i }) // buttons by label
page.getByPlaceholder('...')                 // inputs by placeholder
page.getByLabel('...')                       // inputs by <label> text
page.getByText('...')                        // any element by text content
page.locator('.css-class')                   // CSS class fallback (avoid where possible)
```

**When you rename a heading, button, placeholder, or label — find every test that selects it and update the selector.**

## What Triggers a Spec Update

Any of the following changes on a frontend page requires reviewing the corresponding spec:

- Renaming a page heading (`<h1>`, `<h2>`)
- Changing a button's label text or `aria-label`
- Changing an `<input>` placeholder or `<label>` text
- Changing empty-state copy
- Adding or removing a navigation card on `/home`
- Adding a new page route
- Changing a route URL
- Removing a page or merging two pages into one

## Playwright Config Summary

Config lives in `playwright.config.ts` at the project root.

- **Base URL**: `https://filmclubapi.web.app` (override with `E2E_BASE_URL`)
- **Timeout**: 30 seconds per test
- **Two projects**:
  - `unauthenticated` — runs only `auth.spec.ts`, no stored auth state
  - `authenticated` — runs all other specs, uses `e2e/.auth/user.json`
- **CI**: 1 worker, retries on failure, GitHub reporter
- **Local**: list reporter, no retries

## Adding Tests for a New Page

1. Create `e2e/<route-name>.spec.ts`
2. Add it to the `authenticated` project in `playwright.config.ts` if it requires login (all routes except `/` do)
3. At minimum, cover:
   - The page heading renders
   - The back/nav button works
   - The main content area shows (loaded state or empty state)
   - Any interactive elements (forms, buttons) are present
4. Add a navigation test in `home.spec.ts` if the page is linked from the home screen
