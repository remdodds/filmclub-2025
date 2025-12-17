/**
 * Auth API Endpoints
 *
 * Thin Express route handlers using auth business logic
 */

import { Request, Response } from 'express';
import { db } from '../utils/db';
import { verifyPassword, createSession, validateSession } from '../utils/auth';
import { validatePassword as validatePasswordLogic } from '../utils/auth.logic';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /auth/login
 * Verify password and create session
 *
 * Request body:
 * {
 *   password: string
 * }
 *
 * Response:
 * {
 *   sessionToken: string,
 *   visitorId: string
 * }
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { password } = req.body;

    // Validate password format
    const validation = validatePasswordLogic(password);
    if (!validation.isValid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    // Get club config with password hash
    const configDoc = await db.collection('config').doc('club').get();
    if (!configDoc.exists) {
      res.status(500).json({ error: 'Club not configured. Please run setup first.' });
      return;
    }

    const config = configDoc.data()!;
    const passwordHash = config.passwordHash;

    // Verify password
    const isValid = await verifyPassword(password, passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    // Create or retrieve visitor ID
    // For now, generate a new visitor ID each time
    // In production, you might want to track this via cookies/localStorage
    const visitorId = uuidv4();

    // Create session
    const sessionToken = await createSession(visitorId);

    res.status(200).json({
      sessionToken,
      visitorId,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

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

    res.status(200).json({
      valid: true,
      visitorId,
    });
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
