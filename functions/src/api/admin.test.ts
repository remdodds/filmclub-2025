/**
 * Admin API Endpoint Tests
 */

import { Request, Response } from 'express';
import { getAdminVotes, openRound, selectWinner } from './admin';
import * as closeVotingModule from '../scheduled/closeVoting';
import * as openVotingModule from '../scheduled/openVoting';

// Mock all external dependencies
jest.mock('../utils/db', () => ({
  db: {
    collection: jest.fn(),
  },
}));
jest.mock('../scheduled/closeVoting');
jest.mock('../scheduled/openVoting');

import { db } from '../utils/db';

describe('GET /admin/votes - getAdminVotes', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {};
    mockResponse = { status: mockStatus, json: mockJson };
    jest.clearAllMocks();
  });

  it('should return isOpen:false with empty data when no round is open', async () => {
    // Arrange
    const mockGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere });

    // Act
    await getAdminVotes(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      isOpen: false,
      votingRound: null,
      candidates: [],
      ballots: [],
      totalBallots: 0,
    });
  });

  it('should return round info, candidates, and ballots when a round is open', async () => {
    // Arrange
    const openedAt = new Date('2026-03-01T10:00:00Z');
    const closesAt = new Date('2026-03-08T10:00:00Z');
    const submittedAt = new Date('2026-03-02T12:00:00Z');

    const mockRoundDoc = {
      id: 'round-1',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: jest.fn().mockReturnValue(openedAt) },
        closesAt: { toDate: jest.fn().mockReturnValue(closesAt) },
      }),
    };

    const mockFilmDoc1 = {
      id: 'film-1',
      data: jest.fn().mockReturnValue({ title: 'The Matrix', addedBy: 'visitor-1' }),
    };
    const mockFilmDoc2 = {
      id: 'film-2',
      data: jest.fn().mockReturnValue({ title: 'Inception', addedBy: 'visitor-2' }),
    };

    const mockBallotDoc = {
      data: jest.fn().mockReturnValue({
        visitorId: 'visitor-1',
        votes: { 'film-1': 1, 'film-2': 2 },
        submittedAt: { toDate: jest.fn().mockReturnValue(submittedAt) },
      }),
    };

    const mockBallotsGet = jest.fn().mockResolvedValue({ docs: [mockBallotDoc] });
    const mockBallotsCollection = jest.fn().mockReturnValue({ get: mockBallotsGet });
    const mockDoc = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockRoundsLimit, get: mockRoundsGet });

    const mockFilmsGet = jest.fn().mockResolvedValue({ docs: [mockFilmDoc1, mockFilmDoc2] });
    const mockFilmsWhere = jest.fn().mockReturnValue({ get: mockFilmsGet });

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return { where: mockRoundsWhere, doc: mockDoc };
      }
      if (collectionName === 'films') {
        return { where: mockFilmsWhere };
      }
      return {};
    });

    // Act
    await getAdminVotes(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      isOpen: true,
      votingRound: { id: 'round-1', openedAt, closesAt },
      candidates: [
        { id: 'film-1', title: 'The Matrix', addedBy: 'visitor-1' },
        { id: 'film-2', title: 'Inception', addedBy: 'visitor-2' },
      ],
      ballots: [
        { visitorId: 'visitor-1', votes: { 'film-1': 1, 'film-2': 2 }, submittedAt },
      ],
      totalBallots: 1,
    });
  });

  it('should map ballot submittedAt through .toDate()', async () => {
    // Arrange
    const submittedAt = new Date('2026-03-05T09:00:00Z');
    const toDateMock = jest.fn().mockReturnValue(submittedAt);

    const mockRoundDoc = {
      id: 'round-1',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: jest.fn().mockReturnValue(new Date()) },
        closesAt: { toDate: jest.fn().mockReturnValue(new Date()) },
      }),
    };

    const mockBallotDoc = {
      data: jest.fn().mockReturnValue({
        visitorId: 'visitor-x',
        votes: {},
        submittedAt: { toDate: toDateMock },
      }),
    };

    const mockBallotsGet = jest.fn().mockResolvedValue({ docs: [mockBallotDoc] });
    const mockBallotsCollection = jest.fn().mockReturnValue({ get: mockBallotsGet });
    const mockDoc = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockRoundsLimit });

    const mockFilmsGet = jest.fn().mockResolvedValue({ docs: [] });
    const mockFilmsWhere = jest.fn().mockReturnValue({ get: mockFilmsGet });

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return { where: mockRoundsWhere, doc: mockDoc };
      }
      if (collectionName === 'films') {
        return { where: mockFilmsWhere };
      }
      return {};
    });

    // Act
    await getAdminVotes(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(toDateMock).toHaveBeenCalled();
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.ballots[0].submittedAt).toBe(submittedAt);
  });

  it('should map round openedAt and closesAt through .toDate()', async () => {
    // Arrange
    const openedAt = new Date('2026-03-01T00:00:00Z');
    const closesAt = new Date('2026-03-08T00:00:00Z');
    const openedAtToDate = jest.fn().mockReturnValue(openedAt);
    const closesAtToDate = jest.fn().mockReturnValue(closesAt);

    const mockRoundDoc = {
      id: 'round-42',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: openedAtToDate },
        closesAt: { toDate: closesAtToDate },
      }),
    };

    const mockBallotsGet = jest.fn().mockResolvedValue({ docs: [] });
    const mockBallotsCollection = jest.fn().mockReturnValue({ get: mockBallotsGet });
    const mockDoc = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockRoundsLimit });

    const mockFilmsGet = jest.fn().mockResolvedValue({ docs: [] });
    const mockFilmsWhere = jest.fn().mockReturnValue({ get: mockFilmsGet });

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return { where: mockRoundsWhere, doc: mockDoc };
      }
      if (collectionName === 'films') {
        return { where: mockFilmsWhere };
      }
      return {};
    });

    // Act
    await getAdminVotes(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(openedAtToDate).toHaveBeenCalled();
    expect(closesAtToDate).toHaveBeenCalled();
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.votingRound.openedAt).toBe(openedAt);
    expect(jsonCall.votingRound.closesAt).toBe(closesAt);
  });

  it('should return totalBallots count equal to ballots array length', async () => {
    // Arrange
    const makeBallotsDoc = (visitorId: string) => ({
      data: jest.fn().mockReturnValue({
        visitorId,
        votes: {},
        submittedAt: { toDate: jest.fn().mockReturnValue(new Date()) },
      }),
    });

    const mockRoundDoc = {
      id: 'round-1',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: jest.fn().mockReturnValue(new Date()) },
        closesAt: { toDate: jest.fn().mockReturnValue(new Date()) },
      }),
    };

    const mockBallotsGet = jest.fn().mockResolvedValue({
      docs: [makeBallotsDoc('v-1'), makeBallotsDoc('v-2'), makeBallotsDoc('v-3')],
    });
    const mockBallotsCollection = jest.fn().mockReturnValue({ get: mockBallotsGet });
    const mockDoc = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockRoundsLimit });

    const mockFilmsGet = jest.fn().mockResolvedValue({ docs: [] });
    const mockFilmsWhere = jest.fn().mockReturnValue({ get: mockFilmsGet });

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return { where: mockRoundsWhere, doc: mockDoc };
      }
      if (collectionName === 'films') {
        return { where: mockFilmsWhere };
      }
      return {};
    });

    // Act
    await getAdminVotes(mockRequest as Request, mockResponse as Response);

    // Assert
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.totalBallots).toBe(3);
    expect(jsonCall.totalBallots).toBe(jsonCall.ballots.length);
  });

  it('should return 500 on unexpected error', async () => {
    // Arrange
    const error = new Error('Firestore unavailable');
    const mockGet = jest.fn().mockRejectedValue(error);
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await getAdminVotes(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Get admin votes error:', error);

    // Cleanup
    consoleErrorSpy.mockRestore();
  });
});

