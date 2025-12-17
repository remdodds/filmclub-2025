# Film Club App - Technical Implementation Plan

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | SvelteKit + Tailwind CSS + DaisyUI | Simple, fast, excellent DX, great mobile-first components out of box |
| Backend | Cloud Functions for Firebase (Node.js/TypeScript) | Serverless, pay-per-use, integrates seamlessly with Firestore |
| Database | Firestore | Serverless NoSQL, autoscales, generous free tier, real-time capable |
| Hosting | Firebase Hosting | Free SSL, global CDN, simple deployment |
| Scheduling | Cloud Scheduler | Managed cron jobs, triggers Cloud Functions |
| Auth | Custom (hashed password in Firestore + HTTP-only cookies) | Simple, no external dependencies |

**Estimated Cost**: Free tier should cover 30 members easily. At 1,000 members with weekly voting: ~$1-3/month.

---

## Project Structure

```
filmclub/
├── firebase.json              # Firebase configuration
├── firestore.rules           # Security rules
├── firestore.indexes.json    # Database indexes
├── package.json
├── .env.example              # Environment template
│
├── functions/                # Cloud Functions (backend)
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts         # Function exports
│   │   ├── api/
│   │   │   ├── auth.ts      # Login/logout endpoints
│   │   │   ├── films.ts     # Film CRUD operations
│   │   │   ├── votes.ts     # Voting endpoints
│   │   │   └── config.ts    # Club configuration
│   │   ├── scheduled/
│   │   │   ├── openVoting.ts    # Opens voting window
│   │   │   └── closeVoting.ts   # Closes voting, selects winner
│   │   ├── voting/
│   │   │   ├── index.ts         # Voting algorithm interface
│   │   │   ├── condorcet.ts     # Condorcet implementation
│   │   │   └── types.ts         # Voting types
│   │   └── utils/
│   │       ├── auth.ts          # Auth helpers
│   │       └── db.ts            # Firestore helpers
│
├── src/                      # SvelteKit frontend
│   ├── app.html
│   ├── app.css               # Tailwind imports
│   ├── lib/
│   │   ├── api.ts            # API client
│   │   ├── stores.ts         # Svelte stores
│   │   └── components/
│   │       ├── FilmCard.svelte
│   │       ├── VoteSlider.svelte
│   │       ├── FilmList.svelte
│   │       └── Header.svelte
│   └── routes/
│       ├── +layout.svelte    # App shell
│       ├── +page.svelte      # Home/login
│       ├── films/
│       │   └── +page.svelte  # Film list & nomination
│       ├── vote/
│       │   └── +page.svelte  # Voting interface
│       └── history/
│           └── +page.svelte  # Watch history
│
├── static/                   # Static assets
└── tailwind.config.js
```

---

## Database Schema (Firestore)

### Collection: `config` (single document)
```typescript
// Document ID: "settings"
{
  clubName: string,
  passwordHash: string,           // bcrypt hash
  timezone: string,               // e.g., "Europe/London"
  votingSchedule: {
    openDay: number,              // 0-6 (Sunday-Saturday), default 5 (Friday)
    openTime: string,             // "09:00" (24hr format)
    closeDay: number,             // default 6 (Saturday)
    closeTime: string,            // "18:00"
  },
  votingOpen: boolean,            // Current voting state
  currentVotingRound: string | null,  // ID of active voting round
  createdAt: Timestamp
}
```

### Collection: `films`
```typescript
// Document ID: auto-generated
{
  title: string,
  titleNormalized: string,        // Lowercase for duplicate checking
  addedAt: Timestamp,
  status: "nominated" | "voting" | "watched",
  watchedAt: Timestamp | null,
  votingRoundId: string | null    // Which round this film was voted on
}
```

### Collection: `votingRounds`
```typescript
// Document ID: auto-generated
{
  openedAt: Timestamp,
  closedAt: Timestamp | null,
  filmIds: string[],              // Films included in this round
  winnerId: string | null,        // Winning film ID
  status: "open" | "closed",
  results: {                      // Populated when closed
    rankings: Array<{filmId: string, score: number}>,
    totalVotes: number,
    tieBreaker: boolean           // Was random tiebreaker used?
  } | null
}
```

### Collection: `votes`
```typescript
// Document ID: auto-generated
{
  visitorId: string,              // Anonymous visitor fingerprint
  votingRoundId: string,
  rankings: {
    [filmId: string]: number      // 0-3 ranking per film
  },
  submittedAt: Timestamp
}
```

