# Claude Code - Film Club Project

## Non-Negotiable Development Rules

1. **Always use TDD.** Never write production code without a failing test first. This is not optional.
2. **Maintain code coverage.** Coverage must not decrease. Run coverage checks before committing. If a change would reduce coverage, add the missing tests first.
3. **Follow Red-Green-Refactor strictly.** Red → Green → Refactor, in that order, every time.
4. **Always use both agents for any coding task.** Use the TDD agent to implement changes and the Code Review agent to verify the result. See [Required Agents](#required-agents) below.

---

## Required Agents

Every coding task — no matter how small — must use both agents:

### 1. TDD Agent (`tdd`)

Use this agent to implement all code changes. It enforces the Red-Green-Refactor cycle and will not write production code without a failing test first.

**Invoke for**: new features, bug fixes, refactoring, adding tests to existing code.

```
/tdd <description of what to implement>
```

### 2. Code Review Agent (`code-review`)

Use this agent after the TDD agent completes its work (or after any manual code changes). It reviews the diff for adherence to coding standards and checks that the implementation matches product requirements.

**Invoke for**: reviewing any code change before it is committed or pushed.

```
/code-review
```

### Workflow for Every Coding Task

```
1. Understand the requirement
2. Run the TDD agent to implement it  → /tdd <task>
3. Run the Code Review agent          → /code-review
4. Address any review findings (repeat from step 2 if needed)
5. Commit and push
```

---

## Project Overview

**Film Club** is a collaborative film selection web app for small groups. Members nominate films throughout the week, vote using a 0–3 rating scale (hate it → love it), and the **Condorcet algorithm** determines the winner — the film that would beat every other film in a head-to-head comparison. The app tracks watch history and prevents duplicate nominations using fuzzy title matching.

- **Live frontend**: https://filmclub-2025-21c5e.web.app
- **Live API**: https://us-central1-filmclubapi.cloudfunctions.net/api
- **GitHub**: https://github.com/remdodds/filmclub-2025
- **Target scale**: ~30 members, designed to scale to 1,000+
- **Status**: Production. Backend 100% complete. Frontend fully implemented. 254+ tests passing.

### Voting Schedule (default)

| Event | When |
|-------|------|
| Voting opens | Friday 18:00 Europe/London |
| Voting closes | Saturday 20:00 Europe/London |
| Winner announced | Saturday 20:00 (automatic) |

Voting can also be opened and closed manually by any member via the admin panel.

### Key Product Rules

- A film can only be nominated once (fuzzy duplicate detection on normalized title)
- Each member votes by rating each film 0–3; they can change their vote until the round closes
- The Condorcet winner is the film preferred over all others in pairwise comparison; if a cycle exists (Rock-Paper-Scissors paradox), total score is used as a tiebreaker
- Watch history is permanent — watched films are never re-nominated
- Authentication: Google Sign-In + a single shared club password (no per-user password management)
- Sessions last 7 days; votes are tracked by visitor ID (UUID v4), not by user account

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| SvelteKit | 5.x | UI framework and routing |
| TypeScript | 5.x | Type-safe JavaScript |
| Vite | 5.x | Dev server and bundler |
| Tailwind CSS | 4.1.18 | Utility-first styling |
| DaisyUI | 5.5.14 | Pre-built Tailwind components |
| Firebase (client) | 12.10.0 | Google Auth + Firestore client |
| @iconify/svelte | 5.2.1 | Icons |
| canvas-confetti | 1.9.4 | Winner celebration animation |
| svelte-sonner | 1.0.7 | Toast notifications |

Frontend is a **Single Page Application** (SvelteKit static adapter). All routing is client-side.

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Cloud Functions for Firebase v2 | — | Serverless Node 20 runtime |
| Express | 5.2.1 | REST API framework |
| Firebase Admin SDK | 12.x | Firestore writes, Auth verification |
| bcryptjs | 3.0.3 | Password hashing (pure JS, no native deps) |
| UUID | 13.0.0 | Visitor ID generation |
| cookie-parser | 1.4.7 | Cookie middleware |

### Infrastructure

| Service | Purpose |
|---------|---------|
| Firebase Hosting | CDN-served SPA frontend (automatic HTTPS) |
| Firestore | NoSQL document database |
| Cloud Functions | Serverless API and scheduled jobs |
| Cloud Scheduler | Cron jobs — opens/closes voting automatically |
| GitHub Actions | CI/CD pipeline; auto-deploys on push to `main` |

### Testing

| Tool | Version | Where |
|------|---------|-------|
| Jest | 30.2.0 | Backend unit + integration tests |
| ts-jest | 29.4.6 | TypeScript support for Jest |
| firebase-functions-test | 3.x | Function initialization in tests |

---

## Architecture

### Directory Structure

```
filmclub-2025/
├── src/                          # Frontend (SvelteKit)
│   ├── lib/
│   │   ├── api.ts                # Typed API client (fetch-based)
│   │   ├── firebase.ts           # Firebase client init
│   │   ├── stores.ts             # Svelte reactive stores (auth state)
│   │   ├── types.ts              # Frontend TypeScript interfaces
│   │   └── components/           # Reusable UI components
│   │       ├── CinemaCard.svelte
│   │       ├── StarRating.svelte  # 0-3 vote slider
│   │       ├── LoadingButton.svelte
│   │       └── ...
│   └── routes/                   # Pages
│       ├── +layout.svelte        # App shell
│       ├── +page.svelte          # Login
│       ├── home/+page.svelte
│       ├── films/+page.svelte    # Nomination
│       ├── vote/+page.svelte     # Voting interface
│       ├── history/+page.svelte
│       └── admin/+page.svelte
│
├── functions/src/                # Backend (Cloud Functions)
│   ├── index.ts                  # Express app + function exports
│   ├── api/                      # Thin Express route handlers
│   │   ├── auth.ts / auth.test.ts
│   │   ├── films.ts / films.test.ts
│   │   ├── votes.ts / votes.test.ts
│   │   ├── config.ts / config.test.ts
│   │   ├── history.ts / history.test.ts
│   │   └── admin.ts / admin.test.ts
│   ├── films/
│   │   └── films.logic.ts / films.logic.test.ts   # 41 tests
│   ├── voting/
│   │   ├── condorcet.ts / condorcet.test.ts        # 12 tests
│   │   └── index.ts / index.test.ts                # 9 tests (algorithm registry)
│   ├── history/
│   │   └── votingHistory.ts / votingHistory.test.ts
│   ├── utils/
│   │   ├── auth.ts / auth.test.ts
│   │   ├── auth.logic.ts / auth.logic.test.ts      # 27 tests
│   │   └── db.ts / db.test.ts
│   └── scheduled/
│       ├── openVoting.ts / openVoting.test.ts
│       └── closeVoting.ts / closeVoting.test.ts
│
├── .claude/
│   └── agents/
│       ├── tdd.md                # TDD implementation agent
│       └── code-review.md        # Standards + requirements review agent
│
├── firebase.json
├── firestore.rules               # All writes blocked client-side; Functions only
├── firestore.indexes.json
└── claude.md                     # This file
```

### Architectural Principles

**1. Business logic is pure and fully tested.**
All domain logic lives in `*.logic.ts` files and `voting/` — pure functions with no side effects, 100% test coverage. The API layer (`api/`) is a thin wrapper that calls these functions and handles HTTP concerns only.

**2. All writes go through Cloud Functions.**
Firestore rules block all client writes. The frontend only reads public data (config, films list); everything else goes through the authenticated API.

**3. Separation of concerns.**
- `utils/auth.logic.ts` — pure auth functions (no Firebase calls)
- `utils/auth.ts` — Firebase-aware session management
- `api/auth.ts` — HTTP handler (parses request, calls auth.ts, sends response)

**4. Serverless, zero-maintenance infrastructure.**
No servers to manage. Cloud Functions auto-scale. Firestore auto-scales. Cloud Scheduler handles the voting cron. Cost at ~30 members is effectively zero (free tier).

### Firestore Collections

| Collection | Purpose | Who writes |
|-----------|---------|-----------|
| `config` | Club settings, voting schedule, current round | Functions only |
| `films` | Nominated and watched films | Functions only |
| `votingRounds` | Round state, results, rankings | Functions only |
| `votes` | Member votes (private) | Functions only |
| `sessions` | Auth sessions (private) | Functions only |
| `votingHistory` | Permanent watch history | Functions only |

### API Endpoints (12 total)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/google` | None | Google sign-in + password |
| GET | `/config` | None | Club name, schedule |
| POST | `/auth/logout` | Bearer | End session |
| GET | `/auth/check` | Bearer | Verify session |
| GET | `/films` | Bearer | List nominated films |
| POST | `/films` | Bearer | Nominate film (duplicate check) |
| DELETE | `/films/:id` | Bearer | Remove film |
| GET | `/films/history` | Bearer | Watch history |
| GET | `/votes/current` | Bearer | Current voting round |
| POST | `/votes` | Bearer | Submit/update votes |
| GET | `/votes/results/latest` | Bearer | Round results |
| POST | `/admin/open-round` | Bearer | Manually open voting |
| POST | `/admin/select-winner` | Bearer | Manually close + pick winner |
| GET | `/admin/votes` | Bearer | View all votes for round |

---

## Development Approach: Test-Driven Development (TDD)

### TDD Principles

We follow strict Test-Driven Development for this project:

1. **Red-Green-Refactor Cycle**
   - **Red**: Write a failing test that describes the desired behavior
   - **Green**: Write the minimal production code to make the test pass — nothing more
   - **Refactor**: Clean up code and tests while keeping everything green

2. **Test First, Always**
   - Never write production code without a failing test
   - Tests define the API and behavior before implementation
   - Tests serve as living documentation

3. **Small Steps**
   - Write one test at a time
   - Implement the simplest solution that passes
   - Incrementally build complexity

### Testing Strategy

#### Backend (Cloud Functions)

**Test Framework**: Jest + ts-jest

- Unit tests for business logic (`*.logic.ts`, `voting/`)
- Integration tests for API endpoints (`api/*.test.ts`)
- Mock Firebase Admin SDK for isolated testing

**Running Tests**:
```bash
cd functions
npm test                      # Run all tests
npm run test:watch            # Watch mode
npm run test:coverage         # Coverage report
npm test -- auth.test.ts      # Run specific test file
```

#### Frontend (SvelteKit)

**Test Framework**: Vitest + Svelte Testing Library

**Running Tests**:
```bash
npm test                      # Run all tests
npm run test:coverage         # Coverage report
```

### TDD Workflow for This Project

#### For Each Feature:

1. **Write the test file first** — before any production code exists
2. **Write a single failing test** describing the next behavior
3. **Run it — confirm it fails** for the right reason
4. **Write the minimal implementation** to make it pass
5. **Run it — confirm it passes**
6. **Refactor** (clean names, extract constants, simplify) while staying green
7. **Repeat** from step 2 for the next behavior

### Testing Best Practices

#### DO:
- Write descriptive test names: `it('should reject a duplicate film title')`
- Test edge cases: empty strings, null, undefined, boundary values
- Use Arrange-Act-Assert pattern
- Mock external dependencies (Firebase, network calls)
- Keep tests independent and isolated
- Test behavior, not implementation details

#### DON'T:
- Skip writing tests to "move faster"
- Test private implementation details
- Write tests after the code
- Share mutable state between tests
- Make tests dependent on execution order

### Code Coverage Goals

- **Business logic** (`*.logic.ts`, `voting/`): **100%** — pure functions, no excuses
- **API endpoints** (`api/`): **90%+** — happy path + error cases
- **Scheduled functions**: **90%+** — critical automated behavior
- **Utilities** (`utils/`): **100%** — pure or near-pure functions
- **Frontend components**: **80%+** — UI behavior and user interactions

### Coverage Maintenance Rules

**Coverage must never decrease.** For any code that tests our own code (unit tests, integration tests):

1. **Before committing**: Run coverage and verify it has not dropped
   ```bash
   # Backend
   cd functions && npm run test:coverage

   # Frontend
   npm run test:coverage
   ```

2. **New code requires new tests**: Adding a function, class, or module without tests is not allowed. The test must be written first (TDD), so coverage should naturally stay intact.

3. **No coverage regressions**: If your changes cause coverage to drop below the thresholds, add the missing tests before the work is considered done.

4. **Coverage applies to our code only**: Do not count third-party libraries, generated files (`lib/`), type definitions, or config files toward targets. Mocked external dependencies (Firebase, network) do not need coverage — only code we own.

5. **Deleting code**: Removing dead code is encouraged, but delete the corresponding tests too. Do not leave orphaned tests or untested stubs.

### Firebase Testing Setup

```typescript
import * as functionsTest from 'firebase-functions-test';
import * as admin from 'firebase-admin';

const testEnv = functionsTest();

const mockFirestore = {
  collection: jest.fn(),
  doc: jest.fn(),
};

jest.spyOn(admin, 'firestore').mockReturnValue(mockFirestore as any);
```

### Continuous Integration

Tests run automatically:
- On every commit (pre-commit hook)
- On pull requests (GitHub Actions)
- Before deployment to production

### When to Write Tests

**Always write tests for**:
- Business logic (voting algorithm, film selection, duplicate detection)
- Authentication and authorization
- Data validation
- API endpoints
- Scheduled functions (open/close voting)

**Not required**:
- Type definitions
- Configuration files
- Generated build output
- UI styling (use visual regression testing instead)

---

**Remember**: If you're not writing the test first, you're not doing TDD. If you're not running both agents, you're not following the process.
