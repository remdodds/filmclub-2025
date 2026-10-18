/**
 * Frontend-only easter eggs.  Pure functions — no DOM, no network.
 */

/** A trailing release year such as " (2001)". */
const TRAILING_YEAR = /\s*\(\d{4}\)$/;

/** Anything that isn't a letter or digit (punctuation, whitespace, symbols). */
const NON_ALPHANUMERIC = /[^a-z0-9]/g;

/** "pearlharbor" or the British "pearlharbour", once compacted. */
const PEARL_HARBOR = /^pearlharbou?r$/;

/**
 * Lower-cases a title and strips a trailing "(yyyy)" year plus all
 * punctuation and whitespace, so "PEARL-HARBOR (2001)" → "pearlharbor".
 * Mirrors the spirit of the backend's normalizeFilmTitle, but is stricter
 * because it is only used for exact easter-egg matches.
 */
function compactTitle(title: string): string {
  return title.toLowerCase().trim().replace(TRAILING_YEAR, '').replace(NON_ALPHANUMERIC, '');
}

/**
 * True when the title is Pearl Harbor (any case, either spelling, ignoring
 * punctuation, whitespace and a trailing release year).
 */
export function isPearlHarbor(title: string): boolean {
  return PEARL_HARBOR.test(compactTitle(title));
}