### Collection: `sessions`
```typescript
// Document ID: session token
{
  createdAt: Timestamp,
  expiresAt: Timestamp,
  visitorId: string               // For vote deduplication
}
```

---

## Implementation Steps

### Phase 1: Project Setup

#### Step 1.1: Initialize Firebase Project
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Create new directory and initialize
mkdir filmclub && cd filmclub
firebase init

# Select:
# - Firestore
# - Functions (TypeScript)
# - Hosting
# - Emulators (for local development)
```

#### Step 1.2: Initialize SvelteKit Frontend
```bash
# In project root
npm create svelte@latest .
# Select: Skeleton project, TypeScript, ESLint, Prettier

# Install dependencies
npm install

# Add Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Add DaisyUI for components
npm install -D daisyui@latest
```

#### Step 1.3: Configure Tailwind + DaisyUI
```javascript
// tailwind.config.js
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ["light", "dark"],
  },
}
```

#### Step 1.4: Configure Firebase Hosting for SvelteKit
```bash
# Install adapter
npm install -D @sveltejs/adapter-static
```

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html', // SPA mode
    }),
  },
};
```

```json
// firebase.json - hosting section
{
  "hosting": {
    "public": "build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

---

### Phase 2: Backend Implementation

#### Step 2.1: Set Up Cloud Functions Structure
```bash
cd functions
npm install express cors bcrypt cookie-parser uuid
npm install -D @types/express @types/cors @types/bcrypt @types/cookie-parser @types/uuid
```

#### Step 2.2: Implement Auth Functions

**functions/src/utils/auth.ts**
```typescript
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';

const SALT_ROUNDS = 10;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(visitorId: string): Promise<string> {
  const token = uuidv4();
  const now = Date.now();

  await db.collection('sessions').doc(token).set({
    createdAt: new Date(now),
    expiresAt: new Date(now + SESSION_DURATION_MS),
    visitorId,
  });

  return token;
}

export async function validateSession(token: string): Promise<string | null> {
  const doc = await db.collection('sessions').doc(token).get();
  if (!doc.exists) return null;

  const data = doc.data()!;
  if (new Date(data.expiresAt.toDate()) < new Date()) {
    await doc.ref.delete();
    return null;
  }

  return data.visitorId;
}
```

**functions/src/api/auth.ts**
```typescript
import { Router } from 'express';
import { db } from '../utils/db';
import { verifyPassword, createSession, validateSession } from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/login', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  const configDoc = await db.collection('config').doc('settings').get();
  if (!configDoc.exists) {
    return res.status(500).json({ error: 'Club not configured' });
  }

  const config = configDoc.data()!;
  const valid = await verifyPassword(password, config.passwordHash);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Generate visitor ID for vote tracking
  const visitorId = req.cookies.visitorId || uuidv4();
  const sessionToken = await createSession(visitorId);

  res.cookie('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.cookie('visitorId', visitorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
  });

  return res.json({ success: true, clubName: config.clubName });
});

router.post('/logout', async (req, res) => {
  const token = req.cookies.session;
  if (token) {
    await db.collection('sessions').doc(token).delete();
  }
  res.clearCookie('session');
  return res.json({ success: true });
});

router.get('/check', async (req, res) => {
  const token = req.cookies.session;
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  const visitorId = await validateSession(token);
  if (!visitorId) {
    return res.status(401).json({ authenticated: false });
  }

  const configDoc = await db.collection('config').doc('settings').get();
  const config = configDoc.data()!;

  return res.json({
    authenticated: true,
    clubName: config.clubName,
    votingOpen: config.votingOpen,
  });
});

export default router;
```

#### Step 2.3: Implement Film Functions

**functions/src/api/films.ts**
```typescript
import { Router } from 'express';
import { db } from '../utils/db';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

// Get all nominated films
router.get('/', async (req, res) => {
  const snapshot = await db.collection('films')
    .where('status', '==', 'nominated')
    .orderBy('addedAt', 'desc')
    .get();

  const films = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return res.json(films);
});

// Add a new film
router.post('/', async (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title required' });
  }

  const normalizedTitle = title.trim().toLowerCase();

  // Check for duplicates in nominated films
  const existing = await db.collection('films')
    .where('titleNormalized', '==', normalizedTitle)
    .where('status', '==', 'nominated')
    .limit(1)
    .get();

  if (!existing.empty) {
    return res.status(409).json({ error: 'Film already nominated' });
  }

  const filmRef = await db.collection('films').add({
    title: title.trim(),
    titleNormalized: normalizedTitle,
    addedAt: FieldValue.serverTimestamp(),
    status: 'nominated',
    watchedAt: null,
    votingRoundId: null,
  });

  return res.status(201).json({ id: filmRef.id, title: title.trim() });
});

