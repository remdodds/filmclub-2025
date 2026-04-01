/**
 * Express App Tests
 *
 * Tests for the Express application setup including the auth middleware,
 * CORS handling, and route configuration.
 *
 * Firebase SDK exports (onRequest, onSchedule) are mocked since they
 * are framework wiring, not our business logic.
 */

jest.mock('firebase-functions/v2/https', () => ({
  onRequest: jest.fn((...args: any[]) => args.length === 2 ? args[1] : args[0]),
}));
jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: jest.fn((_, handler) => handler),
}));
jest.mock('./tmdb/tmdb', () => ({
  searchFilm: jest.fn().mockResolvedValue(null),
  tmdbApiKey: { value: jest.fn().mockReturnValue('mock-api-key') },
}));
jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('./utils/auth', () => ({ validateSession: jest.fn() }));
jest.mock('./api/auth', () => ({ login: jest.fn(), logout: jest.fn(), checkSession: jest.fn(), loginWithGoogle: jest.fn() }));
jest.mock('./api/films', () => ({ listFilms: jest.fn(), addFilm: jest.fn(), deleteFilm: jest.fn(), getHistory: jest.fn() }));
jest.mock('./api/votes', () => ({ getCurrentVoting: jest.fn(), submitVote: jest.fn(), getLatestResults: jest.fn() }));
jest.mock('./api/config', () => ({ getConfig: jest.fn(), setupClub: jest.fn(), updateVotingSchedule: jest.fn() }));
jest.mock('./api/history', () => ({ getHistory: jest.fn() }));
jest.mock('./api/admin', () => ({ getAdminVotes: jest.fn(), openRound: jest.fn(), selectWinner: jest.fn() }));
jest.mock('./scheduled/openVoting', () => ({ openVotingRound: jest.fn() }));
jest.mock('./scheduled/closeVoting', () => ({ closeVotingRound: jest.fn() }));

import { validateSession } from './utils/auth';
import * as filmsApi from './api/films';
import { openVotingRound } from './scheduled/openVoting';
import { closeVotingRound } from './scheduled/closeVoting';

const mockValidateSession = validateSession as jest.Mock;

let app: any;
let indexModule: any;

beforeAll(async () => {
  indexModule = await import('./index');
  app = indexModule.api;
});

// ---------------------------------------------------------------------------
// Helper — dispatches a fake request through the Express app and resolves
// when the response sends its first json/sendStatus call.
// ---------------------------------------------------------------------------
function dispatch(
  method: string,
  url: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    let capturedStatus = 200;
    let settled = false;

    const settle = (status: number, body: any) => {
      if (!settled) {
        settled = true;
        resolve({ status, body });
      }
    };

    const res: any = {
      // Express / http.ServerResponse methods used internally
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      removeHeader: jest.fn(),
      // Our helpers
      header: jest.fn().mockReturnThis(),
      status: jest.fn().mockImplementation((code: number) => { capturedStatus = code; return res; }),
      json: jest.fn().mockImplementation((body: any) => settle(capturedStatus, body)),
      sendStatus: jest.fn().mockImplementation((code: number) => settle(code, null)),
    };

    const req: any = {
      method,
      url,
      path: url,
      headers,
      body: {},
      query: {},
      params: {},
    };

    app(req, res, () => settle(capturedStatus, null));
  });
}