describe('POST /admin/open-round - openRound', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {};
    mockResponse = { status: mockStatus, json: mockJson };
    jest.clearAllMocks();
  });

  it('should return 400 when a voting round is already open', async () => {
    // Arrange
    const mockGet = jest.fn().mockResolvedValue({ empty: false, docs: [{ id: 'round-1' }] });
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere });

    // Act
    await openRound(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'A voting round is already open' });
    expect(openVotingModule.openVotingRound).not.toHaveBeenCalled();
  });

  it('should return 400 when there are no nominated films', async () => {
    // Arrange
    const mockNoRoundsGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });
    const mockNoFilmsGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });

    const mockNoRoundsLimit = jest.fn().mockReturnValue({ get: mockNoRoundsGet });
    const mockNoFilmsLimit = jest.fn().mockReturnValue({ get: mockNoFilmsGet });

    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockNoRoundsLimit });
    const mockFilmsWhere = jest.fn().mockReturnValue({ limit: mockNoFilmsLimit });

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return { where: mockRoundsWhere };
      }
      if (collectionName === 'films') {
        return { where: mockFilmsWhere };
      }
      return {};
    });

    // Act
    await openRound(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'No nominated films to vote on' });
    expect(openVotingModule.openVotingRound).not.toHaveBeenCalled();
  });

  it('should call openVotingRound() and return success when conditions are met', async () => {
    // Arrange
    const mockNoRoundsGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });
    const mockFilmsGet = jest.fn().mockResolvedValue({ empty: false, docs: [{ id: 'film-1' }] });

    const mockNoRoundsLimit = jest.fn().mockReturnValue({ get: mockNoRoundsGet });
    const mockFilmsLimit = jest.fn().mockReturnValue({ get: mockFilmsGet });

    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockNoRoundsLimit });
    const mockFilmsWhere = jest.fn().mockReturnValue({ limit: mockFilmsLimit });

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return { where: mockRoundsWhere };
      }
      if (collectionName === 'films') {
        return { where: mockFilmsWhere };
      }
      return {};
    });

    (openVotingModule.openVotingRound as jest.Mock).mockResolvedValue(undefined);

    // Act
    await openRound(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(openVotingModule.openVotingRound).toHaveBeenCalledTimes(1);
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({ success: true, message: 'Voting round opened' });
  });

  it('should return 500 with error message on failure', async () => {
    // Arrange
    const error = new Error('Database write failed');
    const mockGet = jest.fn().mockRejectedValue(error);
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await openRound(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Database write failed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Open round error:', error);

    // Cleanup
    consoleErrorSpy.mockRestore();
  });
});

describe('POST /admin/select-winner - selectWinner', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {};
    mockResponse = { status: mockStatus, json: mockJson };
    jest.clearAllMocks();
  });

  it('should call closeVotingRound() and return success', async () => {
    // Arrange
    (closeVotingModule.closeVotingRound as jest.Mock).mockResolvedValue(undefined);

    // Act
    await selectWinner(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(closeVotingModule.closeVotingRound).toHaveBeenCalledTimes(1);
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      success: true,
      message: 'Winner selected and voting round closed',
    });
  });

  it('should return 500 with error.message when closeVotingRound throws', async () => {
    // Arrange
    const error = new Error('No open voting round found');
    (closeVotingModule.closeVotingRound as jest.Mock).mockRejectedValue(error);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await selectWinner(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'No open voting round found' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Select winner error:', error);

    // Cleanup
    consoleErrorSpy.mockRestore();
  });

  it('should return 500 with fallback message when error has no message', async () => {
    // Arrange
    const error = { message: '' };
    (closeVotingModule.closeVotingRound as jest.Mock).mockRejectedValue(error);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await selectWinner(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Failed to select winner' });

    // Cleanup
    consoleErrorSpy.mockRestore();
  });
});
