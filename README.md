# 🎬 Film Club

A collaborative film selection app using democratic voting. Members nominate films, vote using a 0-3 scale, and the Condorcet algorithm picks the winner.

**🚀 Status**: Backend 100% Complete - Frontend Ready to Build
**📦 GitHub**: https://github.com/remdodds/filmclub-2025
**🌐 API**: https://us-central1-filmclubapi.cloudfunctions.net/api
**🔐 Password**: filmclub2025

---

## Current Status

### ✅ Completed (Backend)
- **API Deployed**: All 12 endpoints live on Firebase
- **Tests Passing**: 92 unit tests, 100% core logic coverage
- **Authentication**: Login/logout/session management working
- **Film Management**: Add/list/delete films with duplicate detection
- **Sample Data**: "The Godfather" and "Pulp Fiction" already in system
- **CI/CD**: GitHub Actions auto-deploys on push to main

### 🚧 Next Steps (Frontend)
- Login page with password authentication
- Films list with add/delete functionality
- App layout with navigation
- See `FRONTEND_GUIDE.md` for detailed guide

---

## Overview

Film Club is a SvelteKit + Firebase app that makes choosing your next group film fair and fun:

- **Nominate** - Anyone can add films to the pool
- **Vote** - Score each film 0-3 (I hate it → I love it)
- **Win** - Condorcet voting finds the film that would beat all others head-to-head
- **Watch** - Track your history and never repeat

---

## Features

### Core Functionality
✅ **Democratic Voting** - Condorcet method ensures the fairest winner
✅ **Anonymous Voting** - Visitor IDs track votes without accounts
✅ **Duplicate Prevention** - Fuzzy matching prevents re-nominations
✅ **Watch History** - Track what you've watched chronologically
✅ **Simple Auth** - One shared password for the whole club

### Technical Highlights
✅ **92 Comprehensive Tests** - TDD approach with pure business logic
✅ **Type-Safe** - Full TypeScript coverage
✅ **Serverless** - Cloud Functions scale automatically
✅ **Mobile-First** - DaisyUI responsive design

---

## Tech Stack

**Frontend**
- SvelteKit 5 - Reactive UI framework
- Tailwind CSS 4 + DaisyUI 5 - Styling
- TypeScript 5 - Type safety

**Backend**
- Firebase Cloud Functions - Serverless API
- Firestore - NoSQL database
- Firebase Hosting - Static hosting

**Testing**
- Jest - Unit & integration tests
- 92 tests covering all business logic

---

## Quick Start

### Prerequisites
```bash
node >= 18
npm >= 8
firebase-cli >= 13
```

### Installation

```bash
# Clone and install
git clone <your-repo>
cd filmclub
npm install

# Install backend dependencies
cd functions
npm install
cd ..
```

### Local Development

```bash
# Start Firebase emulators (backend + database)
firebase emulators:start

# In another terminal, start frontend dev server
npm run dev

# Access:
# - App: http://localhost:5173
# - Functions: http://localhost:5001
# - Firestore: http://localhost:8080
# - Emulator UI: http://localhost:4000
```

### Run Tests

```bash
cd functions
npm test                  # All tests
npm test:watch           # Watch mode
npm test:coverage        # Coverage report

# Run specific tests
npm test auth.logic.test.ts
npm test condorcet.test.ts
npm test films.logic.test.ts
```

### Build

```bash
# Build frontend
npm run build

# Build backend
cd functions
npm run build
```

---

## Project Structure

```
filmclub/
├── src/                          # SvelteKit frontend
│   ├── lib/
│   │   └── stores.ts             # Auth store
│   └── routes/
│       ├── +page.svelte          # Login page
│       ├── +layout.svelte        # App layout
│       ├── films/                # Film management
│       ├── vote/                 # Voting interface
│       └── history/              # Watch history
│
├── functions/                    # Cloud Functions backend
│   ├── src/
│   │   ├── utils/
│   │   │   ├── db.ts             # Firestore connection
│   │   │   ├── auth.ts           # Session management
│   │   │   └── auth.logic.ts     # Auth business logic (27 tests)
│   │   ├── films/
│   │   │   └── films.logic.ts    # Film logic (41 tests)
│   │   ├── voting/
│   │   │   ├── types.ts          # Type definitions
│   │   │   ├── condorcet.ts      # Voting algorithm (12 tests)
│   │   │   └── index.ts          # Algorithm registry (9 tests)
│   │   ├── api/                  # Express endpoints (TODO)
│   │   ├── scheduled/            # Cron jobs (TODO)
│   │   └── index.ts              # Main entry point (TODO)
│   ├── package.json
│   └── jest.config.js
│
├── static/                       # Static assets
├── firebase.json                 # Firebase config
├── firestore.rules               # Security rules
├── firestore.indexes.json        # Database indexes
│
└── Documentation/
    ├── README.md                 # This file
    ├── REQUIREMENTS.md           # Project requirements
    ├── TECHNICAL_PLAN.md         # Implementation guide
    ├── PROJECT_PROGRESS.md       # Progress tracker
    └── claude.md                 # Development notes
```

