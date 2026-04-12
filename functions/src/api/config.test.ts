/**
 * Config API Endpoint Tests
 */

import { Request, Response } from 'express';
import { setupClub, getConfig, updateVotingSchedule, changePassword, updateClubName } from './config';

// Mock all dependencies
jest.mock('../utils/db', () => ({ db: { collection: jest.fn() } }));
jest.mock('../utils/auth', () => ({ hashPassword: jest.fn(), verifyPassword: jest.fn() }));
jest.mock('../utils/auth.logic', () => ({ validatePassword: jest.fn() }));

import { db } from '../utils/db';
import { hashPassword, verifyPassword } from '../utils/auth';
import { validatePassword } from '../utils/auth.logic';

const mockDb = db as jest.Mocked<typeof db>;
const mockHashPassword = hashPassword as jest.Mock;
const mockVerifyPassword = verifyPassword as jest.Mock;
const mockValidatePassword = validatePassword as jest.Mock;

describe('setupClub', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockDoc: jest.Mock;
  let mockCollection: jest.Mock;

  const validBody = {
    clubName: 'Test Film Club',
    password: 'SecurePass123!',
    timezone: 'America/New_York',
    votingSchedule: {
      openDay: 1,
      closeDay: 5,
      openTime: '18:00',
      closeTime: '23:59',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockResponse = { status: mockStatus, json: mockJson };

    mockGet = jest.fn();
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockDoc = jest.fn().mockReturnValue({ get: mockGet, set: mockSet });
    mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    (mockDb.collection as jest.Mock).mockImplementation(mockCollection);

    mockHashPassword.mockResolvedValue('hashed_password');
    mockValidatePassword.mockReturnValue({ isValid: true });
  });

  it('returns 409 when club is already configured (configDoc.exists = true)', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: true });
    mockRequest = { body: validBody };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(409);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Club is already configured. Setup can only be run once.' });
  });

  it('returns 400 when clubName is missing', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = { body: { ...validBody, clubName: undefined } };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required fields: clubName, password, timezone, votingSchedule' });
  });

  it('returns 400 when password is missing', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = { body: { ...validBody, password: undefined } };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required fields: clubName, password, timezone, votingSchedule' });
  });

  it('returns 400 when timezone is missing', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = { body: { ...validBody, timezone: undefined } };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required fields: clubName, password, timezone, votingSchedule' });
  });

  it('returns 400 when votingSchedule is missing', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = { body: { ...validBody, votingSchedule: undefined } };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required fields: clubName, password, timezone, votingSchedule' });
  });

  it('returns 400 when password fails validation', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockValidatePassword.mockReturnValue({ isValid: false, error: 'Password must be at least 8 characters' });
    mockRequest = { body: validBody };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Password must be at least 8 characters' });
  });

  it('returns 400 when openDay is out of range (e.g., 7)', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = {
      body: {
        ...validBody,
        votingSchedule: { ...validBody.votingSchedule, openDay: 7 },
      },
    };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid voting schedule days. Must be 0-6 (Sunday-Saturday)' });
  });

  it('returns 400 when closeDay is out of range (e.g., -1)', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = {
      body: {
        ...validBody,
        votingSchedule: { ...validBody.votingSchedule, closeDay: -1 },
      },
    };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid voting schedule days. Must be 0-6 (Sunday-Saturday)' });
  });

  it('returns 400 when openDay is not a number', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = {
      body: {
        ...validBody,
        votingSchedule: { ...validBody.votingSchedule, openDay: 'monday' },
      },
    };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid voting schedule days. Must be 0-6 (Sunday-Saturday)' });
  });

  it('returns 400 when openTime has invalid format (e.g., "25:00")', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = {
      body: {
        ...validBody,
        votingSchedule: { ...validBody.votingSchedule, openTime: '25:00' },
      },
    };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid time format. Use HH:mm (e.g., "18:00")' });
  });

  it('returns 400 when closeTime has invalid format (e.g., "not-a-time")', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = {
      body: {
        ...validBody,
        votingSchedule: { ...validBody.votingSchedule, closeTime: 'not-a-time' },
      },
    };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid time format. Use HH:mm (e.g., "18:00")' });
  });

  it('hashes the password before saving', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = { body: validBody };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockHashPassword).toHaveBeenCalledWith(validBody.password);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed_password' })
    );
  });

  it('saves config to Firestore and returns 201 with config on success', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = { body: validBody };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        clubName: validBody.clubName,
        timezone: validBody.timezone,
        votingSchedule: validBody.votingSchedule,
        passwordHash: 'hashed_password',
        createdAt: expect.any(Date),
      })
    );
    expect(mockStatus).toHaveBeenCalledWith(201);
    expect(mockJson).toHaveBeenCalledWith({
      success: true,
      config: {
        clubName: validBody.clubName,
        timezone: validBody.timezone,
        votingSchedule: validBody.votingSchedule,
      },
    });
  });

  it('does NOT include passwordHash in the response config', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = { body: validBody };

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    const responseArg = mockJson.mock.calls[0][0];
    expect(responseArg.config).not.toHaveProperty('passwordHash');
  });

  it('returns 500 on unexpected error', async () => {
    // Arrange
    mockGet.mockRejectedValue(new Error('Firestore unavailable'));
    mockRequest = { body: validBody };
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await setupClub(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

    consoleErrorSpy.mockRestore();
  });
});

