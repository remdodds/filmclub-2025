#!/bin/bash

# Open Voting Round (Production)
#
# This script manually opens a voting round in your production Firebase instance.
# Use this for testing the voting functionality.
#
# Usage: ./open-voting-production.sh

set -e

API_BASE="https://us-central1-filmclubapi.cloudfunctions.net/api"
PASSWORD="filmclub2025"

echo "🎬 Opening Production Voting Round"
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

if [ "$IS_OPEN" = "true" ]; then
  echo "⚠️  A voting round is already open!"
  echo ""
  echo "$CURRENT" | python3 -m json.tool 2>/dev/null || echo "$CURRENT"
  exit 0
fi

echo "No voting round currently open."
echo ""

# Open voting round
echo "Opening voting round..."
OPEN_RESULT=$(curl -s -X POST "${API_BASE}/test/open-voting" \
  -H "Authorization: Bearer ${SESSION_TOKEN}")

echo "$OPEN_RESULT" | python3 -m json.tool 2>/dev/null || echo "$OPEN_RESULT"
echo ""

# Check if successful
if echo "$OPEN_RESULT" | grep -q '"success":true'; then
  echo "✅ Voting round opened successfully!"
  echo ""

  # Show new status
  echo "Current voting status:"
  CURRENT=$(curl -s -X GET "${API_BASE}/votes/current" \
    -H "Authorization: Bearer ${SESSION_TOKEN}")
  echo "$CURRENT" | python3 -m json.tool 2>/dev/null || echo "$CURRENT"
  echo ""

  echo "You can now test voting at: https://filmclub-2025-21c5e.web.app"
else
  echo "❌ Failed to open voting round"
  echo "Check the response above for error details"
  exit 1
fi
