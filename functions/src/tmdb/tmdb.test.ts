/**
 * TMDB Film Metadata Tests
 */

import { searchFilm } from './tmdb';

const FAKE_API_KEY = 'test-api-key-123';

describe('searchFilm', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns mapped FilmMetadata from the first result on a successful response', async () => {
    // Arrange
    const mockResult = {
      id: 603,
      poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
      overview: 'Set in the 22nd century, The Matrix tells the story of a computer hacker...',
      release_date: '1999-03-30',
    };
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [mockResult, { id: 999 }] }),
    } as Response);

    // Act
    const result = await searchFilm('The Matrix', FAKE_API_KEY);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.tmdbId).toBe(603);
    expect(result!.posterPath).toBe('/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg');
    expect(result!.overview).toBe('Set in the 22nd century, The Matrix tells the story of a computer hacker...');
    expect(result!.releaseYear).toBe(1999);
    expect(result!.fetchedAt).toBeInstanceOf(Date);
  });

  it('calls the TMDB search API with the correct URL including encoded title and api key', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 603, poster_path: null, overview: null, release_date: '1999-03-30' }] }),
    } as Response);

    // Act
    await searchFilm('The Matrix', FAKE_API_KEY);

    // Assert
    expect(fetchSpy).toHaveBeenCalledWith(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent('The Matrix')}&api_key=${FAKE_API_KEY}`
    );
  });

  it('returns null when the API returns an empty results array', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);

    // Act
    const result = await searchFilm('Unknown Film Title XYZ', FAKE_API_KEY);

    // Assert
    expect(result).toBeNull();
  });

  it('returns null when the API responds with a non-200 status', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    const result = await searchFilm('The Matrix', FAKE_API_KEY);

    // Assert
    expect(result).toBeNull();
    consoleErrorSpy.mockRestore();
  });

  it('returns null when fetch throws an error (network failure)', async () => {
    // Arrange
    fetchSpy.mockRejectedValue(new Error('Network error'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    const result = await searchFilm('The Matrix', FAKE_API_KEY);

    // Assert
    expect(result).toBeNull();
    consoleErrorSpy.mockRestore();
  });

  it('maps posterPath to null when poster_path is absent from result', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 603, overview: 'Some overview', release_date: '1999-03-30' }] }),
    } as Response);

    // Act
    const result = await searchFilm('The Matrix', FAKE_API_KEY);

    // Assert
    expect(result!.posterPath).toBeNull();
  });

  it('maps overview to null when overview is absent from result', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 603, poster_path: null, release_date: '1999-03-30' }] }),
    } as Response);

    // Act
    const result = await searchFilm('The Matrix', FAKE_API_KEY);

    // Assert
    expect(result!.overview).toBeNull();
  });

  it('maps releaseYear to null when release_date is absent from result', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 603, poster_path: null, overview: null }] }),
    } as Response);

    // Act
    const result = await searchFilm('The Matrix', FAKE_API_KEY);

    // Assert
    expect(result!.releaseYear).toBeNull();
  });
});
