import { describe, it, expect } from '@jest/globals';
import {
  normalizeFilmTitle,
  areTitlesDuplicate,
  validateFilmTitle,
  findDuplicate,
  canNominateFilm,
  createFilmNomination,
  markFilmAsWatched,
  sortFilmsByDate,
  Film,
} from './films.logic';

describe('Film Business Logic', () => {
  describe('normalizeFilmTitle', () => {
    it('should convert to lowercase', () => {
      expect(normalizeFilmTitle('The GODFATHER')).toBe('the godfather');
    });

    it('should trim whitespace', () => {
      expect(normalizeFilmTitle('  The Godfather  ')).toBe('the godfather');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeFilmTitle('The    Godfather')).toBe('the godfather');
      expect(normalizeFilmTitle('The  Big    Lebowski')).toBe('the big lebowski');
    });

    it('should handle empty string', () => {
      expect(normalizeFilmTitle('')).toBe('');
    });

    it('should handle only whitespace', () => {
      expect(normalizeFilmTitle('   ')).toBe('');
    });
  });

  describe('areTitlesDuplicate', () => {
    it('should match exact titles', () => {
      expect(areTitlesDuplicate('The Godfather', 'The Godfather')).toBe(true);
    });

    it('should match case-insensitive', () => {
      expect(areTitlesDuplicate('The Godfather', 'the godfather')).toBe(true);
      expect(areTitlesDuplicate('THE GODFATHER', 'the godfather')).toBe(true);
    });

    it('should match with different whitespace', () => {
      expect(areTitlesDuplicate('The Godfather', '  The  Godfather  ')).toBe(true);
      expect(areTitlesDuplicate('The   Godfather', 'The Godfather')).toBe(true);
    });

    it('should not match different titles', () => {
      expect(areTitlesDuplicate('The Godfather', 'The Godfather Part II')).toBe(false);
      expect(areTitlesDuplicate('Inception', 'Interstellar')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(areTitlesDuplicate('', '')).toBe(true);
      expect(areTitlesDuplicate('Film', '')).toBe(false);
    });
  });

  describe('validateFilmTitle', () => {
    it('should accept valid title', () => {
      const result = validateFilmTitle('The Godfather');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept single character title', () => {
      const result = validateFilmTitle('M');

      expect(result.isValid).toBe(true);
    });

    it('should reject empty title', () => {
      const result = validateFilmTitle('');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Film title is required');
    });

    it('should reject whitespace-only title', () => {
      const result = validateFilmTitle('   ');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Film title is required');
    });

    it('should reject title over 200 characters', () => {
      const longTitle = 'a'.repeat(201);
      const result = validateFilmTitle(longTitle);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Film title must be less than 200 characters');
    });

    it('should accept title with exactly 200 characters', () => {
      const exactTitle = 'a'.repeat(200);
      const result = validateFilmTitle(exactTitle);

      expect(result.isValid).toBe(true);
    });

    it('should accept title with special characters', () => {
      const result = validateFilmTitle('Amélie (2001)');

      expect(result.isValid).toBe(true);
    });
  });

  describe('findDuplicate', () => {
    const existingFilms: Film[] = [
      {
        id: '1',
        title: 'The Godfather',
        addedBy: 'user1',
        addedAt: new Date(),
        status: 'nominated',
      },
      {
        id: '2',
        title: 'Inception',
        addedBy: 'user2',
        addedAt: new Date(),
        status: 'nominated',
      },
    ];

    it('should find exact match', () => {
      const duplicate = findDuplicate('The Godfather', existingFilms);

      expect(duplicate).not.toBeNull();
      expect(duplicate?.id).toBe('1');
    });

    it('should find case-insensitive match', () => {
      const duplicate = findDuplicate('the godfather', existingFilms);

      expect(duplicate).not.toBeNull();
      expect(duplicate?.id).toBe('1');
    });

    it('should find match with different whitespace', () => {
      const duplicate = findDuplicate('  The   Godfather  ', existingFilms);

      expect(duplicate).not.toBeNull();
      expect(duplicate?.id).toBe('1');
    });

    it('should return null for non-duplicate', () => {
      const duplicate = findDuplicate('Interstellar', existingFilms);

      expect(duplicate).toBeNull();
    });

    it('should return null for empty list', () => {
      const duplicate = findDuplicate('The Godfather', []);

      expect(duplicate).toBeNull();
    });
  });

  describe('canNominateFilm', () => {
    const nominatedFilms: Film[] = [
      {
        id: '1',
        title: 'The Godfather',
        addedBy: 'user1',
        addedAt: new Date(),
        status: 'nominated',
      },
    ];

    const watchedFilms: Film[] = [
      {
        id: '2',
        title: 'Inception',
        addedBy: 'user2',
        addedAt: new Date('2024-01-01'),
        status: 'watched',
        watchedAt: new Date('2024-01-15'),
      },
    ];

    it('should allow nomination of new film', () => {
      const result = canNominateFilm('Interstellar', nominatedFilms, watchedFilms);

      expect(result.canNominate).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject already nominated film', () => {
      const result = canNominateFilm('The Godfather', nominatedFilms, watchedFilms);

      expect(result.canNominate).toBe(false);
      expect(result.reason).toBe('"The Godfather" is already nominated');
    });

    it('should reject already watched film', () => {
      const result = canNominateFilm('Inception', nominatedFilms, watchedFilms);

      expect(result.canNominate).toBe(false);
      expect(result.reason).toBe('"Inception" was already watched');
    });

    it('should reject case-insensitive duplicate', () => {
      const result = canNominateFilm('the godfather', nominatedFilms, watchedFilms);

      expect(result.canNominate).toBe(false);
    });

    it('should work without watched films parameter', () => {
      const result = canNominateFilm('Inception', nominatedFilms);

      expect(result.canNominate).toBe(true);
    });
  });

  describe('createFilmNomination', () => {
    it('should create film with required fields', () => {
      const film = createFilmNomination('The Godfather', 'user123');

      expect(film.title).toBe('The Godfather');
      expect(film.addedBy).toBe('user123');
      expect(film.status).toBe('nominated');
      expect(film.id).toBeDefined();
      expect(film.addedAt).toBeInstanceOf(Date);
    });

    it('should trim title', () => {
      const film = createFilmNomination('  The Godfather  ', 'user123');

      expect(film.title).toBe('The Godfather');
    });

    it('should use provided ID', () => {
      const film = createFilmNomination('The Godfather', 'user123', 'custom-id');

      expect(film.id).toBe('custom-id');
    });

    it('should use provided timestamp', () => {
      const customDate = new Date('2024-01-01');
      const film = createFilmNomination('The Godfather', 'user123', undefined, customDate);

      expect(film.addedAt).toBe(customDate);
    });

    it('should not have watchedAt for nominated films', () => {
      const film = createFilmNomination('The Godfather', 'user123');

      expect(film.watchedAt).toBeUndefined();
    });
  });

  describe('markFilmAsWatched', () => {
    it('should update status to watched', () => {
      const nominated: Film = {
        id: '1',
        title: 'The Godfather',
        addedBy: 'user1',
        addedAt: new Date('2024-01-01'),
        status: 'nominated',
      };

      const watched = markFilmAsWatched(nominated);

      expect(watched.status).toBe('watched');
      expect(watched.watchedAt).toBeInstanceOf(Date);
    });

    it('should preserve original film data', () => {
      const nominated: Film = {
        id: '1',
        title: 'The Godfather',
        addedBy: 'user1',
        addedAt: new Date('2024-01-01'),
        status: 'nominated',
      };

      const watched = markFilmAsWatched(nominated);

      expect(watched.id).toBe(nominated.id);
      expect(watched.title).toBe(nominated.title);
      expect(watched.addedBy).toBe(nominated.addedBy);
      expect(watched.addedAt).toBe(nominated.addedAt);
    });

    it('should use provided watchedAt date', () => {
      const nominated: Film = {
        id: '1',
        title: 'The Godfather',
        addedBy: 'user1',
        addedAt: new Date('2024-01-01'),
        status: 'nominated',
      };

      const watchDate = new Date('2024-01-15');
      const watched = markFilmAsWatched(nominated, watchDate);

      expect(watched.watchedAt).toBe(watchDate);
    });

    it('should not mutate original film', () => {
      const nominated: Film = {
        id: '1',
        title: 'The Godfather',
        addedBy: 'user1',
        addedAt: new Date('2024-01-01'),
        status: 'nominated',
      };

      markFilmAsWatched(nominated);

      expect(nominated.status).toBe('nominated');
      expect(nominated.watchedAt).toBeUndefined();
    });
  });

  describe('sortFilmsByDate', () => {
    it('should sort by addedAt descending (most recent first)', () => {
      const films: Film[] = [
        {
          id: '1',
          title: 'Film 1',
          addedBy: 'user1',
          addedAt: new Date('2024-01-01'),
          status: 'nominated',
        },
        {
          id: '2',
          title: 'Film 2',
          addedBy: 'user2',
          addedAt: new Date('2024-01-15'),
          status: 'nominated',
        },
        {
          id: '3',
          title: 'Film 3',
          addedBy: 'user3',
          addedAt: new Date('2024-01-10'),
          status: 'nominated',
        },
      ];

      const sorted = sortFilmsByDate(films);

      expect(sorted[0].id).toBe('2'); // 2024-01-15
      expect(sorted[1].id).toBe('3'); // 2024-01-10
      expect(sorted[2].id).toBe('1'); // 2024-01-01
    });

    it('should use watchedAt for watched films', () => {
      const films: Film[] = [
        {
          id: '1',
          title: 'Film 1',
          addedBy: 'user1',
          addedAt: new Date('2024-01-01'),
          status: 'watched',
          watchedAt: new Date('2024-01-20'),
        },
        {
          id: '2',
          title: 'Film 2',
          addedBy: 'user2',
          addedAt: new Date('2024-01-15'),
          status: 'nominated',
        },
      ];

      const sorted = sortFilmsByDate(films);

      expect(sorted[0].id).toBe('1'); // watchedAt 2024-01-20
      expect(sorted[1].id).toBe('2'); // addedAt 2024-01-15
    });

    it('should not mutate original array', () => {
      const films: Film[] = [
        {
          id: '1',
          title: 'Film 1',
          addedBy: 'user1',
          addedAt: new Date('2024-01-01'),
          status: 'nominated',
        },
        {
          id: '2',
          title: 'Film 2',
          addedBy: 'user2',
          addedAt: new Date('2024-01-15'),
          status: 'nominated',
        },
      ];

      const originalFirst = films[0].id;
      sortFilmsByDate(films);

      expect(films[0].id).toBe(originalFirst);
    });

    it('should handle empty array', () => {
      const sorted = sortFilmsByDate([]);

      expect(sorted).toEqual([]);
    });

    it('should handle single film', () => {
      const films: Film[] = [
        {
          id: '1',
          title: 'Film 1',
          addedBy: 'user1',
          addedAt: new Date('2024-01-01'),
          status: 'nominated',
        },
      ];

      const sorted = sortFilmsByDate(films);

      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe('1');
    });
  });
});
