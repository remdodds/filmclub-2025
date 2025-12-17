import { describe, it, expect } from '@jest/globals';
import {
  SESSION_DURATION_MS,
  calculateSessionExpiry,
  isSessionExpired,
  validatePassword,
  createSessionData,
  isValidVisitorId,
  isValidSessionToken,
} from './auth.logic';

describe('Auth Business Logic', () => {
  describe('calculateSessionExpiry', () => {
    it('should add 7 days to creation date', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const expiresAt = calculateSessionExpiry(createdAt);

      expect(expiresAt.getTime() - createdAt.getTime()).toBe(SESSION_DURATION_MS);
    });

    it('should handle different creation dates', () => {
      const createdAt = new Date('2024-06-15T14:30:00Z');
      const expiresAt = calculateSessionExpiry(createdAt);

      const expectedExpiry = new Date('2024-06-22T14:30:00Z');
      expect(expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });

    it('should return exactly 7 days worth of milliseconds', () => {
      const createdAt = new Date();
      const expiresAt = calculateSessionExpiry(createdAt);

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime() - createdAt.getTime()).toBe(sevenDaysMs);
    });
  });

  describe('isSessionExpired', () => {
    it('should return true if session has expired', () => {
      const expiresAt = new Date('2024-01-01T00:00:00Z');
      const currentTime = new Date('2024-01-02T00:00:00Z');

      expect(isSessionExpired(expiresAt, currentTime)).toBe(true);
    });

    it('should return false if session has not expired', () => {
      const expiresAt = new Date('2024-01-02T00:00:00Z');
      const currentTime = new Date('2024-01-01T00:00:00Z');

      expect(isSessionExpired(expiresAt, currentTime)).toBe(false);
    });

    it('should return true if expiry is exactly current time', () => {
      const time = new Date('2024-01-01T12:00:00Z');

      expect(isSessionExpired(time, time)).toBe(false);
    });

    it('should use current time by default', () => {
      const pastExpiry = new Date(Date.now() - 1000); // 1 second ago
      expect(isSessionExpired(pastExpiry)).toBe(true);

      const futureExpiry = new Date(Date.now() + 1000); // 1 second from now
      expect(isSessionExpired(futureExpiry)).toBe(false);
    });

    it('should handle edge case: 1ms expired', () => {
      const expiresAt = new Date('2024-01-01T00:00:00.000Z');
      const currentTime = new Date('2024-01-01T00:00:00.001Z');

      expect(isSessionExpired(expiresAt, currentTime)).toBe(true);
    });

    it('should handle edge case: 1ms not expired', () => {
      const expiresAt = new Date('2024-01-01T00:00:00.001Z');
      const currentTime = new Date('2024-01-01T00:00:00.000Z');

      expect(isSessionExpired(expiresAt, currentTime)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept valid password', () => {
      const result = validatePassword('securepassword123');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept password with exactly 8 characters', () => {
      const result = validatePassword('12345678');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty password', () => {
      const result = validatePassword('');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password is required');
    });

    it('should reject password with less than 8 characters', () => {
      const result = validatePassword('1234567');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters');
    });

    it('should reject password with 7 characters', () => {
      const result = validatePassword('short!!');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters');
    });

    it('should accept long password', () => {
      const longPassword = 'a'.repeat(100);
      const result = validatePassword(longPassword);

      expect(result.isValid).toBe(true);
    });

    it('should accept password with special characters', () => {
      const result = validatePassword('p@ssw0rd!#$%');

      expect(result.isValid).toBe(true);
    });

    it('should accept password with spaces', () => {
      const result = validatePassword('pass word 123');

      expect(result.isValid).toBe(true);
    });
  });

  describe('createSessionData', () => {
    it('should create session data with correct structure', () => {
      const visitorId = '123e4567-e89b-12d3-a456-426614174000';
      const createdAt = new Date('2024-01-01T00:00:00Z');

      const sessionData = createSessionData(visitorId, createdAt);

      expect(sessionData.visitorId).toBe(visitorId);
      expect(sessionData.createdAt).toBe(createdAt);
      expect(sessionData.expiresAt).toEqual(calculateSessionExpiry(createdAt));
    });

    it('should use current time by default', () => {
      const visitorId = '123e4567-e89b-12d3-a456-426614174000';
      const beforeCall = Date.now();

      const sessionData = createSessionData(visitorId);

      const afterCall = Date.now();

      expect(sessionData.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCall);
      expect(sessionData.createdAt.getTime()).toBeLessThanOrEqual(afterCall);
    });

    it('should set expiry to 7 days after creation', () => {
      const visitorId = '123e4567-e89b-12d3-a456-426614174000';
      const createdAt = new Date('2024-01-01T00:00:00Z');

      const sessionData = createSessionData(visitorId, createdAt);

      const expectedExpiry = new Date('2024-01-08T00:00:00Z');
      expect(sessionData.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });
  });

  describe('isValidVisitorId', () => {
    it('should accept valid UUID v4', () => {
      const validUuids = [
        '123e4567-e89b-42d3-a456-426614174000',
        'a1b2c3d4-e5f6-4789-a012-123456789abc',
        '00000000-0000-4000-8000-000000000000',
        'ffffffff-ffff-4fff-afff-ffffffffffff',
      ];

      validUuids.forEach((uuid) => {
        expect(isValidVisitorId(uuid)).toBe(true);
      });
    });

    it('should reject invalid UUID formats', () => {
      const invalidUuids = [
        '',
        'not-a-uuid',
        '123e4567-e89b-12d3-a456', // too short
        '123e4567-e89b-12d3-a456-426614174000-extra', // too long
        '123e4567-e89b-12d3-a456-42661417400g', // invalid character
        '123e4567e89b12d3a456426614174000', // missing hyphens
        '123e4567-e89b-22d3-a456-426614174000', // wrong version (not v4)
      ];

      invalidUuids.forEach((uuid) => {
        expect(isValidVisitorId(uuid)).toBe(false);
      });
    });

    it('should be case-insensitive', () => {
      const uuid = '123E4567-E89B-42D3-A456-426614174000';
      expect(isValidVisitorId(uuid)).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(isValidVisitorId(null as any)).toBe(false);
      expect(isValidVisitorId(undefined as any)).toBe(false);
    });
  });

  describe('isValidSessionToken', () => {
    it('should validate session tokens (UUID v4 format)', () => {
      const validToken = '123e4567-e89b-42d3-a456-426614174000';
      expect(isValidSessionToken(validToken)).toBe(true);
    });

    it('should reject invalid token formats', () => {
      expect(isValidSessionToken('invalid')).toBe(false);
      expect(isValidSessionToken('')).toBe(false);
    });

    it('should use same validation as visitor ID', () => {
      const token = '123e4567-e89b-42d3-a456-426614174000';
      expect(isValidSessionToken(token)).toBe(isValidVisitorId(token));
    });
  });
});