// Delete a film
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const filmRef = db.collection('films').doc(id);
  const film = await filmRef.get();

  if (!film.exists) {
    return res.status(404).json({ error: 'Film not found' });
  }

  if (film.data()!.status !== 'nominated') {
    return res.status(400).json({ error: 'Can only delete nominated films' });
  }

  await filmRef.delete();
  return res.json({ success: true });
});

// Get watch history
router.get('/history', async (req, res) => {
  const snapshot = await db.collection('films')
    .where('status', '==', 'watched')
    .orderBy('watchedAt', 'desc')
    .get();

  const films = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return res.json(films);
});

export default router;
```

#### Step 2.4: Implement Voting Algorithm

**functions/src/voting/types.ts**
```typescript
export interface Vote {
  visitorId: string;
  rankings: { [filmId: string]: number }; // 0-3
}

export interface VotingResult {
  rankings: Array<{ filmId: string; score: number }>;
  winnerId: string;
  tieBreaker: boolean;
}

export interface VotingAlgorithm {
  name: string;
  calculate(filmIds: string[], votes: Vote[]): VotingResult;
}
```

**functions/src/voting/condorcet.ts**
```typescript
import { Vote, VotingResult, VotingAlgorithm } from './types';

export const condorcetAlgorithm: VotingAlgorithm = {
  name: 'condorcet',

  calculate(filmIds: string[], votes: Vote[]): VotingResult {
    if (filmIds.length === 0) {
      throw new Error('No films to vote on');
    }

    if (filmIds.length === 1) {
      return {
        rankings: [{ filmId: filmIds[0], score: 0 }],
        winnerId: filmIds[0],
        tieBreaker: false,
      };
    }

    // Build pairwise preference matrix
    // pairwise[a][b] = number of voters who prefer a over b
    const pairwise: { [a: string]: { [b: string]: number } } = {};

    for (const filmA of filmIds) {
      pairwise[filmA] = {};
      for (const filmB of filmIds) {
        pairwise[filmA][filmB] = 0;
      }
    }

    // Count pairwise preferences
    for (const vote of votes) {
      for (const filmA of filmIds) {
        for (const filmB of filmIds) {
          if (filmA === filmB) continue;

          const rankA = vote.rankings[filmA] ?? 0;
          const rankB = vote.rankings[filmB] ?? 0;

          // Higher rank = more preferred
          if (rankA > rankB) {
            pairwise[filmA][filmB]++;
          }
        }
      }
    }

    // Calculate Copeland scores (wins - losses in pairwise comparisons)
    const scores: { [filmId: string]: number } = {};

    for (const filmA of filmIds) {
      scores[filmA] = 0;
      for (const filmB of filmIds) {
        if (filmA === filmB) continue;

        if (pairwise[filmA][filmB] > pairwise[filmB][filmA]) {
          scores[filmA]++; // Win
        } else if (pairwise[filmA][filmB] < pairwise[filmB][filmA]) {
          scores[filmA]--; // Loss
        }
        // Tie = 0
      }
    }

    // Sort by score descending
    const rankings = filmIds
      .map(filmId => ({ filmId, score: scores[filmId] }))
      .sort((a, b) => b.score - a.score);

    // Check for tie at the top
    const topScore = rankings[0].score;
    const tiedFilms = rankings.filter(r => r.score === topScore);

    let winnerId: string;
    let tieBreaker = false;

    if (tiedFilms.length > 1) {
      // Random tiebreaker
      const randomIndex = Math.floor(Math.random() * tiedFilms.length);
      winnerId = tiedFilms[randomIndex].filmId;
      tieBreaker = true;
    } else {
      winnerId = rankings[0].filmId;
    }

    return { rankings, winnerId, tieBreaker };
  },
};
```

**functions/src/voting/index.ts**
```typescript
import { VotingAlgorithm } from './types';
import { condorcetAlgorithm } from './condorcet';

// Registry of available algorithms - easy to add new ones
const algorithms: { [name: string]: VotingAlgorithm } = {
  condorcet: condorcetAlgorithm,
};

export function getAlgorithm(name: string = 'condorcet'): VotingAlgorithm {
  const algo = algorithms[name];
  if (!algo) {
    throw new Error(`Unknown voting algorithm: ${name}`);
  }
  return algo;
}

