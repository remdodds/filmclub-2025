/**
 * Auth API Endpoints
 *
 * Thin Express route handlers using auth business logic
 */

import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { db } from '../utils/db';
import { verifyPassword, createSession, validateSession, isAdminUser } from '../utils/auth';
import { validatePassword as validatePasswordLogic } from '../utils/auth.logic';

/**
 * POST /auth/logout
 * Clear session
 *
 * Headers:
 * Authorization: Bearer <sessionToken>
 *
 * Response:
 * {
 *   success: true
 * }
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No session token provided' });
      return;
    }

    const sessionToken = authHeader.substring(7);

    // Delete session from Firestore
    await db.collection('sessions').doc(sessionToken).delete();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /auth/check
 * Validate current session
 *
 * Headers:
 * Authorization: Bearer <sessionToken>
 *
 * Response:
 * {
 *   valid: true,
 *   visitorId: string
 * }
 */
export async function checkSession(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No session token provided' });
      return;
    }

    const sessionToken = authHeader.substring(7);

    // Validate session
    const visitorId = await validateSession(sessionToken);

    if (!visitorId) {
      res.status(401).json({ valid: false, error: 'Invalid or expired session' });
      return;
    }

    const isAdmin = await isAdminUser(visitorId);
    res.status(200).json({
      valid: true,
      visitorId,
      isAdmin,
    });
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /auth/google
 * Exchange a Firebase ID token (from Google Sign-In) for a session token
 *
 * Request body:
 * {
 *   idToken: string  — Firebase ID token obtained from the client SDK
 * }
 *
 * Response:
 * {
 *   sessionToken: string,
 *   visitorId: string   — the user's stable Google uid
 * }
 */
export async function loginWithGoogle(req: Request, res: Response): Promise<void> {
  try {
    const { idToken, password } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      res.status(400).json({ error: 'idToken is required' });
      return;
    }

    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'password is required' });
      return;
    }

    // Validate password format
    const validation = validatePasswordLogic(password);
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const e2eTestMode = process.env.E2E_TEST_MODE === 'true';

    // Verify club password against stored hash
    const configDoc = await db.collection('config').doc('club').get();
    if (!configDoc.exists) {
      res.status(500).json({ error: 'Club not configured. Please run setup first.' });
      return;
    }

    const config = configDoc.data()!;
    // Skip bcrypt check in E2E test mode. NEVER set E2E_TEST_MODE in production.
    if (!e2eTestMode) {
      const isValidPassword = await verifyPassword(password, config.passwordHash);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid password' });
        return;
      }
    }

    // Verify the Firebase ID token using the Admin SDK
    const decoded = await getAuth().verifyIdToken(idToken);
    const visitorId = decoded.uid; // stable Google user ID

    // Create a Firestore session exactly like the password flow
    const sessionToken = await createSession(visitorId);

    const isAdmin = await isAdminUser(visitorId);
    res.status(200).json({ sessionToken, visitorId, isAdmin });
  } catch (error: any) {
    const code: string = error?.code ?? 'unknown';
    console.error('Google login error [%s]:', code, error?.message ?? error);
    res.status(401).json({ error: 'Invalid or expired Google token', code });
  }
}