---

## How It Works

### 1. Setup Your Club
```bash
curl -X POST https://us-central1-filmclubapi.cloudfunctions.net/api/config/setup \
  -H "Content-Type: application/json" \
  -d '{
    "clubName": "Friday Film Club",
    "password": "your-secure-password",
    "timezone": "Europe/London",
    "votingSchedule": {
      "openDay": 5,
      "openTime": "18:00",
      "closeDay": 6,
      "closeTime": "20:00"
    }
  }'
```

**Note**: Club is already configured with:
- Name: "Film Club"
- Password: filmclub2025
- Timezone: Europe/London
- Voting: Friday 18:00 - Saturday 20:00

### 2. Nominate Films
Members add films throughout the week. Duplicates are automatically detected.

### 3. Vote
On Friday at 6pm, voting opens. Everyone rates each film 0-3:
- 0 = "I hate this idea"
- 1 = "Meh, I guess"
- 2 = "Sounds good!"
- 3 = "Yes! Let's watch this!"

### 4. Winner Selected
Saturday at 8pm, voting closes. The Condorcet algorithm picks the winner:
- Compares every film head-to-head
- The film that would beat all others wins
- If no clear winner (cycle), highest total score wins

### 5. Watch & Track
Film is marked as watched, saved to history, removed from nominations.

---

## Voting Algorithm

We use the **Condorcet method** because it's the fairest:

### Example
3 voters, 3 films (A, B, C):

```
Voter 1: A(3), B(2), C(1)
Voter 2: B(3), A(2), C(1)
Voter 3: C(3), B(2), A(1)
```

**Head-to-head comparisons:**
- A vs B: B wins (2 voters prefer B)
- B vs C: B wins (2 voters prefer B)
- A vs C: Tie (1 each)

**Result:** B is the Condorcet winner (beats all others)

### Handling Cycles
If no clear winner exists (Rock beats Scissors, Scissors beats Paper, Paper beats Rock), we use total score as a tiebreaker.

---

## Development Notes

### Architecture Philosophy
We use **clean separation** between business logic and integration:

- **Business Logic** (pure functions) - Fully tested with unit tests
- **Integration Layer** (Firebase/Express) - Tested via emulators

This means:
✅ Tests track your app's functionality, not library behavior
✅ Easy to maintain and refactor
✅ High confidence in correctness

### Test Coverage
- 27 tests - Auth business logic
- 21 tests - Voting algorithm
- 41 tests - Film nomination logic
- 3 tests - Integration layer

See `PROJECT_PROGRESS.md` for detailed test documentation.

---

## Deployment

### Automated Deployment (GitHub Actions)

This project uses GitHub Actions for continuous deployment. Every push to `main` automatically deploys to Firebase.

**Setup** (already configured):
1. ✅ Firebase service account key stored in GitHub secrets
2. ✅ Workflow file: `.github/workflows/deploy.yml`
3. ✅ Auto-deploys functions, Firestore rules, and indexes

**To Deploy**:
```bash
git add .
git commit -m "Your changes"
git push
```

GitHub Actions will automatically:
- Build TypeScript functions
- Deploy Cloud Functions
- Deploy Firestore rules and indexes

**Monitor Deployments**:
- GitHub Actions: https://github.com/remdodds/filmclub-2025/actions
- Firebase Console: https://console.firebase.google.com/project/filmclubapi

### Manual Deployment (Optional)

If deploying from a computer (not Termux):

```bash
# Login to Firebase
firebase login

# Deploy everything
firebase deploy --only functions,firestore:rules,firestore:indexes
```

### Scheduled Functions

Scheduled functions are automatically deployed and configured:
- ✅ `openVoting` - Opens voting every Friday at 18:00 Europe/London
- ✅ `closeVoting` - Closes voting every Saturday at 20:00 Europe/London

Cloud Scheduler automatically manages these based on the cron expressions in `functions/src/index.ts`.

