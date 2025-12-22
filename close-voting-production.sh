#!/bin/bash

# Close Voting Round and Calculate Winner (Production)
#
# This script manually closes the current voting round and calculates the winner.
# Use this for testing without waiting until Saturday.
#
# Usage: ./close-voting-production.sh

set -e

API_BASE="https://us-central1-filmclubapi.cloudfunctions.net/api"
PASSWORD="filmclub2025"

echo "🎬 Closing Production Voting Round"
echo ""

# Login to get session token
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\": \"${PASSWORD}\"}")

SESSION_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"sessionToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$SESSION_TOKEN" ]; then
  echo "❌ Failed to login. Response:"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✓ Logged in"
echo ""

# Check current voting status
echo "Checking current voting status..."
CURRENT=$(curl -s -X GET "${API_BASE}/votes/current" \
  -H "Authorization: Bearer ${SESSION_TOKEN}")

IS_OPEN=$(echo "$CURRENT" | grep -o '"isOpen":[^,]*' | grep -o 'true\|false')

if [ "$IS_OPEN" = "false" ]; then
  echo "⚠️  No voting round is currently open!"
  echo ""
  echo "$CURRENT" | python3 -m json.tool 2>/dev/null || echo "$CURRENT"
  exit 0
fi

echo "Voting round is open. Showing current status:"
echo "$CURRENT" | python3 -m json.tool 2>/dev/null || echo "$CURRENT"
echo ""

# Close voting round
echo "Closing voting round and calculating winner..."
echo ""
CLOSE_RESULT=$(curl -s -X POST "${API_BASE}/test/close-voting" \
  -H "Authorization: Bearer ${SESSION_TOKEN}")

echo "$CLOSE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$CLOSE_RESULT"
echo ""

# Check if successful
if echo "$CLOSE_RESULT" | grep -q '"success":true'; then
  echo "✅ Voting round closed successfully!"
  echo ""

  # Get latest results
  echo "Fetching voting results..."
  RESULTS=$(curl -s -X GET "${API_BASE}/votes/results/latest" \
    -H "Authorization: Bearer ${SESSION_TOKEN}")

  echo "$RESULTS" | python3 -m json.tool 2>/dev/null || echo "$RESULTS"
  echo ""

  echo "You can view the results at: https://filmclubapi.web.app"
else
  echo "❌ Failed to close voting round"
  echo "Check the response above for error details"
  exit 1
fi