export * from './types';
```

#### Step 2.5: Implement Vote Endpoints

**functions/src/api/votes.ts**
```typescript
import { Router } from 'express';
import { db } from '../utils/db';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

// Get current voting round (if voting is open)
router.get('/current', async (req, res) => {
  const configDoc = await db.collection('config').doc('settings').get();
  const config = configDoc.data()!;

  if (!config.votingOpen || !config.currentVotingRound) {
    return res.json({ votingOpen: false });
  }

  const roundDoc = await db.collection('votingRounds').doc(config.currentVotingRound).get();
  if (!roundDoc.exists) {
    return res.json({ votingOpen: false });
  }

  const round = roundDoc.data()!;

  // Get films in this round
  const filmsSnapshot = await db.collection('films')
    .where('status', '==', 'voting')
    .get();

  const films = filmsSnapshot.docs.map(doc => ({
    id: doc.id,
    title: doc.data().title,
  }));

  // Check if this visitor already voted
  const visitorId = req.cookies.visitorId;
  let existingVote = null;

  if (visitorId) {
    const voteSnapshot = await db.collection('votes')
      .where('votingRoundId', '==', config.currentVotingRound)
      .where('visitorId', '==', visitorId)
      .limit(1)
      .get();

    if (!voteSnapshot.empty) {
      existingVote = voteSnapshot.docs[0].data().rankings;
    }
  }

  return res.json({
    votingOpen: true,
    roundId: config.currentVotingRound,
    films,
    existingVote,
  });
});

// Submit or update vote
router.post('/', async (req, res) => {
  const { rankings } = req.body;
  const visitorId = req.cookies.visitorId;

  if (!visitorId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!rankings || typeof rankings !== 'object') {
    return res.status(400).json({ error: 'Rankings required' });
  }

  // Validate rankings are 0-3
  for (const [filmId, rank] of Object.entries(rankings)) {
    if (typeof rank !== 'number' || rank < 0 || rank > 3) {
      return res.status(400).json({ error: 'Rankings must be 0-3' });
    }
  }

  const configDoc = await db.collection('config').doc('settings').get();
  const config = configDoc.data()!;

  if (!config.votingOpen || !config.currentVotingRound) {
    return res.status(400).json({ error: 'Voting is not open' });
  }

  // Check for existing vote
  const existingSnapshot = await db.collection('votes')
    .where('votingRoundId', '==', config.currentVotingRound)
    .where('visitorId', '==', visitorId)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    // Update existing vote
    await existingSnapshot.docs[0].ref.update({
      rankings,
      submittedAt: FieldValue.serverTimestamp(),
    });
  } else {
    // Create new vote
    await db.collection('votes').add({
      visitorId,
      votingRoundId: config.currentVotingRound,
      rankings,
      submittedAt: FieldValue.serverTimestamp(),
    });
  }

  return res.json({ success: true });
});

// Get last voting results
router.get('/results/latest', async (req, res) => {
  const roundSnapshot = await db.collection('votingRounds')
    .where('status', '==', 'closed')
    .orderBy('closedAt', 'desc')
    .limit(1)
    .get();

  if (roundSnapshot.empty) {
    return res.json({ hasResults: false });
  }

  const round = roundSnapshot.docs[0].data();

  // Get winner film details
  let winner = null;
  if (round.winnerId) {
    const winnerDoc = await db.collection('films').doc(round.winnerId).get();
    if (winnerDoc.exists) {
      winner = { id: winnerDoc.id, ...winnerDoc.data() };
    }
  }

  return res.json({
    hasResults: true,
    closedAt: round.closedAt,
    winner,
    results: round.results,
  });
});

export default router;
```

#### Step 2.6: Implement Scheduled Functions

**functions/src/scheduled/openVoting.ts**
```typescript
import * as functions from 'firebase-functions';
import { db } from '../utils/db';
import { FieldValue } from 'firebase-admin/firestore';

