# Film Club API Documentation

**Base URL**: `https://us-central1-filmclubapi.cloudfunctions.net/api`

**Version**: 1.0
**Last Updated**: 2025-12-17
**Status**: ✅ All endpoints tested and working

---

## Quick Status
- ✅ API fully deployed on Firebase
- ✅ All 12 endpoints functional
- ✅ Authentication working
- ✅ Film management working (bug fixed 2025-12-17)
- ✅ Sample data added (The Godfather, Pulp Fiction)

---

## Table of Contents

- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Config](#config)
  - [Auth](#auth)
  - [Films](#films)
  - [Votes](#votes)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Authentication

Most endpoints require authentication using a session token obtained from the login endpoint.

**Authentication Header**:
```
Authorization: Bearer <session-token>
```

---

## Endpoints

### Health Check

Check if the API is running.

**Endpoint**: `GET /health`
**Auth Required**: No

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-17T21:28:54.590Z"
}
```

---

### Config

#### Get Club Configuration

Get the current club configuration.

**Endpoint**: `GET /config`
**Auth Required**: No

**Response** (when configured):
```json
{
  "config": {
    "clubName": "Film Club",
    "timezone": "Europe/London",
    "votingSchedule": {
      "openDay": 5,
      "openTime": "18:00",
      "closeDay": 6,
      "closeTime": "20:00"
    }
  }
}
```

**Response** (when not configured):
```json
{
  "config": null
}
```

---

#### Setup Club

Initialize club configuration. Can only be called once.

**Endpoint**: `POST /config/setup`
**Auth Required**: No (but can only be called once)

**Request Body**:
```json
{
  "clubName": "Film Club",
  "password": "your-secure-password",
  "timezone": "Europe/London",
  "votingSchedule": {
    "openDay": 5,
    "openTime": "18:00",
    "closeDay": 6,
    "closeTime": "20:00"
  }
}
```

**Parameters**:
- `clubName` (string, required): Name of your film club
- `password` (string, required): Shared password for all members (min 8 characters)
- `timezone` (string, required): IANA timezone (e.g., "Europe/London", "America/New_York")
- `votingSchedule` (object, required):
  - `openDay` (number, 0-6): Day voting opens (0=Sunday, 5=Friday)
  - `openTime` (string, "HH:mm"): Time voting opens (24-hour format)
  - `closeDay` (number, 0-6): Day voting closes
  - `closeTime` (string, "HH:mm"): Time voting closes

**Response**:
```json
{
  "success": true,
  "config": {
    "clubName": "Film Club",
    "timezone": "Europe/London",
    "votingSchedule": {
      "openDay": 5,
      "openTime": "18:00",
      "closeDay": 6,
      "closeTime": "20:00"
    }
  }
}
```

**Errors**:
- `400`: Missing required fields or invalid format
- `409`: Club already configured

---

### Auth

#### Login

Authenticate and get a session token.

**Endpoint**: `POST /auth/login`
**Auth Required**: No

**Request Body**:
```json
{
  "password": "filmclub2025"
}
```

**Response**:
```json
{
  "sessionToken": "65194f77-92ca-4fa6-b903-c2a3ce13a370",
  "visitorId": "ed74d809-a6ce-4deb-841e-a7d8bc65b8be"
}
```

**Parameters**:
- `sessionToken`: Use this for subsequent authenticated requests
- `visitorId`: Your anonymous visitor ID (used to track votes)

**Errors**:
- `400`: Missing password
- `401`: Incorrect password

---

#### Logout

Invalidate the current session.

**Endpoint**: `POST /auth/logout`
**Auth Required**: Yes

**Response**:
```json
{
  "success": true
}
```

---

#### Check Session

Verify if the current session is valid.

**Endpoint**: `GET /auth/check`
**Auth Required**: Yes

**Response**:
```json
{
  "valid": true,
  "visitorId": "ed74d809-a6ce-4deb-841e-a7d8bc65b8be"
}
```

**Errors**:
- `401`: Invalid or expired session

---

### Films

#### List Films

Get all nominated films.

**Endpoint**: `GET /films`
**Auth Required**: Yes

**Response**:
```json
{
  "films": [
    {
      "id": "film123",
      "title": "The Godfather",
      "nominatedBy": "visitor-id-123",
      "addedAt": "2025-12-17T10:30:00Z",
      "status": "nominated"
    },
    {
      "id": "film456",
      "title": "Pulp Fiction",
      "nominatedBy": "visitor-id-456",
      "addedAt": "2025-12-17T11:45:00Z",
      "status": "nominated"
    }
  ]
}
```

---

#### Add Film

Nominate a new film.

**Endpoint**: `POST /films`
**Auth Required**: Yes

**Request Body**:
```json
{
  "title": "The Godfather"
}
```

**Response**:
```json
{
  "success": true,
  "film": {
    "id": "film123",
    "title": "The Godfather",
    "nominatedBy": "visitor-id-123",
    "addedAt": "2025-12-17T10:30:00Z",
    "status": "nominated"
  }
}
```

**Errors**:
- `400`: Missing title or invalid title (1-200 characters required)
- `409`: Film already nominated (fuzzy duplicate detection)

---

#### Delete Film

Remove a nominated film.

**Endpoint**: `DELETE /films/:id`
**Auth Required**: Yes

**Parameters**:
- `id` (path parameter): The film ID

**Response**:
```json
{
  "success": true
}
```

**Errors**:
- `404`: Film not found
- `403`: Cannot delete film (e.g., voting in progress)

---

#### Get Watch History

Get chronological history of watched films.

**Endpoint**: `GET /films/history`
**Auth Required**: Yes

**Response**:
```json
{
  "films": [
    {
      "id": "film789",
      "title": "The Shawshank Redemption",
      "nominatedBy": "visitor-id-789",
      "addedAt": "2025-12-10T10:30:00Z",
      "watchedAt": "2025-12-15T20:00:00Z",
      "status": "watched",
      "votingResults": {
        "winner": true,
        "totalScore": 24,
        "averageScore": 2.4
      }
    }
  ]
}
```

---

### Votes

#### Get Current Voting Round

Get the currently active voting round (if any).

**Endpoint**: `GET /votes/current`
**Auth Required**: Yes

**Response** (voting open):
```json
{
  "votingRound": {
    "id": "round123",
    "openedAt": "2025-12-15T18:00:00Z",
    "closesAt": "2025-12-16T20:00:00Z",
    "status": "open",
    "films": [
      {
        "id": "film123",
        "title": "The Godfather"
      },
      {
        "id": "film456",
        "title": "Pulp Fiction"
      }
    ],
    "yourVotes": {
      "film123": 3,
      "film456": 2
    }
  }
}
```

**Response** (no voting active):
```json
{
  "votingRound": null
}
```

---

#### Submit Vote

Submit or update votes for the current voting round.

**Endpoint**: `POST /votes`
**Auth Required**: Yes

**Request Body**:
```json
{
  "votes": {
    "film123": 3,
    "film456": 2,
    "film789": 1
  }
}
```

**Parameters**:
- `votes` (object): Map of film IDs to scores (0-3)
  - 0 = "I hate this idea"
  - 1 = "Meh, I guess"
  - 2 = "Sounds good!"
  - 3 = "Yes! Let's watch this!"

**Response**:
```json
{
  "success": true,
  "votingRoundId": "round123"
}
```

**Errors**:
- `400`: Invalid vote scores (must be 0-3)
- `404`: No active voting round
- `409`: Voting round closed

---

#### Get Latest Results

Get results from the most recent completed voting round.

**Endpoint**: `GET /votes/results/latest`
**Auth Required**: Yes

**Response**:
```json
{
  "results": {
    "votingRoundId": "round123",
    "closedAt": "2025-12-16T20:00:00Z",
    "winner": {
      "id": "film123",
      "title": "The Godfather",
      "rank": 1,
      "totalScore": 27,
      "averageScore": 2.7,
      "pairwiseWins": 2,
      "pairwiseLosses": 0
    },
    "rankings": [
      {
        "id": "film123",
        "title": "The Godfather",
        "rank": 1,
        "totalScore": 27,
        "averageScore": 2.7
      },
      {
        "id": "film456",
        "title": "Pulp Fiction",
        "rank": 2,
        "totalScore": 24,
        "averageScore": 2.4
      }
    ],
    "algorithm": "condorcet",
    "totalVoters": 10
  }
}
```

**Response** (no completed rounds):
```json
{
  "results": null
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

**Common HTTP Status Codes**:
- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Action not allowed
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate)
- `500 Internal Server Error`: Server error

---

## Examples

### Complete Authentication Flow

```bash
# 1. Check if club is configured
curl https://us-central1-filmclubapi.cloudfunctions.net/api/config

# 2. Login
SESSION_TOKEN=$(curl -s -X POST \
  https://us-central1-filmclubapi.cloudfunctions.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "filmclub2025"}' \
  | jq -r '.sessionToken')

# 3. List films
curl -s \
  https://us-central1-filmclubapi.cloudfunctions.net/api/films \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

---

### Complete Voting Flow

```bash
# 1. Login and get token
SESSION_TOKEN=$(curl -s -X POST \
  https://us-central1-filmclubapi.cloudfunctions.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "filmclub2025"}' \
  | jq -r '.sessionToken')

# 2. Check current voting round
curl -s \
  https://us-central1-filmclubapi.cloudfunctions.net/api/votes/current \
  -H "Authorization: Bearer $SESSION_TOKEN"

# 3. Submit votes
curl -s -X POST \
  https://us-central1-filmclubapi.cloudfunctions.net/api/votes \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "votes": {
      "film123": 3,
      "film456": 2,
      "film789": 1
    }
  }'

# 4. View results after voting closes
curl -s \
  https://us-central1-filmclubapi.cloudfunctions.net/api/votes/results/latest \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

---

## Rate Limits

Currently no rate limits are enforced, but please be respectful:
- Maximum 100 requests per minute per session
- Maximum 1000 requests per day per session

Excessive usage may result in temporary throttling.

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/remdodds/filmclub-2025/issues
- Check logs: https://console.firebase.google.com/project/filmclubapi/functions/logs

---

**Last Updated**: 2025-12-17
