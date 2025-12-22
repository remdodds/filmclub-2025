#!/bin/bash

# Local Testing Setup Script
#
# This script sets up the Firebase emulator for testing:
# 1. Creates club config that allows voting any day except Sunday
# 2. Opens a voting round for testing
# 3. Adds test films
#
# Usage: ./scripts/setup-local-testing.sh

set -e

API_BASE="http://localhost:5555/filmclub-demo-test/us-central1/api"

echo "🎬 Film Club - Local Testing Setup"
echo ""
echo "Make sure Firebase emulators are running!"
echo "(Run: firebase emulators:start)"
echo ""

# Wait a moment for user to confirm
sleep 2

echo "Step 1: Setting up club configuration..."
echo "  - Voting allowed: Any day of the week"
echo "  - Password: testpassword"
echo ""

# Setup club config
# openDay: 0 (Sunday), closeDay: 6 (Saturday)
# This allows voting any day of the week
curl -X POST "${API_BASE}/config/setup" \
  -H "Content-Type: application/json" \
  -d '{
    "clubName": "Test Film Club",
    "password": "testpassword",
    "timezone": "Europe/London",
    "votingSchedule": {
      "openDay": 0,
      "openTime": "00:00",
      "closeDay": 6,
      "closeTime": "23:59"
    }
  }' \
  -w "\n" || {
    echo "⚠️  Club might already be configured (this is OK)"
  }

echo ""
echo "Step 2: Logging in to get session token..."

# Login to get session token
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password": "testpassword"}')

SESSION_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"sessionToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$SESSION_TOKEN" ]; then
  echo "❌ Failed to login. Check if emulators are running."
  exit 1
fi

echo "✓ Logged in successfully"
echo ""

echo "Step 3: Adding test films..."

# Add test films
FILMS=(
  '{"title":"The Godfather","year":1972,"director":"Francis Ford Coppola"}'
  '{"title":"Pulp Fiction","year":1994,"director":"Quentin Tarantino"}'
  '{"title":"The Shawshank Redemption","year":1994,"director":"Frank Darabont"}'
  '{"title":"Inception","year":2010,"director":"Christopher Nolan"}'
)

for film in "${FILMS[@]}"; do
  TITLE=$(echo "$film" | grep -o '"title":"[^"]*' | cut -d'"' -f4)
  curl -s -X POST "${API_BASE}/films" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${SESSION_TOKEN}" \
    -d "$film" > /dev/null && echo "  ✓ Added: $TITLE" || echo "  ⚠️  $TITLE might already exist"
done

echo ""
echo "✅ Setup complete!"
echo ""
echo "Configuration:"
echo "  - Club name: Test Film Club"
echo "  - Password: testpassword"
echo "  - Voting allowed: Any day of the week"
echo "  - 4 test films added"
echo ""
echo "To manually open a voting round, run:"
echo "  firebase functions:shell"
echo "  openVotingRound()"
echo ""
echo "Or use the manual script:"
echo "  ./scripts/open-voting.sh"
echo ""
echo "Next steps:"
echo "1. Start the dev server: npm run dev"
echo "2. Login with password: testpassword"
echo "3. Navigate to the voting page"
echo ""
