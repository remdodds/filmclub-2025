/**
 * Film Nomination Business Logic
 *
 * Pure business logic for film management
 */

/**
 * Film data structure
 */
export interface Film {
  id: string;
  title: string;
  addedBy: string;
  addedAt: Date;
  status: 'nominated' | 'watched';
  watchedAt?: Date;
}

/**
 * Normalize film title for comparison (remove extra spaces, lowercase, trim)
 * @param title - Film title to normalize
 * @returns Normalized title
 */
export function normalizeFilmTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

/**
 * Check if two film titles are duplicates (fuzzy match)
 * @param title1 - First title
 * @param title2 - Second title
 * @returns True if titles are considered duplicates
 */
export function areTitlesDuplicate(title1: string, title2: string): boolean {
  const normalized1 = normalizeFilmTitle(title1);
  const normalized2 = normalizeFilmTitle(title2);

  return normalized1 === normalized2;
}

/**
 * Validate film title meets requirements
 * @param title - Film title to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateFilmTitle(title: string): { isValid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { isValid: false, error: 'Film title is required' };
  }

  if (title.trim().length < 1) {
    return { isValid: false, error: 'Film title must be at least 1 character' };
  }

  if (title.length > 200) {
    return { isValid: false, error: 'Film title must be less than 200 characters' };
  }

  return { isValid: true };
}

/**
 * Find duplicate film in a list
 * @param title - Title to check
 * @param existingFilms - List of existing films
 * @returns Duplicate film if found, null otherwise
 */
export function findDuplicate(title: string, existingFilms: Film[]): Film | null {
  return (
    existingFilms.find((film) => areTitlesDuplicate(film.title, title)) || null
  );
}

/**
 * Check if a film can be nominated (not already nominated or recently watched)
 * @param title - Film title
 * @param nominatedFilms - Currently nominated films
 * @param watchedFilms - Recently watched films
 * @returns Object with canNominate flag and reason if not
 */
export function canNominateFilm(
  title: string,
  nominatedFilms: Film[],
  watchedFilms: Film[] = []
): { canNominate: boolean; reason?: string } {
  // Check if already nominated
  const alreadyNominated = findDuplicate(title, nominatedFilms);
  if (alreadyNominated) {
    return {
      canNominate: false,
      reason: `"${alreadyNominated.title}" is already nominated`,
    };
  }

  // Check if recently watched
  const recentlyWatched = findDuplicate(title, watchedFilms);
  if (recentlyWatched) {
    return {
      canNominate: false,
      reason: `"${recentlyWatched.title}" was already watched`,
    };
  }

  return { canNominate: true };
}

/**
 * Create a new film nomination
 * @param title - Film title
 * @param addedBy - Visitor ID who added the film
 * @param id - Optional film ID (will be generated if not provided)
 * @param addedAt - Optional timestamp (defaults to now)
 * @returns Film object
 */
export function createFilmNomination(
  title: string,
  addedBy: string,
  id?: string,
  addedAt: Date = new Date()
): Film {
  return {
    id: id || `film-${Date.now()}`, // Simple ID generation (UUID would be better in production)
    title: title.trim(),
    addedBy,
    addedAt,
    status: 'nominated',
  };
}

/**
 * Mark a film as watched
 * @param film - Film to mark as watched
 * @param watchedAt - When it was watched (defaults to now)
 * @returns Updated film object
 */
export function markFilmAsWatched(film: Film, watchedAt: Date = new Date()): Film {
  return {
    ...film,
    status: 'watched',
    watchedAt,
  };
}

/**
 * Sort films by most recent first
 * @param films - Films to sort
 * @returns Sorted films (most recent first)
 */
export function sortFilmsByDate(films: Film[]): Film[] {
  return [...films].sort((a, b) => {
    const dateA = a.watchedAt || a.addedAt;
    const dateB = b.watchedAt || b.addedAt;
    return dateB.getTime() - dateA.getTime();
  });
}