---

## Configuration

### Environment Variables

None needed! Configuration is stored in Firestore via the setup endpoint.

### Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database
3. Enable Cloud Functions
4. Enable Hosting
5. Run `firebase init` and select the services above

---

## Testing Voting Functionality

The app includes test endpoints and scripts for testing voting functionality in production (useful for Termux where emulators don't work).

### Quick Start - Test Voting

1. **Deploy the functions** (if you haven't already):
   ```bash
   git add .
   git commit -m "Update voting configuration"
   git push
   # Wait 2-3 minutes for GitHub Actions to deploy
   # Or deploy manually: firebase deploy --only functions
   ```

2. **Configure voting schedule** (allow voting any day):
   ```bash
   ./update-voting-schedule.sh
   ```
   This updates production to allow voting 7 days a week for easy testing.

3. **Open a voting round**:
   ```bash
   ./open-voting-production.sh
   ```

4. **Test in browser**:
   - Visit: https://filmclubapi.web.app
   - Login with password: `filmclub2025`
   - Navigate to voting page
   - Vote on films (0-3 scale)
   - Submit and verify votes saved

### Test Endpoints (Production)

These endpoints are available for manual testing:

**Update Voting Schedule:**
```bash
# Login first
TOKEN=$(curl -s -X POST https://us-central1-filmclubapi.cloudfunctions.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"filmclub2025"}' | grep -o '"sessionToken":"[^"]*' | cut -d'"' -f4)

# Update schedule to allow voting any day
curl -X PUT https://us-central1-filmclubapi.cloudfunctions.net/api/config/voting-schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "votingSchedule": {
      "openDay": 0,
      "openTime": "00:00",
      "closeDay": 6,
      "closeTime": "23:59"
    }
  }'
```

**Manually Open Voting:**
```bash
curl -X POST https://us-central1-filmclubapi.cloudfunctions.net/api/test/open-voting \
  -H "Authorization: Bearer $TOKEN"
```

**Manually Close Voting:**
```bash
curl -X POST https://us-central1-filmclubapi.cloudfunctions.net/api/test/close-voting \
  -H "Authorization: Bearer $TOKEN"
```

**Check Voting Status:**
```bash
curl -X GET https://us-central1-filmclubapi.cloudfunctions.net/api/votes/current \
  -H "Authorization: Bearer $TOKEN"
```

**Add Test Votes** (optional, for testing with multiple voters):
```bash
./add-test-votes.sh
```

**Close Voting and Calculate Winner:**
```bash
./close-voting-production.sh
```

**Get Latest Results:**
```bash
curl -X GET https://us-central1-filmclubapi.cloudfunctions.net/api/votes/results/latest \
  -H "Authorization: Bearer $TOKEN"
```

### Reverting to Original Schedule

After testing, revert to the production schedule (Friday-Saturday only):

```bash
TOKEN=$(curl -s -X POST https://us-central1-filmclubapi.cloudfunctions.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"filmclub2025"}' | grep -o '"sessionToken":"[^"]*' | cut -d'"' -f4)

curl -X PUT https://us-central1-filmclubapi.cloudfunctions.net/api/config/voting-schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "votingSchedule": {
      "openDay": 5,
      "openTime": "18:00",
      "closeDay": 6,
      "closeTime": "20:00"
    }
  }'
```

---

## Troubleshooting

### Functions won't deploy
- Check Node version in `functions/package.json` matches your local version
- Run `cd functions && npm install` to ensure dependencies are current

### Tests failing
- Check you're in the `functions` directory
- Run `npm install` to ensure test dependencies are installed
- Check Jest version compatibility with TypeScript

### Emulators won't start
- Check ports 5001, 8080, 4000, 5173 aren't in use
- Try `firebase emulators:start --project=demo-test`

---

## Contributing

This is a personal/club project, but feel free to fork and adapt for your needs!

### Development Workflow

1. Write tests first (TDD approach)
2. Implement business logic (pure functions)
3. Create integration layer (thin wrappers)
4. Test with Firebase emulators
5. Deploy when ready

---

## License

MIT - Use this for your film club!

---

## Credits

Built with ❤️ for film lovers who hate arguing about what to watch.

**Tech Stack:**
- SvelteKit by the Svelte team
- Firebase by Google
- Tailwind CSS + DaisyUI
- Condorcet voting method by Marquis de Condorcet (1785)

---

**Questions?** Check `TECHNICAL_PLAN.md` for implementation details or `PROJECT_PROGRESS.md` for current status.
