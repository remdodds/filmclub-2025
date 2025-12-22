#!/bin/bash

# Add Test Votes (Production)
#
# This script adds test votes from multiple fake voters to test the voting algorithm.
# Use this to quickly populate votes before testing the winner calculation.
#
# Usage: ./add-test-votes.sh

set -e

API_BASE="https://us-central1-filmclubapi.cloudfunctions.net/api"
PASSWORD="filmclub2025"

echo "🎬 Adding Test Votes to Production"
echo ""

# Login to get session token
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\": \"${PASSWORD}\"}")

SESSION_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"sessionToken":"[^"]*' | cut -d'"' -f4)
VISITOR_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"visitorId":"[^"]*' | cut -d'"' -f4)

if [ -z "$SESSION_TOKEN" ]; then
  echo "❌ Failed to login"
  exit 1
fi

echo "✓ Logged in (visitorId: $VISITOR_ID)"
echo ""

# Get current voting round
echo "Fetching current voting round..."
CURRENT=$(curl -s -X GET "${API_BASE}/votes/current" \
  -H "Authorization: Bearer ${SESSION_TOKEN}")

IS_OPEN=$(echo "$CURRENT" | grep -o '"isOpen":[^,]*' | grep -o 'true\|false')

if [ "$IS_OPEN" = "false" ]; then
  echo "❌ No voting round is currently open!"
  echo "Run ./open-voting-production.sh first"
  exit 1
fi

# Extract film IDs
FILM_IDS=$(echo "$CURRENT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('votingRound') and data['votingRound'].get('candidates'):
        for film in data['votingRound']['candidates']:
            print(film['id'])
except:
    pass
" 2>/dev/null)

if [ -z "$FILM_IDS" ]; then
  echo "❌ No films found in voting round"
  exit 1
fi

FILM_ARRAY=($FILM_IDS)
FILM_COUNT=${#FILM_ARRAY[@]}

echo "Found $FILM_COUNT films in voting round"
echo ""

# Generate 5 test voters with different vote patterns
declare -a VOTERS=(
  "test-voter-1"
  "test-voter-2"
  "test-voter-3"
  "test-voter-4"
  "test-voter-5"
)

echo "Adding votes from 5 test voters..."
echo ""

for i in {0..4}; do
  VOTER_ID="${VOTERS[$i]}"
  echo "Voter $((i+1)): $VOTER_ID"

  # Generate random votes for each film (0-3)
  VOTES_JSON="["
  for j in $(seq 0 $((FILM_COUNT-1))); do
    FILM_ID="${FILM_ARRAY[$j]}"
    # Generate pseudo-random score (0-3) based on voter and film indices
    SCORE=$(( (i + j) % 4 ))

    if [ $j -gt 0 ]; then
      VOTES_JSON="$VOTES_JSON,"
    fi
    VOTES_JSON="$VOTES_JSON{\"filmId\":\"$FILM_ID\",\"score\":$SCORE}"
  done
  VOTES_JSON="$VOTES_JSON]"

  # Submit vote
  VOTE_RESULT=$(curl -s -X POST "${API_BASE}/votes" \
    -H "Authorization: Bearer ${SESSION_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"visitorId\":\"$VOTER_ID\",\"votes\":$VOTES_JSON}")

  if echo "$VOTE_RESULT" | grep -q '"success":true'; then
    echo "  ✓ Votes submitted"
  else
    echo "  ⚠️  Failed to submit votes"
    echo "$VOTE_RESULT"
  fi
done

echo ""
echo "✅ Test votes added!"
echo ""
echo "Summary:"
echo "  - 5 test voters"
echo "  - Each voted on $FILM_COUNT films"
echo "  - Varied vote patterns (0-3 stars)"
echo ""
echo "Next steps:"
echo "  1. Optionally add your own vote via the website"
echo "  2. Run ./close-voting-production.sh to calculate the winner"
