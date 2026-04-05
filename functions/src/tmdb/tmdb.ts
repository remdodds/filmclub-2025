/**
 * TMDB Film Metadata
 *
 * Fetches film metadata from The Movie Database API.
 * Failures are non-blocking — always returns null on any error.
 */

import { defineSecret } from 'firebase-functions/params';

export const tmdbApiKey = defineSecret('TMDB_API_KEY');

export interface FilmSuggestion {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  posterPath: string | null;
}

export interface FilmMetadata {
  tmdbId: number;
  posterPath: string | null;
  overview: string | null;
  releaseYear: number | null;
  fetchedAt: Date;
}

export interface StreamingService {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

/**
 * Search for a film on TMDB by title.
 * Returns the first result mapped to FilmMetadata, or null if not found or on any error.
 *
 * @param title - Film title to search for
 * @param apiKey - TMDB API key (passed as parameter to allow testing without secret)
 */
export async function searchFilm(title: string, apiKey: string): Promise<FilmMetadata | null> {
  try {
    const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&language=en-US&api_key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`TMDB API returned non-OK status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const results = data.results as any[];

    if (!results || results.length === 0) {
      return null;
    }

    const result = results[0];

    return {
      tmdbId: result.id,
      posterPath: result.poster_path ?? null,
      overview: result.overview ?? null,
      releaseYear: result.release_date ? parseInt(result.release_date.slice(0, 4)) : null,
      fetchedAt: new Date(),
    };
  } catch (err) {
    console.error('TMDB searchFilm error:', err);
    return null;
  }
}

/**
 * Get UK streaming providers (flatrate/subscription) for a film by TMDB ID.
 * Returns [] on any error or if no providers found (non-blocking).
 *
 * @param tmdbId - TMDB movie ID
 * @param apiKey - TMDB API key (passed as parameter to allow testing without secret)
 * @param country - ISO 3166-1 country code (default: 'GB')
 */
export async function getWatchProviders(
  tmdbId: number,
  apiKey: string,
  country = 'GB'
): Promise<StreamingService[]> {
  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`TMDB watch providers API returned non-OK status: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const flatrate = data.results?.[country]?.flatrate;

    if (!flatrate || !Array.isArray(flatrate) || flatrate.length === 0) {
      return [];
    }

    return flatrate.map((provider: any) => ({
      provider_id: provider.provider_id,
      provider_name: provider.provider_name,
      logo_path: provider.logo_path,
    }));
  } catch (err) {
    console.error('TMDB getWatchProviders error:', err);
    return [];
  }
}

/**
 * Search for film suggestions on TMDB by query string.
 * Returns up to `limit` results as FilmSuggestion objects, or [] on any error.
 *
 * @param query - Search query string
 * @param apiKey - TMDB API key (passed as parameter to allow testing without secret)
 * @param limit - Maximum number of suggestions to return (default: 5)
 */
export async function searchFilmSuggestions(
  query: string,
  apiKey: string,
  limit = 5
): Promise<FilmSuggestion[]> {
  try {
    const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&language=en-US&api_key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`TMDB API returned non-OK status: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results = data.results as any[];

    if (!results || results.length === 0) {
      return [];
    }

    return results.slice(0, limit).map((result) => ({
      tmdbId: result.id,
      title: result.title,
      releaseYear: result.release_date ? parseInt(result.release_date.slice(0, 4)) : null,
      posterPath: result.poster_path ?? null,
    }));
  } catch (err) {
    console.error('TMDB searchFilmSuggestions error:', err);
    return [];
  }
}