export const openVoting = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const configDoc = await db.collection('config').doc('settings').get();
    if (!configDoc.exists) return;

    const config = configDoc.data()!;

    // Already open?
    if (config.votingOpen) return;

    // Check if it's time to open
    const now = new Date();
    const tz = config.timezone || 'UTC';

    const localTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const dayOfWeek = localTime.getDay();
    const hours = localTime.getHours();
    const minutes = localTime.getMinutes();
    const currentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    const schedule = config.votingSchedule;
    if (dayOfWeek !== schedule.openDay) return;

    // Check if we're within the hour of opening
    const [openHour] = schedule.openTime.split(':').map(Number);
    if (hours !== openHour) return;

    // Get nominated films
    const filmsSnapshot = await db.collection('films')
      .where('status', '==', 'nominated')
      .get();

    if (filmsSnapshot.empty) {
      console.log('No films to vote on');
      return;
    }

    const filmIds = filmsSnapshot.docs.map(doc => doc.id);

    // Create voting round
    const roundRef = await db.collection('votingRounds').add({
      openedAt: FieldValue.serverTimestamp(),
      closedAt: null,
      filmIds,
      winnerId: null,
      status: 'open',
      results: null,
    });

    // Update films to voting status
    const batch = db.batch();
    for (const doc of filmsSnapshot.docs) {
      batch.update(doc.ref, {
        status: 'voting',
        votingRoundId: roundRef.id,
      });
    }

    // Update config
    batch.update(configDoc.ref, {
      votingOpen: true,
      currentVotingRound: roundRef.id,
    });

    await batch.commit();
    console.log(`Voting opened with ${filmIds.length} films`);
  });
```

**functions/src/scheduled/closeVoting.ts**
```typescript
import * as functions from 'firebase-functions';
import { db } from '../utils/db';
import { FieldValue } from 'firebase-admin/firestore';
import { getAlgorithm, Vote } from '../voting';

export const closeVoting = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const configDoc = await db.collection('config').doc('settings').get();
    if (!configDoc.exists) return;

    const config = configDoc.data()!;

    // Not open?
    if (!config.votingOpen || !config.currentVotingRound) return;

    // Check if it's time to close
    const now = new Date();
    const tz = config.timezone || 'UTC';

    const localTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const dayOfWeek = localTime.getDay();
    const hours = localTime.getHours();

    const schedule = config.votingSchedule;
    if (dayOfWeek !== schedule.closeDay) return;

    const [closeHour] = schedule.closeTime.split(':').map(Number);
    if (hours !== closeHour) return;

    // Get voting round
    const roundRef = db.collection('votingRounds').doc(config.currentVotingRound);
    const roundDoc = await roundRef.get();
    if (!roundDoc.exists) return;

    const round = roundDoc.data()!;

    // Get all votes
    const votesSnapshot = await db.collection('votes')
      .where('votingRoundId', '==', config.currentVotingRound)
      .get();

    const votes: Vote[] = votesSnapshot.docs.map(doc => ({
      visitorId: doc.data().visitorId,
      rankings: doc.data().rankings,
    }));

    // Calculate results
    const algorithm = getAlgorithm('condorcet');
    const results = algorithm.calculate(round.filmIds, votes);

    // Update database
    const batch = db.batch();

    // Update round
    batch.update(roundRef, {
      closedAt: FieldValue.serverTimestamp(),
      winnerId: results.winnerId,
      status: 'closed',
      results: {
        rankings: results.rankings,
        totalVotes: votes.length,
        tieBreaker: results.tieBreaker,
      },
    });

    // Update winner film to watched
    const winnerRef = db.collection('films').doc(results.winnerId);
    batch.update(winnerRef, {
      status: 'watched',
      watchedAt: FieldValue.serverTimestamp(),
    });

    // Return losing films to nominated
    for (const filmId of round.filmIds) {
      if (filmId !== results.winnerId) {
        batch.update(db.collection('films').doc(filmId), {
          status: 'nominated',
          votingRoundId: null,
        });
      }
    }

    // Update config
    batch.update(configDoc.ref, {
      votingOpen: false,
      currentVotingRound: null,
    });

    await batch.commit();
    console.log(`Voting closed. Winner: ${results.winnerId}`);
  });
```

#### Step 2.7: Main Function Entry Point

**functions/src/index.ts**
```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRouter from './api/auth';
import filmsRouter from './api/films';
import votesRouter from './api/votes';
import configRouter from './api/config';
import { validateSession } from './utils/auth';

admin.initializeApp();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Auth middleware (except for login)
app.use(async (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/check') {
    return next();
  }

  const token = req.cookies.session;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const visitorId = await validateSession(token);
  if (!visitorId) {
    return res.status(401).json({ error: 'Session expired' });
  }

  next();
});

app.use('/auth', authRouter);
app.use('/films', filmsRouter);
app.use('/votes', votesRouter);
app.use('/config', configRouter);

export const api = functions.https.onRequest(app);

