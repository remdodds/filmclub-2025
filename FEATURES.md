# Film Club — Features to Build

A backlog of planned features with enough detail to implement in isolated sessions.

---

## ~~Feature 1: TMDB Film Metadata Enrichment~~ ✓ Complete

When a film is nominated, the backend automatically fetches TMDB metadata (poster, synopsis, release year, TMDB ID) and stores it on the Firestore film document under `metadata`. Metadata fetch failures are non-blocking. The nominations and voting pages display poster thumbnails, release year, and a synopsis snippet.

---

## Feature 2: Streaming Availability on Nominated Films

### Goal
Show a single streaming platform logo on each nominated film card on the nominations page. Only one logo is shown per film, selected by priority. No deep links — just the logo.

### Priority Order
When multiple UK subscription services are available, pick the single highest-priority one to display:

1. **Netflix** or **Disney+** (either counts as top tier — show whichever is present, Netflix first if both)
2. **Amazon Prime Video** (if neither Netflix nor Disney+ is available)
3. **Any other service** (if none of the above three are available — pick the first one returned)

If no subscription services are available at all, show nothing (no badge, no placeholder text).

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

**`src/routes/films/+page.svelte`** — nominations list:
- For each film card, call `getStreamingAvailability(film.id)` (or batch-fetch on page load)
- Apply priority logic to select a single service from the returned array:
  1. Netflix (provider_name === "Netflix")
  2. Disney+ (provider_name === "Disney Plus")
  3. Amazon Prime Video (provider_name === "Amazon Prime Video")
  4. First item in array (fallback)
- Render the selected service's TMDB logo image (`https://image.tmdb.org/t/p/w45{logo_path}`) on the film card
- Show a warning icon if the array is empty (film has no UK subscription streaming availability)

**`src/lib/components/StreamingLogo.svelte`** — new reusable component
- Props: `services: StreamingService[]`
- Internally applies the priority logic and renders a single `<img>` logo
- Renders a warning icon (e.g. `⚠`) if no services provided, to indicate the film is not currently available on any UK subscription platform

### Testing
- Unit test `getWatchProviders()` with mocked fetch responses
- Test caching logic: cached result returned without API call when fresh
- Test priority logic: Netflix wins over Disney+, Disney+ wins over Prime, Prime wins over others, fallback to first item
- Test empty state: warning icon rendered when services array is empty
- Test error state handling

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
