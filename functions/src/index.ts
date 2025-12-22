/**
 * Cloud Functions Entry Point
 *
 * Sets up Express API and exports scheduled functions
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import express, { Request, Response, NextFunction } from 'express';
import { validateSession } from './utils/auth';

// Import API handlers
import * as authApi from './api/auth';
import * as filmsApi from './api/films';
import * as votesApi from './api/votes';
import * as configApi from './api/config';

// Import scheduled functions
import { openVotingRound } from './scheduled/openVoting';
import { closeVotingRound } from './scheduled/closeVoting';

// Create Express app
const app = express();

// Middleware
app.use(express.json());

// CORS middleware (allow all origins for now - restrict in production)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// Auth middleware - validates session token
async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized. No session token provided.' });
      return;
    }

    const sessionToken = authHeader.substring(7);
    const visitorId = await validateSession(sessionToken);

    if (!visitorId) {
      res.status(401).json({ error: 'Unauthorized. Invalid or expired session.' });
      return;
    }

    // Attach visitorId to request for use in handlers
    (req as any).visitorId = visitorId;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Public routes (no auth required)
app.post('/auth/login', authApi.login);
app.get('/config', configApi.getConfig);

// Protected routes (auth required)
app.post('/auth/logout', authMiddleware, authApi.logout);
app.get('/auth/check', authMiddleware, authApi.checkSession);

app.get('/films', authMiddleware, filmsApi.listFilms);
app.post('/films', authMiddleware, filmsApi.addFilm);
app.delete('/films/:id', authMiddleware, filmsApi.deleteFilm);
app.get('/films/history', authMiddleware, filmsApi.getHistory);

app.get('/votes/current', authMiddleware, votesApi.getCurrentVoting);
app.post('/votes', authMiddleware, votesApi.submitVote);
app.get('/votes/results/latest', authMiddleware, votesApi.getLatestResults);

// Config setup is semi-protected - can only be run once
app.post('/config/setup', configApi.setupClub);
app.put('/config/voting-schedule', authMiddleware, configApi.updateVotingSchedule);

// Test/Development endpoints - manually trigger scheduled functions
// Only use these for local testing with emulators
app.post('/test/open-voting', authMiddleware, async (req: Request, res: Response) => {
  try {
    await openVotingRound();
    res.status(200).json({ success: true, message: 'Voting round opened' });
  } catch (error: any) {
    console.error('Test open voting error:', error);
    res.status(500).json({ error: error.message || 'Failed to open voting round' });
  }
});

app.post('/test/close-voting', authMiddleware, async (req: Request, res: Response) => {
  try {
    await closeVotingRound();
    res.status(200).json({ success: true, message: 'Voting round closed' });
  } catch (error: any) {
    console.error('Test close voting error:', error);
    res.status(500).json({ error: error.message || 'Failed to close voting round' });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Export HTTP API
export const api = onRequest(app);

// Export scheduled functions
export const openVoting = onSchedule(
  {
    schedule: '0 18 * * 5', // Every Friday at 6pm (adjust based on config)
    timeZone: 'Europe/London', // Adjust based on club config
  },
  async () => {
    await openVotingRound();
  }
);

export const closeVoting = onSchedule(
  {
    schedule: '0 20 * * 6', // Every Saturday at 8pm (adjust based on config)
    timeZone: 'Europe/London', // Adjust based on club config
  },
  async () => {
    await closeVotingRound();
  }
);