describe('getConfig', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGet: jest.Mock;
  let mockDoc: jest.Mock;
  let mockCollection: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockResponse = { status: mockStatus, json: mockJson };
    mockRequest = {};

    mockGet = jest.fn();
    mockDoc = jest.fn().mockReturnValue({ get: mockGet });
    mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    (mockDb.collection as jest.Mock).mockImplementation(mockCollection);
  });

  it('returns config:null when club is not configured', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });

    // Act
    await getConfig(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({ config: null });
  });

  it('returns the club config (without passwordHash) when configured', async () => {
    // Arrange
    const storedData = {
      clubName: 'Test Film Club',
      timezone: 'Europe/London',
      votingSchedule: { openDay: 2, closeDay: 6, openTime: '19:00', closeTime: '22:00' },
      passwordHash: 'should_not_appear',
      createdAt: new Date(),
    };
    mockGet.mockResolvedValue({ exists: true, data: () => storedData });

    // Act
    await getConfig(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      config: {
        clubName: storedData.clubName,
        timezone: storedData.timezone,
        votingSchedule: storedData.votingSchedule,
      },
    });
    const responseArg = mockJson.mock.calls[0][0];
    expect(responseArg.config).not.toHaveProperty('passwordHash');
  });

  it('returns 500 on unexpected error', async () => {
    // Arrange
    mockGet.mockRejectedValue(new Error('Firestore unavailable'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await getConfig(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

    consoleErrorSpy.mockRestore();
  });
});

describe('updateVotingSchedule', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGet: jest.Mock;
  let mockUpdate: jest.Mock;
  let mockDoc: jest.Mock;
  let mockCollection: jest.Mock;

  const validSchedule = {
    openDay: 1,
    closeDay: 5,
    openTime: '18:00',
    closeTime: '23:59',
  };

  const storedData = {
    clubName: 'Test Film Club',
    timezone: 'America/Chicago',
    votingSchedule: validSchedule,
    passwordHash: 'hashed_password',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockResponse = { status: mockStatus, json: mockJson };

    mockGet = jest.fn();
    mockUpdate = jest.fn().mockResolvedValue(undefined);
    mockDoc = jest.fn().mockReturnValue({ get: mockGet, update: mockUpdate });
    mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    (mockDb.collection as jest.Mock).mockImplementation(mockCollection);
  });

  it('returns 404 when club is not configured', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = { body: { votingSchedule: validSchedule } };

    // Act
    await updateVotingSchedule(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Club not configured. Run setup first.' });
  });

  it('returns 400 when votingSchedule is missing from body', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: true });
    mockRequest = { body: {} };

    // Act
    await updateVotingSchedule(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required field: votingSchedule' });
  });

  it('returns 400 when openDay is out of range', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: true });
    mockRequest = {
      body: {
        votingSchedule: { ...validSchedule, openDay: 8 },
      },
    };

    // Act
    await updateVotingSchedule(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid voting schedule days. Must be 0-6 (Sunday-Saturday)' });
  });

  it('returns 400 when time format is invalid', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: true });
    mockRequest = {
      body: {
        votingSchedule: { ...validSchedule, openTime: '9:00' },
      },
    };

    // Act
    await updateVotingSchedule(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid time format. Use HH:mm (e.g., "18:00")' });
  });

  it('updates the schedule and returns the full updated config on success', async () => {
    // Arrange
    const updatedSchedule = { openDay: 3, closeDay: 6, openTime: '17:00', closeTime: '21:30' };
    const updatedData = { ...storedData, votingSchedule: updatedSchedule };

    mockGet
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: true, data: () => updatedData });

    mockRequest = { body: { votingSchedule: updatedSchedule } };

    // Act
    await updateVotingSchedule(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockUpdate).toHaveBeenCalledWith({
      votingSchedule: updatedSchedule,
      updatedAt: expect.any(Date),
    });
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      success: true,
      config: {
        clubName: storedData.clubName,
        timezone: storedData.timezone,
        votingSchedule: updatedSchedule,
      },
    });
  });

  it('returns 500 on unexpected error', async () => {
    // Arrange
    mockGet.mockRejectedValue(new Error('Firestore unavailable'));
    mockRequest = { body: { votingSchedule: validSchedule } };
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await updateVotingSchedule(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

    consoleErrorSpy.mockRestore();
  });
});

