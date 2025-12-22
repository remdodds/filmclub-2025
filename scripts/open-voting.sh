#!/bin/bash

# Manually Open Voting Round
#
# This script manually opens a voting round for testing.
# Use this when you want to test the voting functionality.
#
# Usage: ./scripts/open-voting.sh

set -e

API_BASE="http://localhost:5555/filmclub-demo-test/us-central1/api"

echo "🎬 Opening Voting Round..."
echo ""

# Login to get session token
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password": "testpassword"}')

SESSION_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"sessionToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$SESSION_TOKEN" ]; then
  echo "❌ Failed to login. Make sure you've run setup-local-testing.sh first."
  exit 1
fi

echo "✓ Logged in"
echo ""

# Check current voting status
echo "Checking current voting status..."
CURRENT=$(curl -s -X GET "${API_BASE}/votes/current" \
  -H "Authorization: Bearer ${SESSION_TOKEN}")

IS_OPEN=$(echo "$CURRENT" | grep -o '"isOpen":[^,]*' | grep -o 'true\|false')

if [ "$IS_OPEN" = "true" ]; then
  echo "⚠️  A voting round is already open!"
  echo ""
  echo "$CURRENT" | python3 -m json.tool 2>/dev/null || echo "$CURRENT"
  exit 0
fi

echo "No voting round currently open. Opening one now..."
echo ""

# Open voting round using test endpoint
echo "Opening voting round..."
OPEN_RESULT=$(curl -s -X POST "${API_BASE}/test/open-voting" \
  -H "Authorization: Bearer ${SESSION_TOKEN}")

echo "$OPEN_RESULT" | python3 -m json.tool 2>/dev/null || echo "$OPEN_RESULT"
echo ""

# Check new status
echo "Checking voting status..."
CURRENT=$(curl -s -X GET "${API_BASE}/votes/current" \
  -H "Authorization: Bearer ${SESSION_TOKEN}")

echo "$CURRENT" | python3 -m json.tool 2>/dev/null || echo "$CURRENT"
echo ""
echo "✅ Voting round is now open!"
