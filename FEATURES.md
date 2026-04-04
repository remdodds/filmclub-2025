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
Show which UK streaming platforms the winning film is available on in the "Next Up" banner on the home page. No deep links — just service names.

### APIs
- **TMDB Watch Providers**: `GET https://api.themoviedb.org/3/movie/{tmdb_id}/watch/providers?api_key=<key>`
  - Same TMDB API key as Feature 1 — no additional credentials needed
  - Returns flatrate (subscription), rent, and buy availability by country
  - Filter response to `results.GB.flatrate` for UK subscription services
  - Requires `tmdbId` from Feature 1

### Caching Strategy
Store streaming availability in Firestore on the film document under `streamingAvailability`:

```ts
interface StreamingService {
  provider_id: number;
  provider_name: string;   // e.g. "Netflix", "Amazon Prime Video"
  logo_path: string;       // TMDB logo path — prefix with https://image.tmdb.org/t/p/w45
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

**Extend `functions/src/tmdb/tmdb.ts`** (from Feature 1)
- Add `getWatchProviders(tmdbId: number, country: string): Promise<StreamingService[]>`
  - Calls TMDB watch providers endpoint
  - Extracts `results[country].flatrate` (subscription services only)
  - Returns `[]` on error or if no providers found (non-blocking)

**New endpoint: `GET /films/:id/streaming`**
- Checks Firestore for cached `streamingAvailability` (< 7 days old) → return it
- Otherwise calls `getWatchProviders()`, saves to Firestore, returns result
- Requires film to have `metadata.tmdbId` (from Feature 1) — returns `[]` if not

### Frontend Changes

**`src/lib/api.ts`** — add `getStreamingAvailability(filmId: string)`

**`src/routes/home/+page.svelte`** — in the "Next Up" winner banner:
- After loading `lastWinner`, call `getStreamingAvailability(lastWinner.winner.filmId)`
- Display service name badges below the winner title (with TMDB logo image if available)
- Show "Not currently streaming" if array is empty
- Loading state: skeleton placeholder while fetching

**`src/lib/components/StreamingBadges.svelte`** — new reusable component
- Props: `services: StreamingService[]`
- Renders pill badges for each service with logo + name
- Can reuse on history page later

### Testing
- Unit test `getWatchProviders()` with mocked fetch responses
- Test caching logic: cached result returned without API call when fresh
- Test empty/error state handling

---

## Feature 3: Nomination Pitch Field

### Goal
When nominating a film, members can write a short personal pitch for why the club should watch it. This pitch is displayed beneath the TMDB synopsis on the nominations page, giving each nomination a personal touch alongside the objective metadata.

### Data Model Changes

Add an optional `pitch` field to the `Film` interface in `src/lib/types.ts` and `functions/src/films/films.logic.ts`:

```ts
interface Film {
  // ...existing fields...
  pitch?: string;   // free-text, max ~500 chars, written by the nominator
}
```

Store directly on the Firestore film document alongside `title`, `nominatedBy`, etc.

### Backend Changes

**Modify: `functions/src/api/films.ts` → `addFilm()`**
- Accept optional `pitch` string in the request body
- Validate: strip leading/trailing whitespace; enforce max length of 500 characters (return 400 if exceeded)
- Save `pitch` on the Firestore document (omit field entirely if empty/absent — no empty strings)

**Modify: `functions/src/api/films.ts` → `listFilms()`**
- Include `pitch` when mapping Firestore docs to Film objects

### Frontend Changes

**`src/lib/types.ts`** — add `pitch?: string` to `Film` interface

**`src/routes/films/nominate/+page.svelte`** — nomination form:
- Add an optional `<textarea>` labelled "Why should we watch this?" below the film search/title field
- Placeholder: e.g. _"Tell the club why this film is worth watching…"_
- Character counter showing remaining chars out of 500
- Submit the `pitch` value alongside the film data

**`src/routes/films/+page.svelte`** — nominations list:
- If `film.pitch` is present, render it beneath `film.metadata.overview` (the TMDB synopsis)
- Style to visually distinguish it from the synopsis — e.g. italic text with a small label like "Why watch it?" or the nominator's name as attribution

**`src/lib/api.ts`** — update `addFilm()` call to pass `pitch` in the request payload

### Testing
- Unit test `addFilm()`: pitch saved when provided, omitted when absent, 400 returned when > 500 chars
- Frontend: textarea renders, character counter updates, pitch submitted in payload
- Nominations page: pitch shown beneath synopsis when present, nothing rendered when absent

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

Set with:
```bash
firebase functions:config:set tmdb.api_key="YOUR_KEY"
```

Access in functions:
```ts
// functions.config().tmdb.api_key
```

---

## Attribution Requirements

- TMDB: must display "Powered by TMDB" logo/text wherever TMDB data is shown (required by their terms)
