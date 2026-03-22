/**
 * Auth API Endpoint Tests
 */

import { Request, Response } from 'express';
import { login, logout, checkSession, loginWithGoogle } from './auth';

// Mock all dependencies
jest.mock('../utils/db', () => ({ db: { collection: jest.fn() } }));
jest.mock('../utils/auth');
jest.mock('../utils/auth.logic');
jest.mock('uuid', () => ({ v4: jest.fn().mockReturnValue('mock-visitor-id') }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

import { db } from '../utils/db';
import { verifyPassword, createSession, validateSession } from '../utils/auth';
import { validatePassword as validatePasswordLogic } from '../utils/auth.logic';
import { v4 as uuidv4 } from 'uuid';
import { getAuth } from 'firebase-admin/auth';

const mockDb = db as jest.Mocked<typeof db>;
const mockVerifyPassword = verifyPassword as jest.Mock;
const mockCreateSession = createSession as jest.Mock;
const mockValidateSession = validateSession as jest.Mock;
const mockValidatePasswordLogic = validatePasswordLogic as jest.Mock;
const mockUuidv4 = uuidv4 as jest.Mock;
const mockGetAuth = getAuth as jest.Mock;

describe('login', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {
      body: { password: 'testpassword' },
    };
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
    jest.clearAllMocks();
  });

  it('returns 400 with validation error when password fails validation', async () => {
    // Arrange
    mockValidatePasswordLogic.mockReturnValue({ isValid: false, error: 'Password is too short' });

    // Act
    await login(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Password is too short' });
  });

  it('returns 500 when club is not configured (configDoc.exists is false)', async () => {
    // Arrange
    mockValidatePasswordLogic.mockReturnValue({ isValid: true });
    const mockDocGet = jest.fn().mockResolvedValue({ exists: false });
    const mockDoc = jest.fn().mockReturnValue({ get: mockDocGet });
    const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    mockDb.collection = mockCollection;

    // Act
    await login(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Club not configured. Please run setup first.' });
  });

  it('returns 401 when password does not match', async () => {
    // Arrange
    mockValidatePasswordLogic.mockReturnValue({ isValid: true });
    const mockDocGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ passwordHash: 'hashed-password' }),
    });
    const mockDoc = jest.fn().mockReturnValue({ get: mockDocGet });
    const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    mockDb.collection = mockCollection;
    mockVerifyPassword.mockResolvedValue(false);

    // Act
    await login(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid password' });
  });

  it('returns 200 with sessionToken and visitorId on successful login', async () => {
    // Arrange
    mockValidatePasswordLogic.mockReturnValue({ isValid: true });
    const mockDocGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ passwordHash: 'hashed-password' }),
    });
    const mockDoc = jest.fn().mockReturnValue({ get: mockDocGet });
    const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    mockDb.collection = mockCollection;
    mockVerifyPassword.mockResolvedValue(true);
    mockUuidv4.mockReturnValue('visitor-uuid-1234');
    mockCreateSession.mockResolvedValue('session-token-abc');

    // Act
    await login(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockUuidv4).toHaveBeenCalled();
    expect(mockCreateSession).toHaveBeenCalledWith('visitor-uuid-1234');
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      sessionToken: 'session-token-abc',
      visitorId: 'visitor-uuid-1234',
    });
  });

  it('returns 500 on unexpected error', async () => {
    // Arrange
    mockValidatePasswordLogic.mockReturnValue({ isValid: true });
    const mockCollection = jest.fn().mockImplementation(() => {
      throw new Error('Firestore unavailable');
    });
    mockDb.collection = mockCollection;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await login(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

    consoleErrorSpy.mockRestore();
  });
});

