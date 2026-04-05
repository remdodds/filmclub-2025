/**
 * Films API Endpoints
 *
 * Thin Express route handlers using film business logic
 */

import { Request, Response } from 'express';
import { db } from '../utils/db';
import {
  validateFilmTitle,
  canNominateFilm,
  createFilmNomination,
  sortFilmsByDate,
  Film,
} from '../films/films.logic';
import { searchFilm, searchFilmSuggestions, getWatchProviders, tmdbApiKey } from '../tmdb/tmdb';

/**
 * GET /films
 * List all nominated films
 *
 * Response:
 * {
 *   films: Film[]
 * }
 */
export async function listFilms(req: Request, res: Response): Promise<void> {
  try {
    const snapshot = await db
      .collection('films')
      .where('status', '==', 'nominated')
      .get();

    const films: Film[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        addedBy: data.addedBy,
        addedAt: data.addedAt.toDate(),
        status: data.status,
        metadata: data.metadata ?? undefined,
      };
    });

    const sorted = sortFilmsByDate(films);

    res.status(200).json({ films: sorted });
  } catch (error) {
    console.error('List films error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /films
 * Add a new film nomination
 *
 * Request body:
 * {
 *   title: string
 * }
 *
 * Note: visitorId comes from auth middleware (req.visitorId)
 *
 * Response:
 * {
 *   film: Film
 * }
 */
export async function addFilm(req: Request, res: Response): Promise<void> {
  try {
    const { title } = req.body;
    const visitorId = (req as any).visitorId; // From auth middleware

    // Validate title
    const validation = validateFilmTitle(title);
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    // Get existing nominated films
    const nominatedSnapshot = await db
      .collection('films')
      .where('status', '==', 'nominated')
      .get();

    const nominatedFilms: Film[] = nominatedSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        addedBy: data.addedBy,
        addedAt: data.addedAt.toDate(),
        status: data.status,
      };
    });

    // Get watched films
    const watchedSnapshot = await db
      .collection('films')
      .where('status', '==', 'watched')
      .get();

    const watchedFilms: Film[] = watchedSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        addedBy: data.addedBy,
        addedAt: data.addedAt.toDate(),
        status: data.status,
        watchedAt: data.watchedAt?.toDate(),
      };
    });

    // Check if can nominate
    const eligibility = canNominateFilm(title, nominatedFilms, watchedFilms);
    if (!eligibility.canNominate) {
      res.status(409).json({ error: eligibility.reason });
      return;
    }

    // Create film nomination
    const film = createFilmNomination(title, visitorId);

    // Save to Firestore
    await db.collection('films').doc(film.id).set({
      title: film.title,
      addedBy: film.addedBy,
      addedAt: film.addedAt,
      status: film.status,
    });

    // Non-blocking metadata enrichment
    searchFilm(title, tmdbApiKey.value()).then((metadata) => {
      if (metadata) {
        db.collection('films').doc(film.id).update({ metadata }).catch((err) => {
          console.error('Failed to save TMDB metadata:', err);
        });
      }
    }).catch((err) => {
      console.error('TMDB search failed:', err);
    });

    res.status(201).json({ film });
  } catch (error) {
    console.error('Add film error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /films/:id
 * Remove a film nomination
 *
 * Response:
 * {
 *   success: true
 * }
 */
export async function deleteFilm(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const docRef = db.collection('films').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: 'Film not found' });
      return;
    }

    const data = doc.data()!;
    if (data.status !== 'nominated') {
      res.status(400).json({ error: 'Can only delete nominated films' });
      return;
    }

    await docRef.delete();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete film error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /films/search?q=<query>
 * Search for film suggestions via TMDB
 *
 * Response:
 * {
 *   suggestions: FilmSuggestion[]
 * }
 */
export async function searchFilms(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query.q;

    if (!q || typeof q !== 'string' || q.trim() === '') {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const suggestions = await searchFilmSuggestions(q.trim(), tmdbApiKey.value());
    res.status(200).json({ suggestions });
  } catch (error) {
    console.error('Search films error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /films/:id/streaming
 * Get UK streaming availability for a nominated film.
 * Results are cached on the film document for 7 days.
 *
 * Response:
 * {
 *   services: StreamingService[]
 * }
 */
export async function getStreamingAvailability(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const docRef = db.collection('films').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: 'Film not found' });
      return;
    }

    const data = doc.data()!;

    // Return cached result if it's less than 7 days old
    if (data.streamingAvailability) {
      const fetchedAt: Date = data.streamingAvailability.fetchedAt.toDate();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (fetchedAt > sevenDaysAgo) {
        res.status(200).json({ services: data.streamingAvailability.services });
        return;
      }
    }

    // Need tmdbId to fetch from TMDB
    const tmdbId = data.metadata?.tmdbId;
    if (!tmdbId) {
      res.status(200).json({ services: [] });
      return;
    }

    const services = await getWatchProviders(tmdbId, tmdbApiKey.value());

    await docRef.update({
      streamingAvailability: {
        services,
        fetchedAt: new Date(),
        country: 'GB',
      },
    });

    res.status(200).json({ services });
  } catch (error) {
    console.error('Get streaming availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /films/history
 * Get watch history (all watched films)
 *
 * Response:
 * {
 *   films: Film[]
 * }
 */
export async function getHistory(req: Request, res: Response): Promise<void> {
  try {
    const snapshot = await db
      .collection('films')
      .where('status', '==', 'watched')
      .get();

    const films: Film[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        addedBy: data.addedBy,
        addedAt: data.addedAt.toDate(),
        status: data.status,
        watchedAt: data.watchedAt?.toDate(),
        metadata: data.metadata ?? undefined,
      };
    });

    const sorted = sortFilmsByDate(films);

    res.status(200).json({ films: sorted });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