// Scheduled functions
export { openVoting } from './scheduled/openVoting';
export { closeVoting } from './scheduled/closeVoting';
```

---

### Phase 3: Frontend Implementation

#### Step 3.1: API Client

**src/lib/api.ts**
```typescript
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  auth: {
    login: (password: string) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    check: () => request<{ authenticated: boolean; clubName?: string; votingOpen?: boolean }>('/auth/check'),
  },
  films: {
    list: () => request<Array<{ id: string; title: string }>>('/films'),
    add: (title: string) => request('/films', {
      method: 'POST',
      body: JSON.stringify({ title })
    }),
    delete: (id: string) => request(`/films/${id}`, { method: 'DELETE' }),
    history: () => request<Array<{ id: string; title: string; watchedAt: string }>>('/films/history'),
  },
  votes: {
    current: () => request<{ votingOpen: boolean; films?: Array<{ id: string; title: string }>; existingVote?: Record<string, number> }>('/votes/current'),
    submit: (rankings: Record<string, number>) => request('/votes', {
      method: 'POST',
      body: JSON.stringify({ rankings })
    }),
    latestResults: () => request('/votes/results/latest'),
  },
};
```

#### Step 3.2: App Layout

**src/routes/+layout.svelte**
```svelte
<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { authStore } from '$lib/stores';

  onMount(async () => {
    try {
      const result = await api.auth.check();
      authStore.set(result);
      if (!result.authenticated && $page.url.pathname !== '/') {
        goto('/');
      }
    } catch {
      authStore.set({ authenticated: false });
      if ($page.url.pathname !== '/') {
        goto('/');
      }
    }
  });

  async function logout() {
    await api.auth.logout();
    authStore.set({ authenticated: false });
    goto('/');
  }
</script>