describe('logout', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {
      headers: { authorization: 'Bearer valid-session-token' },
    };
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
    jest.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    // Arrange
    mockRequest.headers = {};

    // Act
    await logout(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'No session token provided' });
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    // Arrange
    mockRequest.headers = { authorization: 'Basic sometoken' };

    // Act
    await logout(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'No session token provided' });
  });

  it('extracts token correctly and deletes the session document', async () => {
    // Arrange
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    const mockDoc = jest.fn().mockReturnValue({ delete: mockDelete });
    const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    mockDb.collection = mockCollection;

    // Act
    await logout(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockDb.collection).toHaveBeenCalledWith('sessions');
    expect(mockDoc).toHaveBeenCalledWith('valid-session-token');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('returns 200 success on successful logout', async () => {
    // Arrange
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    const mockDoc = jest.fn().mockReturnValue({ delete: mockDelete });
    const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    mockDb.collection = mockCollection;

    // Act
    await logout(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 on unexpected error', async () => {
    // Arrange
    const mockCollection = jest.fn().mockImplementation(() => {
      throw new Error('Firestore unavailable');
    });
    mockDb.collection = mockCollection;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await logout(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

    consoleErrorSpy.mockRestore();
  });
});

describe('checkSession', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {
      headers: { authorization: 'Bearer valid-session-token' },
    };
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
    jest.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    // Arrange
    mockRequest.headers = {};

    // Act
    await checkSession(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'No session token provided' });
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    // Arrange
    mockRequest.headers = { authorization: 'Token sometoken' };

    // Act
    await checkSession(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'No session token provided' });
  });

  it('returns 401 with valid:false when session is invalid (validateSession returns null)', async () => {
    // Arrange
    mockValidateSession.mockResolvedValue(null);

    // Act
    await checkSession(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockValidateSession).toHaveBeenCalledWith('valid-session-token');
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ valid: false, error: 'Invalid or expired session' });
  });

  it('returns 200 with valid:true and visitorId for a valid session', async () => {
    // Arrange
    mockValidateSession.mockResolvedValue('visitor-uuid-5678');

    // Act
    await checkSession(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockValidateSession).toHaveBeenCalledWith('valid-session-token');
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({ valid: true, visitorId: 'visitor-uuid-5678' });
  });

  it('returns 500 on unexpected error', async () => {
    // Arrange
    mockValidateSession.mockRejectedValue(new Error('Unexpected failure'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await checkSession(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

    consoleErrorSpy.mockRestore();
  });
});

describe('loginWithGoogle', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockVerifyIdToken: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {
      body: { idToken: 'google-id-token' },
    };
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
    mockVerifyIdToken = jest.fn();
    mockGetAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });
    jest.clearAllMocks();
  });

  it('returns 400 when idToken is missing from request body', async () => {
    // Arrange
    mockRequest.body = {};

    // Act
    await loginWithGoogle(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'idToken is required' });
  });

  it('returns 400 when idToken is not a string', async () => {
    // Arrange
    mockRequest.body = { idToken: 12345 };

    // Act
    await loginWithGoogle(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'idToken is required' });
  });

  it('verifies the Firebase ID token and creates a session on success', async () => {
    // Arrange
    mockGetAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });
    mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-abc' });
    mockCreateSession.mockResolvedValue('new-session-token');

    // Act
    await loginWithGoogle(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockGetAuth).toHaveBeenCalled();
    expect(mockVerifyIdToken).toHaveBeenCalledWith('google-id-token');
    expect(mockCreateSession).toHaveBeenCalledWith('firebase-uid-abc');
  });

  it('returns 200 with sessionToken and visitorId (uid from decoded token) on success', async () => {
    // Arrange
    mockGetAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });
    mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-abc' });
    mockCreateSession.mockResolvedValue('new-session-token');

    // Act
    await loginWithGoogle(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      sessionToken: 'new-session-token',
      visitorId: 'firebase-uid-abc',
    });
  });

  it('returns 401 with error code when token verification fails', async () => {
    // Arrange
    const authError = Object.assign(new Error('Token expired'), { code: 'auth/id-token-expired' });
    mockGetAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });
    mockVerifyIdToken.mockRejectedValue(authError);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await loginWithGoogle(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Invalid or expired Google token',
      code: 'auth/id-token-expired',
    });

    consoleErrorSpy.mockRestore();
  });

  it("uses 'unknown' as code when error has no code property", async () => {
    // Arrange
    const plainError = new Error('Something went wrong');
    mockGetAuth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });
    mockVerifyIdToken.mockRejectedValue(plainError);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await loginWithGoogle(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Invalid or expired Google token',
      code: 'unknown',
    });

    consoleErrorSpy.mockRestore();
  });
});