describe('changePassword', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGet: jest.Mock;
  let mockUpdate: jest.Mock;
  let mockDoc: jest.Mock;
  let mockCollection: jest.Mock;

  const storedData = {
    clubName: 'Test Film Club',
    timezone: 'Europe/London',
    votingSchedule: { openDay: 1, closeDay: 5, openTime: '18:00', closeTime: '23:59' },
    passwordHash: 'existing_hash',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockResponse = { status: mockStatus, json: mockJson };

    mockUpdate = jest.fn().mockResolvedValue(undefined);
    mockGet = jest.fn();
    mockDoc = jest.fn().mockReturnValue({ get: mockGet, update: mockUpdate });
    mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    (mockDb.collection as jest.Mock).mockImplementation(mockCollection);

    mockHashPassword.mockResolvedValue('new_hashed_password');
    mockVerifyPassword.mockResolvedValue(true);
    mockValidatePassword.mockReturnValue({ isValid: true });
  });

  it('returns 400 when currentPassword is missing', async () => {
    // Arrange
    mockRequest = { body: { newPassword: 'NewPass123!' } };

    // Act
    await changePassword(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required fields: currentPassword, newPassword' });
  });

  it('returns 400 when newPassword is missing', async () => {
    // Arrange
    mockRequest = { body: { currentPassword: 'OldPass123!' } };

    // Act
    await changePassword(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required fields: currentPassword, newPassword' });
  });

  it('returns 404 when club is not configured', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = { body: { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' } };

    // Act
    await changePassword(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Club not configured.' });
  });

  it('returns 401 when current password is incorrect', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: true, data: () => storedData });
    mockVerifyPassword.mockResolvedValue(false);
    mockRequest = { body: { currentPassword: 'WrongPass!', newPassword: 'NewPass123!' } };

    // Act
    await changePassword(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockVerifyPassword).toHaveBeenCalledWith('WrongPass!', storedData.passwordHash);
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Current password is incorrect.' });
  });

  it('returns 400 when new password fails validation', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: true, data: () => storedData });
    mockValidatePassword.mockReturnValue({ isValid: false, error: 'Password must be at least 8 characters' });
    mockRequest = { body: { currentPassword: 'OldPass123!', newPassword: 'short' } };

    // Act
    await changePassword(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Password must be at least 8 characters' });
  });

  it('hashes the new password and updates Firestore on success', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: true, data: () => storedData });
    mockRequest = { body: { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' } };

    // Act
    await changePassword(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockHashPassword).toHaveBeenCalledWith('NewPass123!');
    expect(mockUpdate).toHaveBeenCalledWith({
      passwordHash: 'new_hashed_password',
      updatedAt: expect.any(Date),
    });
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 on unexpected error', async () => {
    // Arrange
    mockGet.mockRejectedValue(new Error('Firestore unavailable'));
    mockRequest = { body: { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' } };
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await changePassword(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

    consoleErrorSpy.mockRestore();
  });
});

describe('updateClubName', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGet: jest.Mock;
  let mockUpdate: jest.Mock;
  let mockDoc: jest.Mock;
  let mockCollection: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockResponse = { status: mockStatus, json: mockJson };

    mockUpdate = jest.fn().mockResolvedValue(undefined);
    mockGet = jest.fn();
    mockDoc = jest.fn().mockReturnValue({ get: mockGet, update: mockUpdate });
    mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
    (mockDb.collection as jest.Mock).mockImplementation(mockCollection);
  });

  it('returns 400 when clubName is missing from body', async () => {
    // Arrange
    mockRequest = { body: {} };

    // Act
    await updateClubName(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required field: clubName' });
  });

  it('returns 400 when clubName is an empty string', async () => {
    // Arrange
    mockRequest = { body: { clubName: '   ' } };

    // Act
    await updateClubName(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required field: clubName' });
  });

  it('returns 404 when club is not configured', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: false });
    mockRequest = { body: { clubName: 'New Club Name' } };

    // Act
    await updateClubName(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Club not configured.' });
  });

  it('returns 200 with success and trimmed clubName on success', async () => {
    // Arrange
    mockGet.mockResolvedValue({ exists: true });
    mockRequest = { body: { clubName: '  My New Club  ' } };

    // Act
    await updateClubName(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockUpdate).toHaveBeenCalledWith({
      clubName: 'My New Club',
      updatedAt: expect.any(Date),
    });
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({ success: true, clubName: 'My New Club' });
  });

  it('returns 500 on unexpected error', async () => {
    // Arrange
    mockGet.mockRejectedValue(new Error('Firestore unavailable'));
    mockRequest = { body: { clubName: 'Test Club' } };
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await updateClubName(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

    consoleErrorSpy.mockRestore();
  });
});
