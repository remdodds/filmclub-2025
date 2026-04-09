/**
 * Auth Integration Layer Tests
 *
 * Tests for hashPassword, verifyPassword, createSession, and validateSession.
 * External dependencies (bcryptjs, uuid, Firestore) are mocked so only our
 * integration logic is exercised.
 */

jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('./db', () => ({ db: { collection: jest.fn() } }));
jest.mock('./auth.logic', () => ({ createSessionData: jest.fn(), isSessionExpired: jest.fn() }));

import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { createSessionData, isSessionExpired } from './auth.logic';
import { hashPassword, verifyPassword, createSession, validateSession, isAdminUser } from './auth';

const mockBcryptHash = bcrypt.hash as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;
const mockUuidv4 = uuidv4 as jest.Mock;
const mockCreateSessionData = createSessionData as jest.Mock;
const mockIsSessionExpired = isSessionExpired as jest.Mock;

describe('hashPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to bcrypt.hash with 10 salt rounds', async () => {
    // Arrange
    mockBcryptHash.mockResolvedValue('hashed-password');

    // Act
    const result = await hashPassword('mypassword');

    // Assert
    expect(mockBcryptHash).toHaveBeenCalledWith('mypassword', 10);
    expect(result).toBe('hashed-password');
  });
});

describe('verifyPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when password matches the hash', async () => {
    // Arrange
    mockBcryptCompare.mockResolvedValue(true);

    // Act
    const result = await verifyPassword('mypassword', 'stored-hash');

    // Assert
    expect(mockBcryptCompare).toHaveBeenCalledWith('mypassword', 'stored-hash');
    expect(result).toBe(true);
  });

  it('returns false when password does not match the hash', async () => {
    // Arrange
    mockBcryptCompare.mockResolvedValue(false);

    // Act
    const result = await verifyPassword('wrongpassword', 'stored-hash');

    // Assert
    expect(result).toBe(false);
  });
});

describe('createSession', () => {
  let mockSet: jest.Mock;
  let mockDoc: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockDoc = jest.fn().mockReturnValue({ set: mockSet });
    (db.collection as jest.Mock).mockReturnValue({ doc: mockDoc });
  });

  it('generates a UUID token for the new session', async () => {
    // Arrange
    mockUuidv4.mockReturnValue('generated-token');
    mockCreateSessionData.mockReturnValue({
      createdAt: new Date('2024-01-01'),
      expiresAt: new Date('2024-01-08'),
      visitorId: 'visitor-1',
    });

    // Act
    await createSession('visitor-1');

    // Assert
    expect(mockUuidv4).toHaveBeenCalled();
  });

  it('saves the session to the sessions collection using the token as document id', async () => {
    // Arrange
    mockUuidv4.mockReturnValue('session-token-abc');
    mockCreateSessionData.mockReturnValue({
      createdAt: new Date('2024-01-01'),
      expiresAt: new Date('2024-01-08'),
      visitorId: 'visitor-1',
    });

    // Act
    await createSession('visitor-1');

    // Assert
    expect(db.collection).toHaveBeenCalledWith('sessions');
    expect(mockDoc).toHaveBeenCalledWith('session-token-abc');
  });

  it('stores createdAt, expiresAt, and visitorId in the session document', async () => {
    // Arrange
    const createdAt = new Date('2024-01-01');
    const expiresAt = new Date('2024-01-08');
    mockUuidv4.mockReturnValue('session-token-abc');
    mockCreateSessionData.mockReturnValue({ createdAt, expiresAt, visitorId: 'visitor-1' });

    // Act
    await createSession('visitor-1');

    // Assert
    expect(mockSet).toHaveBeenCalledWith({ createdAt, expiresAt, visitorId: 'visitor-1' });
  });

  it('returns the generated token', async () => {
    // Arrange
    mockUuidv4.mockReturnValue('my-session-token');
    mockCreateSessionData.mockReturnValue({
      createdAt: new Date(),
      expiresAt: new Date(),
      visitorId: 'visitor-1',
    });

    // Act
    const result = await createSession('visitor-1');

    // Assert
    expect(result).toBe('my-session-token');
  });
});

describe('isAdminUser', () => {
  let mockGet: jest.Mock;
  let mockDoc: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet = jest.fn();
    mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    (db.collection as jest.Mock).mockReturnValue({ doc: mockDoc });
  });

  it('returns true when the admins document exists for the given uid', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: true });

    // Act
    const result = await isAdminUser('admin-uid-123');

    // Assert
    expect(db.collection).toHaveBeenCalledWith('admins');
    expect(mockDoc).toHaveBeenCalledWith('admin-uid-123');
    expect(result).toBe(true);
  });

  it('returns false when the admins document does not exist for the given uid', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });

    // Act
    const result = await isAdminUser('non-admin-uid');

    // Assert
    expect(result).toBe(false);
  });
});

describe('validateSession', () => {
  let mockGet: jest.Mock;
  let mockDoc: jest.Mock;
  let mockDelete: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDelete = jest.fn().mockResolvedValue(undefined);
    mockGet = jest.fn();
    mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    (db.collection as jest.Mock).mockReturnValue({ doc: mockDoc });
  });

  it('returns null when the session document does not exist', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });

    // Act
    const result = await validateSession('unknown-token');

    // Assert
    expect(result).toBeNull();
  });

  it('returns null and deletes the document when the session has expired', async () => {
    // Arrange
    const expiredAt = new Date('2020-01-01');
    const mockRef = { delete: mockDelete };
    mockGet.mockResolvedValue({
      exists: true,
      ref: mockRef,
      data: () => ({
        expiresAt: { toDate: () => expiredAt },
        visitorId: 'visitor-1',
      }),
    });
    mockIsSessionExpired.mockReturnValue(true);

    // Act
    const result = await validateSession('expired-token');

    // Assert
    expect(mockIsSessionExpired).toHaveBeenCalledWith(expiredAt);
    expect(mockDelete).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('returns the visitorId when the session is valid and not expired', async () => {
    // Arrange
    const expiresAt = new Date('2099-01-01');
    mockGet.mockResolvedValue({
      exists: true,
      ref: { delete: mockDelete },
      data: () => ({
        expiresAt: { toDate: () => expiresAt },
        visitorId: 'visitor-42',
      }),
    });
    mockIsSessionExpired.mockReturnValue(false);

    // Act
    const result = await validateSession('valid-token');

    // Assert
    expect(mockDelete).not.toHaveBeenCalled();
    expect(result).toBe('visitor-42');
  });

  it('looks up the session by the provided token in the sessions collection', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });

    // Act
    await validateSession('my-token');

    // Assert
    expect(db.collection).toHaveBeenCalledWith('sessions');
    expect(mockDoc).toHaveBeenCalledWith('my-token');
  });
});