// ---------------------------------------------------------------------------
// authMiddleware
// ---------------------------------------------------------------------------

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when the Authorization header is missing', async () => {
    // Act
    const { status, body } = await dispatch('GET', '/films');

    // Assert
    expect(status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized. No session token provided.' });
  });

  it('does not call validateSession when Authorization header is missing', async () => {
    // Act
    await dispatch('GET', '/films');

    // Assert
    expect(mockValidateSession).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    // Act
    const { status } = await dispatch('GET', '/films', { authorization: 'Basic abc123' });

    // Assert
    expect(status).toBe(401);
    expect(mockValidateSession).not.toHaveBeenCalled();
  });

  it('calls validateSession with the token extracted from the Bearer header', async () => {
    // Arrange
    mockValidateSession.mockResolvedValue('visitor-123');
    (filmsApi.listFilms as jest.Mock).mockImplementation((_req: any, res: any) => {
      res.status(200).json({ films: [] });
    });

    // Act
    await dispatch('GET', '/films', { authorization: 'Bearer my-session-token' });

    // Assert
    expect(mockValidateSession).toHaveBeenCalledWith('my-session-token');
  });

  it('returns 401 when the session token is invalid or expired', async () => {
    // Arrange
    mockValidateSession.mockResolvedValue(null);

    // Act
    const { status, body } = await dispatch('GET', '/films', { authorization: 'Bearer invalid-token' });

    // Assert
    expect(status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized. Invalid or expired session.' });
  });

  it('returns 500 when validateSession throws an unexpected error', async () => {
    // Arrange
    mockValidateSession.mockRejectedValue(new Error('DB failure'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    const { status, body } = await dispatch('GET', '/films', { authorization: 'Bearer some-token' });

    // Assert
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });

    consoleErrorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// CORS middleware
// ---------------------------------------------------------------------------

describe('CORS middleware', () => {
  it('responds with 200 to OPTIONS preflight requests', async () => {
    // Act
    const { status } = await dispatch('OPTIONS', '/films');

    // Assert — CORS middleware short-circuits before auth
    expect(status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    // Act
    const { status, body } = await dispatch('GET', '/nonexistent-route');

    // Assert
    expect(status).toBe(404);
    expect(body).toEqual({ error: 'Not found' });
  });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns status ok with a timestamp', async () => {
    // Act
    const { status, body } = await dispatch('GET', '/health');

    // Assert
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Test/dev endpoints (POST /test/open-voting, POST /test/close-voting)
// ---------------------------------------------------------------------------

describe('POST /test/open-voting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateSession.mockResolvedValue('visitor-123');
  });

  it('calls openVotingRound and returns success when the round opens successfully', async () => {
    // Arrange
    (openVotingRound as jest.Mock).mockResolvedValue(undefined);

    // Act
    const { status, body } = await dispatch('POST', '/test/open-voting', { authorization: 'Bearer valid-token' });

    // Assert
    expect(openVotingRound).toHaveBeenCalled();
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, message: 'Voting round opened' });
  });

  it('returns 500 with error message when openVotingRound throws', async () => {
    // Arrange
    (openVotingRound as jest.Mock).mockRejectedValue(new Error('Already open'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    const { status, body } = await dispatch('POST', '/test/open-voting', { authorization: 'Bearer valid-token' });

    // Assert
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Already open' });

    consoleErrorSpy.mockRestore();
  });
});

describe('POST /test/close-voting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateSession.mockResolvedValue('visitor-123');
  });

  it('calls closeVotingRound and returns success when the round closes successfully', async () => {
    // Arrange
    (closeVotingRound as jest.Mock).mockResolvedValue(undefined);

    // Act
    const { status, body } = await dispatch('POST', '/test/close-voting', { authorization: 'Bearer valid-token' });

    // Assert
    expect(closeVotingRound).toHaveBeenCalled();
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, message: 'Voting round closed' });
  });

  it('returns 500 with error message when closeVotingRound throws', async () => {
    // Arrange
    (closeVotingRound as jest.Mock).mockRejectedValue(new Error('No open round'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    const { status, body } = await dispatch('POST', '/test/close-voting', { authorization: 'Bearer valid-token' });

    // Assert
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'No open round' });

    consoleErrorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Scheduled function handlers
// ---------------------------------------------------------------------------

describe('openVoting scheduled handler', () => {
  it('calls openVotingRound when the scheduled handler is invoked', async () => {
    // Arrange
    (openVotingRound as jest.Mock).mockResolvedValue(undefined);

    // Act — indexModule.openVoting is the handler function (onSchedule mock returns the handler)
    await indexModule.openVoting();

    // Assert
    expect(openVotingRound).toHaveBeenCalled();
  });
});

describe('closeVoting scheduled handler', () => {
  it('calls closeVotingRound when the scheduled handler is invoked', async () => {
    // Arrange
    (closeVotingRound as jest.Mock).mockResolvedValue(undefined);

    // Act
    await indexModule.closeVoting();

    // Assert
    expect(closeVotingRound).toHaveBeenCalled();
  });
});
