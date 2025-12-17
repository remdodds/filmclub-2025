/**
 * Auth Integration Layer
 *
 * This module provides integration with bcrypt and Firestore.
 * Business logic is in auth.logic.ts
 */

import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { createSessionData, isSessionExpired } from './auth.logic';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcryptjs
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Hashed password to compare against
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new session for a visitor
 * @param visitorId - Unique visitor identifier
 * @returns Session token
 */
export async function createSession(visitorId: string): Promise<string> {
  const token = uuidv4();
  const sessionData = createSessionData(visitorId);

  await db.collection('sessions').doc(token).set({
    createdAt: sessionData.createdAt,
    expiresAt: sessionData.expiresAt,
    visitorId: sessionData.visitorId,
  });

  return token;
}

/**
 * Validate a session token and return the visitor ID if valid
 * @param token - Session token to validate
 * @returns Visitor ID if valid, null if invalid or expired
 */
export async function validateSession(token: string): Promise<string | null> {
  const doc = await db.collection('sessions').doc(token).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  const expiresAt = data.expiresAt.toDate();

  if (isSessionExpired(expiresAt)) {
    // Session expired, delete it
    await doc.ref.delete();
    return null;
  }

  return data.visitorId;
}
