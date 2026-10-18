/**
 * TMDB Film Metadata Tests
 */

import { searchFilm, searchFilmSuggestions, getWatchProviders } from './tmdb';

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
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent('The Matrix')}&language=en-US&api_key=${FAKE_API_KEY}`
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

describe('searchFilmSuggestions', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns mapped suggestions from the first limit results', async () => {
    // Arrange
    const mockResults = [
      { id: 603, title: 'The Matrix', release_date: '1999-03-30', poster_path: '/matrix.jpg' },
      { id: 604, title: 'The Matrix Reloaded', release_date: '2003-05-15', poster_path: '/reloaded.jpg' },
    ];
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    } as Response);

    // Act
    const suggestions = await searchFilmSuggestions('The Matrix', FAKE_API_KEY);

    // Assert
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toEqual({
      tmdbId: 603,
      title: 'The Matrix',
      releaseYear: 1999,
      posterPath: '/matrix.jpg',
    });
    expect(suggestions[1]).toEqual({
      tmdbId: 604,
      title: 'The Matrix Reloaded',
      releaseYear: 2003,
      posterPath: '/reloaded.jpg',
    });
  });

  it('returns empty array when results is empty', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);

    // Act
    const suggestions = await searchFilmSuggestions('nonexistent film xyz', FAKE_API_KEY);

    // Assert
    expect(suggestions).toEqual([]);
  });

  it('returns empty array on non-OK API status', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    const suggestions = await searchFilmSuggestions('The Matrix', FAKE_API_KEY);

    // Assert
    expect(suggestions).toEqual([]);
    consoleErrorSpy.mockRestore();
  });

  it('returns empty array on fetch throw', async () => {
    // Arrange
    fetchSpy.mockRejectedValue(new Error('Network error'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    const suggestions = await searchFilmSuggestions('The Matrix', FAKE_API_KEY);

    // Assert
    expect(suggestions).toEqual([]);
    consoleErrorSpy.mockRestore();
  });

  it('respects the limit parameter and only returns up to limit items', async () => {
    // Arrange
    const mockResults = Array.from({ length: 10 }, (_, i) => ({
      id: 600 + i,
      title: `Film ${i}`,
      release_date: '2000-01-01',
      poster_path: null,
    }));
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    } as Response);

    // Act
    const suggestions = await searchFilmSuggestions('Film', FAKE_API_KEY, 3);

    // Assert
    expect(suggestions).toHaveLength(3);
  });

  it('maps posterPath to null when poster_path is absent', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: 603, title: 'The Matrix', release_date: '1999-03-30' }],
      }),
    } as Response);

    // Act
    const suggestions = await searchFilmSuggestions('The Matrix', FAKE_API_KEY);

    // Assert
    expect(suggestions[0].posterPath).toBeNull();
  });

  it('maps releaseYear to null when release_date is absent', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: 603, title: 'The Matrix', poster_path: null }],
      }),
    } as Response);

    // Act
    const suggestions = await searchFilmSuggestions('The Matrix', FAKE_API_KEY);

    // Assert
    expect(suggestions[0].releaseYear).toBeNull();
  });
});

describe('getWatchProviders', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('calls the TMDB watch providers endpoint with the correct URL', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: { GB: { flatrate: [] } } }),
    } as Response);

    // Act
    await getWatchProviders(603, FAKE_API_KEY);

    // Assert
    expect(fetchSpy).toHaveBeenCalledWith(
      `https://api.themoviedb.org/3/movie/603/watch/providers?api_key=${FAKE_API_KEY}`
    );
  });

  it('returns mapped StreamingService array from GB flatrate providers with type flatrate', async () => {
    // Arrange
    const mockProviders = [
      { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' },
      { provider_id: 337, provider_name: 'Disney Plus', logo_path: '/disney.jpg' },
    ];
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: { GB: { flatrate: mockProviders } } }),
    } as Response);

    // Act
    const result = await getWatchProviders(603, FAKE_API_KEY);

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg', type: 'flatrate' });
    expect(result[1]).toEqual({ provider_id: 337, provider_name: 'Disney Plus', logo_path: '/disney.jpg', type: 'flatrate' });
  });

  it('returns rent providers with type rent when only rent providers are available', async () => {
    // Arrange
    const mockRentProviders = [
      { provider_id: 10, provider_name: 'Amazon Video', logo_path: '/amazon.jpg' },
    ];
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: { GB: { rent: mockRentProviders } } }),
    } as Response);

    // Act
    const result = await getWatchProviders(603, FAKE_API_KEY);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ provider_id: 10, provider_name: 'Amazon Video', logo_path: '/amazon.jpg', type: 'rent' });
  });

  it('returns flatrate providers first then rent providers when both exist', async () => {
    // Arrange
    const mockFlatrateProviders = [
      { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' },
    ];
    const mockRentProviders = [
      { provider_id: 10, provider_name: 'Amazon Video', logo_path: '/amazon.jpg' },
    ];
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: { GB: { flatrate: mockFlatrateProviders, rent: mockRentProviders } } }),
    } as Response);

    // Act
    const result = await getWatchProviders(603, FAKE_API_KEY);

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg', type: 'flatrate' });
    expect(result[1]).toEqual({ provider_id: 10, provider_name: 'Amazon Video', logo_path: '/amazon.jpg', type: 'rent' });
  });

  it('uses a custom country code when provided', async () => {
    // Arrange
    const mockProviders = [
      { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' },
    ];
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: { US: { flatrate: mockProviders } } }),
    } as Response);

    // Act
    const result = await getWatchProviders(603, FAKE_API_KEY, 'US');

    // Assert
    expect(result).toHaveLength(1);
  });

  it('returns empty array when country has neither flatrate nor rent providers', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: { GB: {} } }),
    } as Response);

    // Act
    const result = await getWatchProviders(603, FAKE_API_KEY);

    // Assert
    expect(result).toEqual([]);
  });

  it('returns empty array when country is not in results', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ results: {} }),
    } as Response);

    // Act
    const result = await getWatchProviders(603, FAKE_API_KEY);

    // Assert
    expect(result).toEqual([]);
  });

  it('returns empty array on non-OK API status', async () => {
    // Arrange
    fetchSpy.mockResolvedValue({ ok: false, status: 401 } as Response);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    const result = await getWatchProviders(603, FAKE_API_KEY);

    // Assert
    expect(result).toEqual([]);
    consoleErrorSpy.mockRestore();
  });

  it('returns empty array on fetch network failure', async () => {
    // Arrange
    fetchSpy.mockRejectedValue(new Error('Network error'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    const result = await getWatchProviders(603, FAKE_API_KEY);

    // Assert
    expect(result).toEqual([]);
    consoleErrorSpy.mockRestore();
  });
});
