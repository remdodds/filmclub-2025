# Voting Functionality Testing - Quick Reference

## What Was Changed

### 1. New API Endpoints
- `PUT /config/voting-schedule` - Update voting schedule anytime
- `POST /test/open-voting` - Manually open a voting round
- `POST /test/close-voting` - Manually close a voting round

### 2. New Scripts
- `update-voting-schedule.sh` - Updates production to allow voting 7 days/week
- `open-voting-production.sh` - Opens a voting round in production

### 3. Updated Files
- `functions/src/api/config.ts` - Added updateVotingSchedule() function
- `functions/src/index.ts` - Added new routes for testing
- `README.md` - Added "Testing Voting Functionality" section

## How to Test (Production)

Since Firebase emulators don't work on Termux, test directly in production:

### Step 1: Deploy Changes
```bash
git add .
git commit -m "Add voting test endpoints and remove Sunday restriction"
git push
```
Wait 2-3 minutes for GitHub Actions to auto-deploy.

### Step 2: Update Voting Schedule
```bash
./update-voting-schedule.sh
```
**What this does:** Configures voting to be allowed any day of the week (Sunday-Saturday)

### Step 3: Open Voting Round
```bash
./open-voting-production.sh
```
**What this does:** Creates an open voting round with your nominated films

### Step 4: Test in Browser
1. Visit: https://filmclub-2025-21c5e.web.app
2. Login with: `filmclub2025`
3. Navigate to voting page
4. Vote on films (0-3 scale)
5. Submit and verify

## Quick Commands

### Login and Get Token
```bash
TOKEN=$(curl -s -X POST https://us-central1-filmclubapi.cloudfunctions.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"filmclub2025"}' | grep -o '"sessionToken":"[^"]*' | cut -d'"' -f4)
```

### Check Voting Status
```bash
curl -s -X GET https://us-central1-filmclubapi.cloudfunctions.net/api/votes/current \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Open Voting
```bash
curl -s -X POST https://us-central1-filmclubapi.cloudfunctions.net/api/test/open-voting \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Close Voting
```bash
curl -s -X POST https://us-central1-filmclubapi.cloudfunctions.net/api/test/close-voting \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## Voting Schedule Configurations

### Testing (7 Days/Week)
```json
{
  "openDay": 0,
  "openTime": "00:00",
  "closeDay": 6,
  "closeTime": "23:59"
}
```

### Production (Friday-Saturday Only)
```json
{
  "openDay": 5,
  "openTime": "18:00",
  "closeDay": 6,
  "closeTime": "20:00"
}
```

## Revert to Production Schedule

After testing, revert to the original Friday-Saturday schedule:

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
  }' | python3 -m json.tool
```

## Testing Checklist

- [ ] Deploy updated functions to production
- [ ] Run `./update-voting-schedule.sh` to enable 7-day voting
- [ ] Run `./open-voting-production.sh` to create voting round
- [ ] Test login at https://filmclub-2025-21c5e.web.app
- [ ] Navigate to voting page and see films
- [ ] Vote on all films (0-3 scale)
- [ ] Submit votes
- [ ] Verify votes saved via API
- [ ] Test closing voting round
- [ ] Revert to production schedule when done

## Notes

- All testing happens in your live production environment
- Test endpoints require authentication (password: `filmclub2025`)
- Voting schedule changes take effect immediately
- Scheduled Cloud Functions still run on their original Friday/Saturday schedule
- Remember to revert the schedule after testing!
