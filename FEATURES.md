# Film Club — Features to Build

A backlog of planned features with enough detail to implement in isolated sessions.

---

## Feature 1: TMDB Film Metadata Enrichment

### Goal
When a film is nominated, automatically look up its TMDB metadata (poster, synopsis, release year, TMDB ID) and store it alongside the film in Firestore.

### APIs
- **TMDB Search**: `GET https://api.themoviedb.org/3/search/movie?query=<title>&api_key=<key>`
- **TMDB Images**: poster paths are relative — prefix with `https://image.tmdb.org/t/p/w500`
- Free, non-commercial use. No rate-limit concerns at our scale.
- API key: store in Firebase Functions config as `tmdb.api_key`

### Data Model Changes

Add optional metadata fields to the film document in Firestore and to the `Film` interface in both `src/lib/types.ts` and `functions/src/films/films.logic.ts`:

```ts
interface FilmMetadata {
  tmdbId: number;
  posterPath: string | null;   // e.g. "/abc123.jpg" — prepend TMDB image base URL
  overview: string | null;
  releaseYear: number | null;
  fetchedAt: Date;
}

interface Film {
  // ...existing fields...
  metadata?: FilmMetadata;
}
```

### Backend Changes

**New file: `functions/src/tmdb/tmdb.ts`**
- `searchFilm(title: string): Promise<FilmMetadata | null>`
  - Calls TMDB search endpoint
  - Takes the first result (best match)
  - Returns null if no results or on error (non-blocking — nomination still succeeds)

**Modify: `functions/src/api/films.ts` → `addFilm()`**
- After saving the film to Firestore, call `searchFilm(title)` asynchronously
- If metadata returned, update the Firestore doc with a `metadata` subcollection or merged fields
- Failure to fetch metadata must NOT fail the nomination — catch and log only

**Modify: `functions/src/api/films.ts` → `listFilms()`**
- Include `metadata` fields when mapping Firestore docs to Film objects

### Frontend Changes

**`src/lib/types.ts`** — add `metadata?: FilmMetadata` to `Film` interface

**`src/routes/films/+page.svelte`** — film list cards should show:
- Poster thumbnail (if available) on the left
- Synopsis snippet (truncated to ~100 chars) below the title
- Release year next to the title

**`src/routes/vote/+page.svelte`** — voting cards should show poster if available

### Testing
- Unit test `searchFilm()` with mocked fetch (happy path, no results, API error)
- Ensure `addFilm` tests still pass when TMDB is unavailable (mock failure)

---

## Feature 2: Streaming Availability on the Winner Banner

### Goal
Show which UK streaming platforms the winning film is available on, with deep links, in the "Next Up" banner on the home page.

### APIs
- **Movie of the Night Streaming Availability API** (via RapidAPI)
  - Free tier: 100 req/day — sufficient for weekly usage with caching
  - TypeScript SDK: `@movieofthenight/streaming-availability`
  - Endpoint used: `GET /shows/search/title` or `GET /shows/{tmdbId}` (preferred — requires TMDB ID from Feature 1)
  - Filter by country: `GB`
- API key: store in Firebase Functions config as `rapidapi.streaming_key`

### Caching Strategy
Store streaming availability in Firestore on the film document under `streamingAvailability`:

```ts
interface StreamingService {
  service: string;        // e.g. "netflix", "prime", "disney"
  displayName: string;    // e.g. "Netflix", "Amazon Prime"
  link: string;           // deep link to the title on that service
  type: 'subscription' | 'rent' | 'buy' | 'free';
}

interface Film {
  // ...existing + metadata fields...
  streamingAvailability?: {
    services: StreamingService[];
    fetchedAt: Date;
    country: 'GB';
  };
}
```

Only re-fetch if `fetchedAt` is more than 7 days old.

### Backend Changes

**New file: `functions/src/streaming/streaming.ts`**
- `getStreamingAvailability(tmdbId: number, country: string): Promise<StreamingService[]>`
  - Calls Movie of the Night API using the TMDB ID
  - Filters to `country = 'GB'`
  - Returns array of services (subscription type prioritised)
  - Returns `[]` on error (non-blocking)

**New endpoint: `GET /films/:id/streaming`**
- Checks Firestore for cached `streamingAvailability` (< 7 days old) → return it
- Otherwise calls `getStreamingAvailability()`, saves to Firestore, returns result
- Requires film to have `metadata.tmdbId` (from Feature 1) — returns `[]` if not

### Frontend Changes

**`src/lib/api.ts`** — add `getStreamingAvailability(filmId: string)`

**`src/routes/home/+page.svelte`** — in the "Next Up" winner banner:
- After loading `lastWinner`, call `getStreamingAvailability(lastWinner.winner.filmId)`
- Display service logos/badges below the winner title
- Each badge links to the streaming deep link
- Show "Not currently streaming" if array is empty
- Loading state: skeleton placeholder while fetching

**`src/lib/components/StreamingBadges.svelte`** — new reusable component
- Props: `services: StreamingService[]`
- Renders pill badges for each service with icon + name
- Can reuse on history page later

### Testing
- Unit test `getStreamingAvailability()` with mocked API responses
- Test caching logic: cached result returned without API call when fresh
- Test empty/error state handling

---

## Implementation Order

1. **Feature 1 first** — streaming lookup (Feature 2) depends on `tmdbId` being stored, so TMDB enrichment must land first.
2. Feature 1 can be shipped and used in production before Feature 2 is started.
3. Once Feature 1 is live and films have `tmdbId` populated, Feature 2 is straightforward.

---

## Environment / Config

| Key | Where | Value |
|-----|-------|-------|
| `tmdb.api_key` | Firebase Functions config | TMDB v3 API key from themoviedb.org |
| `rapidapi.streaming_key` | Firebase Functions config | RapidAPI key from movieofthenight |

Set with:
```bash
firebase functions:config:set tmdb.api_key="YOUR_KEY" rapidapi.streaming_key="YOUR_KEY"
```

Access in functions:
```ts
import { defineSecret } from 'firebase-functions/params';
// or via functions.config().tmdb.api_key
```

---

## Attribution Requirements

- TMDB: must display "Powered by TMDB" logo/text wherever TMDB data is shown
- Movie of the Night: check RapidAPI terms — no explicit attribution required on free tier but good practice to note
