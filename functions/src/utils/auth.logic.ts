/**
 * Auth Business Logic (Pure Functions)
 *
 * This module contains the core business logic for authentication.
 * All functions are pure and easily testable without mocking.
 */

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Calculate session expiration date
 * @param createdAt - Session creation timestamp
 * @returns Expiration date
 */
export function calculateSessionExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SESSION_DURATION_MS);
}

/**
 * Check if a session has expired
 * @param expiresAt - Session expiration date
 * @param currentTime - Current time (defaults to now)
 * @returns True if session has expired
 */
export function isSessionExpired(expiresAt: Date, currentTime: Date = new Date()): boolean {
  return expiresAt < currentTime;
}

/**
 * Validate password meets minimum requirements
 * @param password - Password to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password || password.length === 0) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  // Password is valid
  return { isValid: true };
}

/**
 * Session data structure
 */
export interface SessionData {
  visitorId: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Create session data object
 * @param visitorId - Unique visitor identifier
 * @param token - Session token
 * @param createdAt - Creation timestamp (defaults to now)
 * @returns Session data object
 */
export function createSessionData(
  visitorId: string,
  createdAt: Date = new Date()
): SessionData {
  return {
    visitorId,
    createdAt,
    expiresAt: calculateSessionExpiry(createdAt),
  };
}

/**
 * Validate visitor ID format
 * @param visitorId - Visitor ID to validate
 * @returns True if valid UUID format
 */
export function isValidVisitorId(visitorId: string): boolean {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(visitorId);
}

/**
 * Check if a session token format is valid
 * @param token - Token to validate
 * @returns True if valid UUID format
 */
export function isValidSessionToken(token: string): boolean {
  return isValidVisitorId(token); // Same format (UUID v4)
}
