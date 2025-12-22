#!/bin/bash

# Update Production Voting Schedule
#
# This script updates the voting schedule in your production Firebase instance
# to allow voting any day except Sunday.
#
# Usage: ./update-voting-schedule.sh

set -e

API_BASE="https://us-central1-filmclubapi.cloudfunctions.net/api"
PASSWORD="filmclub2025"

echo "🎬 Updating Production Voting Schedule"
echo ""
echo "This will configure voting to be allowed any day EXCEPT Sunday"
echo ""

# Login to get session token
echo "Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\": \"${PASSWORD}\"}")

SESSION_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"sessionToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$SESSION_TOKEN" ]; then
  echo "❌ Failed to login. Response:"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✓ Logged in successfully"
echo ""

# Show current config
echo "Step 2: Checking current configuration..."
CURRENT_CONFIG=$(curl -s -X GET "${API_BASE}/config")
echo "$CURRENT_CONFIG" | python3 -m json.tool 2>/dev/null || echo "$CURRENT_CONFIG"
echo ""

# Update voting schedule
# openDay: 0 (Sunday), closeDay: 6 (Saturday)
# This allows voting any day of the week
echo "Step 3: Updating voting schedule..."
echo "  - Voting allowed: Any day of the week (Sunday-Saturday)"
echo ""

UPDATE_RESPONSE=$(curl -s -X PUT "${API_BASE}/config/voting-schedule" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SESSION_TOKEN}" \
  -d '{
    "votingSchedule": {
      "openDay": 0,
      "openTime": "00:00",
      "closeDay": 6,
      "closeTime": "23:59"
    }
  }')

echo "$UPDATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPDATE_RESPONSE"
echo ""

# Check if successful
if echo "$UPDATE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Voting schedule updated successfully!"
  echo ""
  echo "New schedule:"
  echo "  - Opens: Sunday 00:00"
  echo "  - Closes: Saturday 23:59"
  echo "  - Result: Voting allowed any day of the week"
  echo ""
  echo "You can now test voting functionality any day!"
else
  echo "❌ Failed to update voting schedule"
  echo "Check the response above for error details"
  exit 1
fi
