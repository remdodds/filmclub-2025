/**
 * Films API Endpoint Tests
 */

import { Request, Response } from 'express';
import { listFilms, addFilm, deleteFilm, getHistory, searchFilms, getStreamingAvailability } from './films';
import { db } from '../utils/db';
import {
  validateFilmTitle,
  canNominateFilm,
  createFilmNomination,
  sortFilmsByDate,
  Film,
} from '../films/films.logic';
import * as tmdb from '../tmdb/tmdb';

jest.mock('../utils/db', () => ({ db: { collection: jest.fn() } }));
jest.mock('../films/films.logic');
jest.mock('../tmdb/tmdb', () => ({
  searchFilm: jest.fn().mockResolvedValue(null),
  searchFilmSuggestions: jest.fn().mockResolvedValue([]),
  getWatchProviders: jest.fn().mockResolvedValue([]),
  tmdbApiKey: { value: jest.fn().mockReturnValue('mock-api-key') },
}));

describe('Films API', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  // Chainable Firestore mock pieces
  let mockGet: jest.Mock;
  let mockWhere: jest.Mock;
  let mockSet: jest.Mock;
  let mockDelete: jest.Mock;
  let mockUpdate: jest.Mock;
  let mockDocGet: jest.Mock;
  let mockDoc: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Response mocks
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };

    // Firestore chainable mocks
    mockGet = jest.fn();
    mockWhere = jest.fn().mockReturnThis();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockDelete = jest.fn().mockResolvedValue(undefined);
    mockUpdate = jest.fn().mockResolvedValue(undefined);
    mockDocGet = jest.fn();
    mockDoc = jest.fn().mockReturnValue({
      get: mockDocGet,
      set: mockSet,
      delete: mockDelete,
      update: mockUpdate,
    });

    (db.collection as jest.Mock).mockReturnValue({
      where: mockWhere,
      get: mockGet,
      doc: mockDoc,
    });
  });

  // ---------------------------------------------------------------------------
  // listFilms
  // ---------------------------------------------------------------------------

  describe('listFilms', () => {
    beforeEach(() => {
      mockRequest = {};
    });

    it('queries only nominated films from the database', async () => {
      const fakeDate = new Date('2024-01-01');
      mockGet.mockResolvedValue({
        docs: [
          {
            id: 'film-1',
            data: () => ({
              title: 'Alien',
              addedBy: 'visitor-1',
              addedAt: { toDate: () => fakeDate },
              status: 'nominated',
            }),
          },
        ],
      });
      (sortFilmsByDate as jest.Mock).mockReturnValue([]);

      await listFilms(mockRequest as Request, mockResponse as Response);

      expect(db.collection).toHaveBeenCalledWith('films');
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'nominated');
      expect(mockGet).toHaveBeenCalled();
    });

    it('maps Firestore docs to Film objects calling .toDate() on addedAt', async () => {
      const fakeDate = new Date('2024-06-15');
      const toDateMock = jest.fn().mockReturnValue(fakeDate);
      mockGet.mockResolvedValue({
        docs: [
          {
            id: 'film-1',
            data: () => ({
              title: 'Alien',
              addedBy: 'visitor-1',
              addedAt: { toDate: toDateMock },
              status: 'nominated',
            }),
          },
        ],
      });

      const expectedFilm: Film = {
        id: 'film-1',
        title: 'Alien',
        addedBy: 'visitor-1',
        addedAt: fakeDate,
        status: 'nominated',
      };
      (sortFilmsByDate as jest.Mock).mockReturnValue([expectedFilm]);

      await listFilms(mockRequest as Request, mockResponse as Response);

      expect(toDateMock).toHaveBeenCalled();
      expect(sortFilmsByDate).toHaveBeenCalledWith([expectedFilm]);
    });

    it('calls sortFilmsByDate on the resulting films', async () => {
      const fakeDate = new Date('2024-01-01');
      const mappedFilm: Film = {
        id: 'film-1',
        title: 'Alien',
        addedBy: 'visitor-1',
        addedAt: fakeDate,
        status: 'nominated',
      };
      mockGet.mockResolvedValue({
        docs: [
          {
            id: 'film-1',
            data: () => ({
              title: 'Alien',
              addedBy: 'visitor-1',
              addedAt: { toDate: () => fakeDate },
              status: 'nominated',
            }),
          },
        ],
      });
      (sortFilmsByDate as jest.Mock).mockReturnValue([mappedFilm]);

      await listFilms(mockRequest as Request, mockResponse as Response);

      expect(sortFilmsByDate).toHaveBeenCalledWith([mappedFilm]);
    });

    it('returns 200 with sorted films', async () => {
      const fakeDate = new Date('2024-01-01');
      const sortedFilms: Film[] = [
        { id: 'film-1', title: 'Alien', addedBy: 'visitor-1', addedAt: fakeDate, status: 'nominated' },
      ];
      mockGet.mockResolvedValue({
        docs: [
          {
            id: 'film-1',
            data: () => ({
              title: 'Alien',
              addedBy: 'visitor-1',
              addedAt: { toDate: () => fakeDate },
              status: 'nominated',
            }),
          },
        ],
      });
      (sortFilmsByDate as jest.Mock).mockReturnValue(sortedFilms);

      await listFilms(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ films: sortedFilms });
    });

    it('returns empty array when no nominated films exist', async () => {
      mockGet.mockResolvedValue({ docs: [] });
      (sortFilmsByDate as jest.Mock).mockReturnValue([]);

      await listFilms(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ films: [] });
    });

    it('returns 500 on unexpected error', async () => {
      mockGet.mockRejectedValue(new Error('DB failure'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await listFilms(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

      consoleErrorSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // addFilm
  // ---------------------------------------------------------------------------

  describe('addFilm', () => {
    const visitorId = 'visitor-abc';

    beforeEach(() => {
      mockRequest = {
        body: { title: 'The Matrix' },
        visitorId,
      } as any;
    });

    it('returns 400 when title validation fails', async () => {
      (validateFilmTitle as jest.Mock).mockReturnValue({ isValid: false, error: 'Film title is required' });

      await addFilm(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Film title is required' });
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('fetches both nominated and watched films for duplicate checking', async () => {
      const fakeDate = new Date('2024-01-01');
      (validateFilmTitle as jest.Mock).mockReturnValue({ isValid: true });
      mockGet
        .mockResolvedValueOnce({ docs: [] }) // nominated snapshot
        .mockResolvedValueOnce({ docs: [] }); // watched snapshot
      (canNominateFilm as jest.Mock).mockReturnValue({ canNominate: true });
      const createdFilm: Film = { id: 'film-new', title: 'The Matrix', addedBy: visitorId, addedAt: fakeDate, status: 'nominated' };
      (createFilmNomination as jest.Mock).mockReturnValue(createdFilm);

      await addFilm(mockRequest as Request, mockResponse as Response);

      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'nominated');
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'watched');
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('returns 409 when canNominateFilm returns canNominate: false', async () => {
      (validateFilmTitle as jest.Mock).mockReturnValue({ isValid: true });
      mockGet
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });
      (canNominateFilm as jest.Mock).mockReturnValue({ canNominate: false, reason: '"The Matrix" is already nominated' });

      await addFilm(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith({ error: '"The Matrix" is already nominated' });
      expect(createFilmNomination).not.toHaveBeenCalled();
    });

    it('creates a film nomination with the correct visitorId from request', async () => {
      const fakeDate = new Date('2024-01-01');
      (validateFilmTitle as jest.Mock).mockReturnValue({ isValid: true });
      mockGet
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });
      (canNominateFilm as jest.Mock).mockReturnValue({ canNominate: true });
      const createdFilm: Film = { id: 'film-new', title: 'The Matrix', addedBy: visitorId, addedAt: fakeDate, status: 'nominated' };
      (createFilmNomination as jest.Mock).mockReturnValue(createdFilm);

      await addFilm(mockRequest as Request, mockResponse as Response);

      expect(createFilmNomination).toHaveBeenCalledWith('The Matrix', visitorId);
    });

    it('saves the new film to Firestore with correct fields', async () => {
      const fakeDate = new Date('2024-01-01');
      (validateFilmTitle as jest.Mock).mockReturnValue({ isValid: true });
      mockGet
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });
      (canNominateFilm as jest.Mock).mockReturnValue({ canNominate: true });
      const createdFilm: Film = { id: 'film-new', title: 'The Matrix', addedBy: visitorId, addedAt: fakeDate, status: 'nominated' };
      (createFilmNomination as jest.Mock).mockReturnValue(createdFilm);

      await addFilm(mockRequest as Request, mockResponse as Response);

      expect(mockDoc).toHaveBeenCalledWith('film-new');
      expect(mockSet).toHaveBeenCalledWith({
        title: 'The Matrix',
        addedBy: visitorId,
        addedAt: fakeDate,
        status: 'nominated',
      });
    });

    it('returns 201 with the created film', async () => {
      const fakeDate = new Date('2024-01-01');
      (validateFilmTitle as jest.Mock).mockReturnValue({ isValid: true });
      mockGet
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });
      (canNominateFilm as jest.Mock).mockReturnValue({ canNominate: true });
      const createdFilm: Film = { id: 'film-new', title: 'The Matrix', addedBy: visitorId, addedAt: fakeDate, status: 'nominated' };
      (createFilmNomination as jest.Mock).mockReturnValue(createdFilm);

      await addFilm(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({ film: createdFilm });
    });

    it('maps nominated and watched Firestore docs to Film objects when checking eligibility', async () => {
      // Arrange
      const fakeDate = new Date('2024-01-01');
      const fakeWatchedDate = new Date('2024-06-01');
      (validateFilmTitle as jest.Mock).mockReturnValue({ isValid: true });
      mockGet
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'nominated-1',
              data: () => ({
                title: 'Existing Nomination',
                addedBy: 'visitor-2',
                addedAt: { toDate: () => fakeDate },
                status: 'nominated',
              }),
            },
          ],
        })
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'watched-1',
              data: () => ({
                title: 'Already Watched',
                addedBy: 'visitor-3',
                addedAt: { toDate: () => fakeDate },
                status: 'watched',
                watchedAt: { toDate: () => fakeWatchedDate },
              }),
            },
          ],
        });
      (canNominateFilm as jest.Mock).mockReturnValue({ canNominate: true });
      const createdFilm: Film = { id: 'film-new', title: 'The Matrix', addedBy: visitorId, addedAt: fakeDate, status: 'nominated' };
      (createFilmNomination as jest.Mock).mockReturnValue(createdFilm);

      // Act
      await addFilm(mockRequest as Request, mockResponse as Response);

      // Assert — canNominateFilm receives the mapped nominated and watched film arrays
      expect(canNominateFilm).toHaveBeenCalledWith(
        'The Matrix',
        expect.arrayContaining([expect.objectContaining({ id: 'nominated-1', title: 'Existing Nomination' })]),
        expect.arrayContaining([expect.objectContaining({ id: 'watched-1', title: 'Already Watched' })]),
      );
    });

    it('returns 500 on unexpected error', async () => {
      (validateFilmTitle as jest.Mock).mockReturnValue({ isValid: true });
      mockGet.mockRejectedValue(new Error('DB failure'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await addFilm(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

      consoleErrorSpy.mockRestore();
    });

    it('still returns 201 when TMDB searchFilm throws (non-blocking enrichment)', async () => {
      const fakeDate = new Date('2024-01-01');
      (validateFilmTitle as jest.Mock).mockReturnValue({ isValid: true });
      mockGet
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });
      (canNominateFilm as jest.Mock).mockReturnValue({ canNominate: true });
      const createdFilm: Film = { id: 'film-new', title: 'The Matrix', addedBy: visitorId, addedAt: fakeDate, status: 'nominated' };
      (createFilmNomination as jest.Mock).mockReturnValue(createdFilm);
      (tmdb.searchFilm as jest.Mock).mockRejectedValue(new Error('TMDB network failure'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await addFilm(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({ film: createdFilm });

      consoleErrorSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteFilm
  // ---------------------------------------------------------------------------

  describe('deleteFilm', () => {
    beforeEach(() => {
      mockRequest = {
        params: { id: 'film-123' },
      };
    });

    it('returns 404 when film does not exist', async () => {
      mockDocGet.mockResolvedValue({ exists: false });

      await deleteFilm(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Film not found' });
    });

    it('returns 400 when film status is watched (not nominated)', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: 'watched', title: 'Alien' }),
      });

      await deleteFilm(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Can only delete nominated films' });
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('deletes the film document from Firestore when it is nominated', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: 'nominated', title: 'Alien' }),
      });

      await deleteFilm(mockRequest as Request, mockResponse as Response);

      expect(mockDoc).toHaveBeenCalledWith('film-123');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('returns 200 success after deleting', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: 'nominated', title: 'Alien' }),
      });

      await deleteFilm(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ success: true });
    });

    it('returns 500 on unexpected error', async () => {
      mockDocGet.mockRejectedValue(new Error('DB failure'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await deleteFilm(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

      consoleErrorSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // getHistory
  // ---------------------------------------------------------------------------

  describe('getHistory (films history)', () => {
    beforeEach(() => {
      mockRequest = {};
    });

    it('queries only watched films from the database', async () => {
      const fakeDate = new Date('2024-01-01');
      mockGet.mockResolvedValue({
        docs: [
          {
            id: 'film-1',
            data: () => ({
              title: 'Alien',
              addedBy: 'visitor-1',
              addedAt: { toDate: () => fakeDate },
              status: 'watched',
              watchedAt: { toDate: () => fakeDate },
            }),
          },
        ],
      });
      (sortFilmsByDate as jest.Mock).mockReturnValue([]);

      await getHistory(mockRequest as Request, mockResponse as Response);

      expect(db.collection).toHaveBeenCalledWith('films');
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'watched');
      expect(mockGet).toHaveBeenCalled();
    });

    it('maps watchedAt field through .toDate() using optional chaining', async () => {
      const fakeAddedAt = new Date('2024-01-01');
      const fakeWatchedAt = new Date('2024-02-15');
      const toDateAddedAt = jest.fn().mockReturnValue(fakeAddedAt);
      const toDateWatchedAt = jest.fn().mockReturnValue(fakeWatchedAt);

      mockGet.mockResolvedValue({
        docs: [
          {
            id: 'film-1',
            data: () => ({
              title: 'Alien',
              addedBy: 'visitor-1',
              addedAt: { toDate: toDateAddedAt },
              status: 'watched',
              watchedAt: { toDate: toDateWatchedAt },
            }),
          },
        ],
      });

      const expectedFilm: Film = {
        id: 'film-1',
        title: 'Alien',
        addedBy: 'visitor-1',
        addedAt: fakeAddedAt,
        status: 'watched',
        watchedAt: fakeWatchedAt,
      };
      (sortFilmsByDate as jest.Mock).mockReturnValue([expectedFilm]);

      await getHistory(mockRequest as Request, mockResponse as Response);

      expect(toDateWatchedAt).toHaveBeenCalled();
      expect(sortFilmsByDate).toHaveBeenCalledWith([expectedFilm]);
    });

    it('maps watchedAt as undefined when the field is absent (optional chaining)', async () => {
      const fakeAddedAt = new Date('2024-01-01');

      mockGet.mockResolvedValue({
        docs: [
          {
            id: 'film-1',
            data: () => ({
              title: 'Alien',
              addedBy: 'visitor-1',
              addedAt: { toDate: () => fakeAddedAt },
              status: 'watched',
              // watchedAt intentionally absent
            }),
          },
        ],
      });

      const expectedFilm: Film = {
        id: 'film-1',
        title: 'Alien',
        addedBy: 'visitor-1',
        addedAt: fakeAddedAt,
        status: 'watched',
        watchedAt: undefined,
      };
      (sortFilmsByDate as jest.Mock).mockReturnValue([expectedFilm]);

      await getHistory(mockRequest as Request, mockResponse as Response);

      expect(sortFilmsByDate).toHaveBeenCalledWith([expectedFilm]);
    });

    it('returns films sorted by date', async () => {
      const fakeDate = new Date('2024-01-01');
      const sortedFilms: Film[] = [
        { id: 'film-1', title: 'Alien', addedBy: 'visitor-1', addedAt: fakeDate, status: 'watched', watchedAt: fakeDate },
      ];
      mockGet.mockResolvedValue({
        docs: [
          {
            id: 'film-1',
            data: () => ({
              title: 'Alien',
              addedBy: 'visitor-1',
              addedAt: { toDate: () => fakeDate },
              status: 'watched',
              watchedAt: { toDate: () => fakeDate },
            }),
          },
        ],
      });
      (sortFilmsByDate as jest.Mock).mockReturnValue(sortedFilms);

      await getHistory(mockRequest as Request, mockResponse as Response);

      expect(sortFilmsByDate).toHaveBeenCalled();
    });

    it('returns 200 with sorted films', async () => {
      const fakeDate = new Date('2024-01-01');
      const sortedFilms: Film[] = [
        { id: 'film-1', title: 'Alien', addedBy: 'visitor-1', addedAt: fakeDate, status: 'watched', watchedAt: fakeDate },
      ];
      mockGet.mockResolvedValue({
        docs: [
          {
            id: 'film-1',
            data: () => ({
              title: 'Alien',
              addedBy: 'visitor-1',
              addedAt: { toDate: () => fakeDate },
              status: 'watched',
              watchedAt: { toDate: () => fakeDate },
            }),
          },
        ],
      });
      (sortFilmsByDate as jest.Mock).mockReturnValue(sortedFilms);

      await getHistory(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ films: sortedFilms });
    });

    it('returns 500 on unexpected error', async () => {
      mockGet.mockRejectedValue(new Error('DB failure'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await getHistory(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

      consoleErrorSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // searchFilms
  // ---------------------------------------------------------------------------

  describe('searchFilms', () => {
    beforeEach(() => {
      mockRequest = {};
    });

    it('returns 400 when q query param is missing', async () => {
      mockRequest = { query: {} } as any;

      await searchFilms(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Query parameter "q" is required' });
    });

    it('returns 400 when q is empty string', async () => {
      mockRequest = { query: { q: '' } } as any;

      await searchFilms(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Query parameter "q" is required' });
    });

    it('calls searchFilmSuggestions with the trimmed query and api key', async () => {
      mockRequest = { query: { q: '  The Matrix  ' } } as any;
      (tmdb.searchFilmSuggestions as jest.Mock).mockResolvedValue([]);

      await searchFilms(mockRequest as Request, mockResponse as Response);

      expect(tmdb.searchFilmSuggestions).toHaveBeenCalledWith('The Matrix', 'mock-api-key');
    });

    it('returns 200 with suggestions array', async () => {
      const fakeSuggestions = [
        { tmdbId: 603, title: 'The Matrix', releaseYear: 1999, posterPath: '/matrix.jpg' },
      ];
      mockRequest = { query: { q: 'The Matrix' } } as any;
      (tmdb.searchFilmSuggestions as jest.Mock).mockResolvedValue(fakeSuggestions);

      await searchFilms(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ suggestions: fakeSuggestions });
    });

    it('returns 500 on unexpected error', async () => {
      mockRequest = { query: { q: 'The Matrix' } } as any;
      (tmdb.searchFilmSuggestions as jest.Mock).mockRejectedValue(new Error('TMDB failure'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await searchFilms(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

      consoleErrorSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // getStreamingAvailability
  // ---------------------------------------------------------------------------

  describe('getStreamingAvailability', () => {
    beforeEach(() => {
      mockRequest = { params: { id: 'film-123' } } as any;
    });

    it('returns 404 when the film does not exist', async () => {
      mockDocGet.mockResolvedValue({ exists: false });

      await getStreamingAvailability(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Film not found' });
    });

    it('returns cached services without calling TMDB when cache is fresh (< 7 days)', async () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const cachedServices = [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' }];
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          streamingAvailability: {
            services: cachedServices,
            fetchedAt: { toDate: () => recentDate },
            country: 'GB',
          },
        }),
      });

      await getStreamingAvailability(mockRequest as Request, mockResponse as Response);

      expect(tmdb.getWatchProviders).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ services: cachedServices });
    });

    it('re-fetches from TMDB when cached data is stale (> 7 days)', async () => {
      const staleDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      const freshServices = [{ provider_id: 337, provider_name: 'Disney Plus', logo_path: '/disney.jpg' }];
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          metadata: { tmdbId: 603 },
          streamingAvailability: {
            services: [],
            fetchedAt: { toDate: () => staleDate },
            country: 'GB',
          },
        }),
      });
      (tmdb.getWatchProviders as jest.Mock).mockResolvedValue(freshServices);

      await getStreamingAvailability(mockRequest as Request, mockResponse as Response);

      expect(tmdb.getWatchProviders).toHaveBeenCalledWith(603, 'mock-api-key');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ services: freshServices });
    });

    it('returns empty services and skips TMDB call when film has no tmdbId', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ title: 'Some Film' }), // no metadata
      });

      await getStreamingAvailability(mockRequest as Request, mockResponse as Response);

      expect(tmdb.getWatchProviders).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ services: [] });
    });

    it('fetches from TMDB and saves to Firestore when no cache exists', async () => {
      const services = [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' }];
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ metadata: { tmdbId: 603 } }),
      });
      (tmdb.getWatchProviders as jest.Mock).mockResolvedValue(services);

      await getStreamingAvailability(mockRequest as Request, mockResponse as Response);

      expect(tmdb.getWatchProviders).toHaveBeenCalledWith(603, 'mock-api-key');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          streamingAvailability: expect.objectContaining({
            services,
            country: 'GB',
          }),
        })
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ services });
    });

    it('returns 500 on unexpected error', async () => {
      mockDocGet.mockRejectedValue(new Error('DB failure'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await getStreamingAvailability(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

      consoleErrorSpy.mockRestore();
    });
  });
});
