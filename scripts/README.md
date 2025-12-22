# Local Testing Scripts

Scripts to help set up and test the Film Club application locally using Firebase emulators.

## Prerequisites

1. **Firebase Emulators Running**
   ```bash
   firebase emulators:start
   ```

   The emulators should be running on:
   - Functions: http://localhost:5555
   - Firestore: http://localhost:8888

2. **Project Dependencies Installed**
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

## Scripts

### 1. `setup-local-testing.sh`

Sets up your local Firebase emulator with test data for voting functionality testing.

**What it does:**
- Creates a test club configuration with voting allowed **any day of the week**
- Sets test password: `testpassword`
- Adds 4 sample films (The Godfather, Pulp Fiction, etc.)
- Configures voting schedule:
  - Opens: Sunday 00:00
  - Closes: Saturday 23:59
  - **Result: Can vote any day (Sun-Sat)**

**Usage:**
```bash
./scripts/setup-local-testing.sh
```

**Run this once** when you first start testing, or whenever you want to reset your local data.

### 2. `open-voting.sh`

Manually opens a voting round for testing.

**What it does:**
- Logs in with test credentials
- Checks if a voting round is already open
- Opens a new voting round if none exists
- Shows the current voting status

**Usage:**
```bash
./scripts/open-voting.sh
```

**When to use:**
- After running setup script
- Whenever you want to test the voting interface
- After closing a previous voting round

## Complete Testing Workflow

### First Time Setup

1. **Start Firebase Emulators**
   ```bash
   firebase emulators:start
   ```

2. **Run Setup Script** (in another terminal)
   ```bash
   ./scripts/setup-local-testing.sh
   ```

3. **Build and Start Frontend**
   ```bash
   npm run build
   cd functions && npm run build && cd ..
   ```

4. **Start Dev Server** (in another terminal)
   ```bash
   npm run dev
   ```

5. **Open Voting Round**
   ```bash
   ./scripts/open-voting.sh
   ```

6. **Test in Browser**
   - Navigate to http://localhost:5173
   - Login with password: `testpassword`
   - Go to voting page
   - Submit votes for the 4 test films

### Day-to-Day Testing

```bash
# Terminal 1: Keep emulators running
firebase emulators:start

# Terminal 2: Keep dev server running
npm run dev

# Terminal 3: Control voting rounds
./scripts/open-voting.sh    # Open voting
# ... test voting in browser ...
# Close voting when done (TBD)
```

## Configuration Details

The local test configuration allows voting **any day of the week**:

```json
{
  "votingSchedule": {
    "openDay": 0,      // Sunday (0=Sunday, 1=Monday, ..., 6=Saturday)
    "openTime": "00:00",
    "closeDay": 6,     // Saturday
    "closeTime": "23:59"
  }
}
```

This means:
- ✅ Sunday-Saturday: Voting allowed any day

## API Endpoints for Manual Testing

The functions now include test endpoints for manually controlling voting rounds:

```bash
# Get auth token first
TOKEN=$(curl -s -X POST http://localhost:5555/filmclub-demo-test/us-central1/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"testpassword"}' | grep -o '"sessionToken":"[^"]*' | cut -d'"' -f4)

# Open voting round
curl -X POST http://localhost:5555/filmclub-demo-test/us-central1/api/test/open-voting \
  -H "Authorization: Bearer $TOKEN"

# Close voting round
curl -X POST http://localhost:5555/filmclub-demo-test/us-central1/api/test/close-voting \
  -H "Authorization: Bearer $TOKEN"

# Check voting status
curl -X GET http://localhost:5555/filmclub-demo-test/us-central1/api/votes/current \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### "Failed to login"
- Make sure Firebase emulators are running
- Make sure you ran the setup script first
- Check that the API is accessible at http://localhost:5555

### "Club already configured"
This is normal if you've run the setup script before. The script will continue and add films.

To fully reset:
1. Stop emulators (Ctrl+C)
2. Delete emulator data: `rm -rf .firebase`
3. Restart emulators
4. Run setup script again

### "No nominated films"
Run the setup script again to add test films:
```bash
./scripts/setup-local-testing.sh
```

### Port conflicts
Check your `firebase.json` for emulator ports:
- Functions: 5555
- Firestore: 8888
- Auth: 9099
- Hosting: 5000

Make sure these ports aren't in use by other applications.

## Notes

- These scripts use `curl` for API calls
- JSON output is formatted using `python3 -m json.tool` (if available)
- All data is stored in the Firebase emulator (not production!)
- Emulator data is cleared when you stop the emulators (unless persisted)
- The test password is intentionally simple: `testpassword`