<div class="min-h-screen bg-base-200">
  {#if $authStore.authenticated}
    <div class="btm-nav btm-nav-sm md:hidden">
      <a href="/films" class:active={$page.url.pathname === '/films'}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
        <span class="btm-nav-label">Films</span>
      </a>
      <a href="/vote" class:active={$page.url.pathname === '/vote'}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <span class="btm-nav-label">Vote</span>
      </a>
      <a href="/history" class:active={$page.url.pathname === '/history'}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="btm-nav-label">History</span>
      </a>
    </div>

    <div class="navbar bg-base-100 shadow-lg hidden md:flex">
      <div class="flex-1">
        <a href="/films" class="btn btn-ghost text-xl">{$authStore.clubName || 'Film Club'}</a>
      </div>
      <div class="flex-none">
        <ul class="menu menu-horizontal px-1">
          <li><a href="/films">Films</a></li>
          <li><a href="/vote">Vote</a></li>
          <li><a href="/history">History</a></li>
          <li><button on:click={logout}>Logout</button></li>
        </ul>
      </div>
    </div>
  {/if}

  <main class="container mx-auto p-4 pb-20 md:pb-4">
    <slot />
  </main>
</div>
```

#### Step 3.3: Login Page

**src/routes/+page.svelte**
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { authStore } from '$lib/stores';

  let password = '';
  let error = '';
  let loading = false;

  async function login() {
    if (!password) return;

    loading = true;
    error = '';

    try {
      const result = await api.auth.login(password);
      authStore.set({ authenticated: true, clubName: result.clubName });
      goto('/films');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Login failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="hero min-h-screen">
  <div class="hero-content text-center">
    <div class="max-w-md">
      <h1 class="text-5xl font-bold">Film Club</h1>
      <p class="py-6">Enter the club password to join</p>

      <form on:submit|preventDefault={login} class="form-control gap-4">
        <input
          type="password"
          bind:value={password}
          placeholder="Club password"
          class="input input-bordered w-full"
          disabled={loading}
        />

        {#if error}
          <div class="alert alert-error">
            <span>{error}</span>
          </div>
        {/if}

        <button type="submit" class="btn btn-primary" disabled={loading || !password}>
          {#if loading}
            <span class="loading loading-spinner"></span>
          {/if}
          Enter
        </button>
      </form>
    </div>
  </div>
</div>
```

#### Step 3.4: Films Page

**src/routes/films/+page.svelte**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let films: Array<{ id: string; title: string }> = [];
  let newTitle = '';
  let loading = true;
  let adding = false;
  let error = '';

  onMount(loadFilms);

  async function loadFilms() {
    loading = true;
    try {
      films = await api.films.list();
    } catch (e) {
      error = 'Failed to load films';
    } finally {
      loading = false;
    }
  }

  async function addFilm() {
    if (!newTitle.trim()) return;

    adding = true;
    error = '';

    try {
      const film = await api.films.add(newTitle.trim());
      films = [film, ...films];
      newTitle = '';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to add film';
    } finally {
      adding = false;
    }
  }

  async function deleteFilm(id: string) {
    try {
      await api.films.delete(id);
      films = films.filter(f => f.id !== id);
    } catch (e) {
      error = 'Failed to delete film';
    }
  }
</script>

<div class="space-y-4">
  <h1 class="text-2xl font-bold">Nominated Films</h1>

  <form on:submit|preventDefault={addFilm} class="flex gap-2">
    <input
      type="text"
      bind:value={newTitle}
      placeholder="Add a film..."
      class="input input-bordered flex-1"
      disabled={adding}
    />
    <button type="submit" class="btn btn-primary" disabled={adding || !newTitle.trim()}>
      {#if adding}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        Add
      {/if}
    </button>
  </form>

  {#if error}
    <div class="alert alert-error">
      <span>{error}</span>
    </div>
  {/if}

  {#if loading}
    <div class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if films.length === 0}
    <div class="text-center py-8 text-base-content/60">
      No films nominated yet. Add one above!
    </div>
  {:else}
    <ul class="space-y-2">
      {#each films as film (film.id)}
        <li class="card bg-base-100 shadow">
          <div class="card-body py-3 px-4 flex-row items-center justify-between">
            <span>{film.title}</span>
            <button
              class="btn btn-ghost btn-sm btn-circle"
              on:click={() => deleteFilm(film.id)}
            >
              ✕
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
```

#### Step 3.5: Voting Page

**src/routes/vote/+page.svelte**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let votingOpen = false;
  let films: Array<{ id: string; title: string }> = [];
  let rankings: Record<string, number> = {};
  let loading = true;
  let submitting = false;
  let submitted = false;
  let error = '';

  onMount(loadVoting);

  async function loadVoting() {
    loading = true;
    try {
      const result = await api.votes.current();
      votingOpen = result.votingOpen;
      films = result.films || [];
      rankings = result.existingVote || {};

      // Initialize missing rankings to 0
      for (const film of films) {
        if (!(film.id in rankings)) {
          rankings[film.id] = 0;
        }
      }
    } catch (e) {
      error = 'Failed to load voting';
    } finally {
      loading = false;
    }
  }

  async function submitVote() {
    submitting = true;
    error = '';

    try {
      await api.votes.submit(rankings);
      submitted = true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to submit vote';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="space-y-4">
  <h1 class="text-2xl font-bold">Vote</h1>

  {#if loading}
    <div class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if !votingOpen}
    <div class="alert">
      <span>Voting is currently closed. Check back on Friday!</span>
    </div>
  {:else}
    <p class="text-sm text-base-content/70">
      Rate each film from 0 (no preference) to 3 (strong preference)
    </p>

    {#if error}
      <div class="alert alert-error">
        <span>{error}</span>
      </div>
    {/if}

    {#if submitted}
      <div class="alert alert-success">
        <span>Vote submitted! You can update it until voting closes.</span>
      </div>
    {/if}

    <div class="space-y-4">
      {#each films as film (film.id)}
        <div class="card bg-base-100 shadow">
          <div class="card-body py-3 px-4">
            <div class="flex justify-between items-center">
              <span class="font-medium">{film.title}</span>
              <span class="badge badge-lg">{rankings[film.id]}</span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              bind:value={rankings[film.id]}
              class="range range-primary"
              step="1"
            />
            <div class="flex justify-between text-xs px-1">
              <span>0</span>
              <span>1</span>
              <span>2</span>
              <span>3</span>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <button
      class="btn btn-primary w-full"
      on:click={submitVote}
      disabled={submitting}
    >
      {#if submitting}
        <span class="loading loading-spinner"></span>
      {/if}
      {submitted ? 'Update Vote' : 'Submit Vote'}
    </button>
  {/if}
</div>
```

#### Step 3.6: History Page

**src/routes/history/+page.svelte**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let films: Array<{ id: string; title: string; watchedAt: string }> = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      films = await api.films.history();
    } catch (e) {
      error = 'Failed to load history';
    } finally {
      loading = false;
    }
  });

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
</script>

<div class="space-y-4">
  <h1 class="text-2xl font-bold">Watch History</h1>

  {#if loading}
    <div class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <span>{error}</span>
    </div>
  {:else if films.length === 0}
    <div class="text-center py-8 text-base-content/60">
      No films watched yet.
    </div>
  {:else}
    <ul class="timeline timeline-vertical">
      {#each films as film, i (film.id)}
        <li>
          {#if i > 0}<hr />{/if}
          <div class="timeline-start text-sm text-base-content/60">
            {formatDate(film.watchedAt)}
          </div>
          <div class="timeline-middle">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5 text-primary">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="timeline-end timeline-box">{film.title}</div>
          {#if i < films.length - 1}<hr />{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
```

---

### Phase 4: Deployment

#### Step 4.1: Configure Cloud Scheduler

After deploying functions, set up Cloud Scheduler jobs:

```bash
# Create scheduler for opening voting (runs hourly, checks if time matches)
gcloud scheduler jobs create pubsub open-voting \
  --schedule="0 * * * *" \
  --topic=firebase-schedule-openVoting \
  --location=us-central1

# Create scheduler for closing voting
gcloud scheduler jobs create pubsub close-voting \
  --schedule="0 * * * *" \
  --topic=firebase-schedule-closeVoting \
  --location=us-central1
```

#### Step 4.2: Initialize Club Configuration

Create a setup script or admin function:

**functions/src/api/config.ts**
```typescript
import { Router } from 'express';
import { db } from '../utils/db';
import { hashPassword } from '../utils/auth';

const router = Router();

// One-time setup (should be protected or removed after use)
router.post('/setup', async (req, res) => {
  const { clubName, password, timezone, votingSchedule } = req.body;

  const configDoc = await db.collection('config').doc('settings').get();
  if (configDoc.exists) {
    return res.status(400).json({ error: 'Club already configured' });
  }

  const passwordHash = await hashPassword(password);

  await db.collection('config').doc('settings').set({
    clubName,
    passwordHash,
    timezone: timezone || 'UTC',
    votingSchedule: votingSchedule || {
      openDay: 5,      // Friday
      openTime: '09:00',
      closeDay: 6,     // Saturday
      closeTime: '18:00',
    },
    votingOpen: false,
    currentVotingRound: null,
    createdAt: new Date(),
  });

  return res.json({ success: true });
});

// Get club config (public info only)
router.get('/', async (req, res) => {
  const configDoc = await db.collection('config').doc('settings').get();
  if (!configDoc.exists) {
    return res.status(404).json({ error: 'Club not configured' });
  }

  const config = configDoc.data()!;
  return res.json({
    clubName: config.clubName,
    timezone: config.timezone,
    votingSchedule: config.votingSchedule,
    votingOpen: config.votingOpen,
  });
});

export default router;
```

#### Step 4.3: Deploy

```bash
# Build frontend
npm run build

# Deploy everything
firebase deploy

# Or deploy separately
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore:rules
```

#### Step 4.4: Initial Setup

After deployment, call the setup endpoint once:

```bash
curl -X POST https://YOUR-PROJECT.cloudfunctions.net/api/config/setup \
  -H "Content-Type: application/json" \
  -d '{
    "clubName": "My Film Club",
    "password": "your-secret-password",
    "timezone": "Europe/London",
    "votingSchedule": {
      "openDay": 5,
      "openTime": "18:00",
      "closeDay": 6,
      "closeTime": "20:00"
    }
  }'
```

---

## Implementation Order Summary

1. **Phase 1**: Project setup (~1 session)
   - Firebase project + SvelteKit initialization
   - Tailwind + DaisyUI configuration
   - Basic project structure

2. **Phase 2**: Backend (~2-3 sessions)
   - Database schema + Firestore rules
   - Auth system (password + sessions)
   - Film CRUD endpoints
   - Voting algorithm (Condorcet)
   - Vote submission endpoints
   - Scheduled functions

3. **Phase 3**: Frontend (~2-3 sessions)
   - API client + stores
   - Login page
   - Films page (list + add + delete)
   - Voting page (rank + submit)
   - History page

4. **Phase 4**: Deployment (~1 session)
   - Firebase deployment
   - Cloud Scheduler setup
   - Initial club configuration
   - Testing end-to-end

---

## Testing Checklist

- [ ] Login with correct password
- [ ] Login rejection with wrong password
- [ ] Add film to nomination list
- [ ] Duplicate film rejection
- [ ] Delete film from list
- [ ] Manual trigger of voting open
- [ ] Submit vote during voting window
- [ ] Update existing vote
- [ ] Manual trigger of voting close
- [ ] Winner selection + moved to history
- [ ] Losing films returned to nominations
- [ ] View watch history
- [ ] Mobile responsive UI
