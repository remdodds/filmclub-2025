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

/**
 * Search for a film on TMDB by title.
 * Returns the first result mapped to FilmMetadata, or null if not found or on any error.
 *
 * @param title - Film title to search for
 * @param apiKey - TMDB API key (passed as parameter to allow testing without secret)
 */
export async function searchFilm(title: string, apiKey: string): Promise<FilmMetadata | null> {
  try {
    const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&api_key=${apiKey}`;
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
    const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&api_key=${apiKey}`;
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
      title: result.original_title,
      releaseYear: result.release_date ? parseInt(result.release_date.slice(0, 4)) : null,
      posterPath: result.poster_path ?? null,
    }));
  } catch (err) {
    console.error('TMDB searchFilmSuggestions error:', err);
    return [];
  }
}
