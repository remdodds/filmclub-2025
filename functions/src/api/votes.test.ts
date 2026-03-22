/**
 * Votes API Endpoint Tests
 */

import { Request, Response } from 'express';
import { getCurrentVoting, submitVote, getLatestResults } from './votes';

// Mock all external dependencies
jest.mock('../utils/db', () => ({
  db: {
    collection: jest.fn(),
  },
}));

import { db } from '../utils/db';

describe('GET /votes/current - getCurrentVoting', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = { query: {} };
    mockResponse = { status: mockStatus, json: mockJson };
    jest.clearAllMocks();
  });

  it('returns isOpen:false with null votingRound and userBallot when no round is open', async () => {
    // Arrange
    const mockGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere });

    // Act
    await getCurrentVoting(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      isOpen: false,
      votingRound: null,
      userBallot: null,
    });
  });

  it('returns round info with candidates when a round is open (no visitorId)', async () => {
    // Arrange
    const openedAt = new Date('2026-03-01T10:00:00Z');
    const closesAt = new Date('2026-03-08T10:00:00Z');

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

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockRoundsLimit });

    const mockFilmsGet = jest.fn().mockResolvedValue({ docs: [mockFilmDoc1, mockFilmDoc2] });
    const mockFilmsWhere = jest.fn().mockReturnValue({ get: mockFilmsGet });

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
    await getCurrentVoting(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      isOpen: true,
      votingRound: {
        id: 'round-1',
        openedAt,
        closesAt,
        candidates: [
          { id: 'film-1', title: 'The Matrix', addedBy: 'visitor-1' },
          { id: 'film-2', title: 'Inception', addedBy: 'visitor-2' },
        ],
      },
      userBallot: null,
    });
  });

  it('includes candidates list with id, title, addedBy', async () => {
    // Arrange
    const mockRoundDoc = {
      id: 'round-1',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: jest.fn().mockReturnValue(new Date()) },
        closesAt: { toDate: jest.fn().mockReturnValue(new Date()) },
      }),
    };

    const mockFilmDoc = {
      id: 'film-42',
      data: jest.fn().mockReturnValue({ title: 'Blade Runner', addedBy: 'visitor-99' }),
    };

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockRoundsLimit });

    const mockFilmsGet = jest.fn().mockResolvedValue({ docs: [mockFilmDoc] });
    const mockFilmsWhere = jest.fn().mockReturnValue({ get: mockFilmsGet });

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
    await getCurrentVoting(mockRequest as Request, mockResponse as Response);

    // Assert
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.votingRound.candidates).toEqual([
      { id: 'film-42', title: 'Blade Runner', addedBy: 'visitor-99' },
    ]);
  });

  it('maps openedAt and closesAt through .toDate()', async () => {
    // Arrange
    const openedAt = new Date('2026-02-01T00:00:00Z');
    const closesAt = new Date('2026-02-08T00:00:00Z');
    const openedAtToDate = jest.fn().mockReturnValue(openedAt);
    const closesAtToDate = jest.fn().mockReturnValue(closesAt);

    const mockRoundDoc = {
      id: 'round-1',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: openedAtToDate },
        closesAt: { toDate: closesAtToDate },
      }),
    };

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockRoundsLimit });

    const mockFilmsGet = jest.fn().mockResolvedValue({ docs: [] });
    const mockFilmsWhere = jest.fn().mockReturnValue({ get: mockFilmsGet });

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
    await getCurrentVoting(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(openedAtToDate).toHaveBeenCalled();
    expect(closesAtToDate).toHaveBeenCalled();
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.votingRound.openedAt).toBe(openedAt);
    expect(jsonCall.votingRound.closesAt).toBe(closesAt);
  });

  it('fetches user ballot when visitorId query param is provided', async () => {
    // Arrange
    mockRequest.query = { visitorId: 'visitor-abc' };

    const submittedAt = new Date('2026-03-05T12:00:00Z');

    const mockRoundDoc = {
      id: 'round-1',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: jest.fn().mockReturnValue(new Date()) },
        closesAt: { toDate: jest.fn().mockReturnValue(new Date()) },
      }),
    };

    const mockBallotDoc = {
      exists: true,
      data: jest.fn().mockReturnValue({
        visitorId: 'visitor-abc',
        votes: [{ filmId: 'film-1', score: 2 }],
        submittedAt: { toDate: jest.fn().mockReturnValue(submittedAt) },
      }),
    };

    const mockBallotDocGet = jest.fn().mockResolvedValue(mockBallotDoc);
    const mockBallotDocRef = jest.fn().mockReturnValue({ get: mockBallotDocGet });
    const mockBallotsCollection = jest.fn().mockReturnValue({ doc: mockBallotDocRef });
    const mockRoundDocRef = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockRoundsLimit });

    const mockFilmsGet = jest.fn().mockResolvedValue({ docs: [] });
    const mockFilmsWhere = jest.fn().mockReturnValue({ get: mockFilmsGet });

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return { where: mockRoundsWhere, doc: mockRoundDocRef };
      }
      if (collectionName === 'films') {
        return { where: mockFilmsWhere };
      }
      return {};
    });

    // Act
    await getCurrentVoting(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockBallotDocRef).toHaveBeenCalledWith('visitor-abc');
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.userBallot).toEqual({
      visitorId: 'visitor-abc',
      votes: [{ filmId: 'film-1', score: 2 }],
      submittedAt,
    });
  });

  it('sets userBallot to null when visitorId is provided but has no ballot', async () => {
    // Arrange
    mockRequest.query = { visitorId: 'visitor-xyz' };

    const mockRoundDoc = {
      id: 'round-1',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: jest.fn().mockReturnValue(new Date()) },
        closesAt: { toDate: jest.fn().mockReturnValue(new Date()) },
      }),
    };

    const mockBallotDoc = {
      exists: false,
      data: jest.fn(),
    };

    const mockBallotDocGet = jest.fn().mockResolvedValue(mockBallotDoc);
    const mockBallotDocRef = jest.fn().mockReturnValue({ get: mockBallotDocGet });
    const mockBallotsCollection = jest.fn().mockReturnValue({ doc: mockBallotDocRef });
    const mockRoundDocRef = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockRoundsLimit });

    const mockFilmsGet = jest.fn().mockResolvedValue({ docs: [] });
    const mockFilmsWhere = jest.fn().mockReturnValue({ get: mockFilmsGet });

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return { where: mockRoundsWhere, doc: mockRoundDocRef };
      }
      if (collectionName === 'films') {
        return { where: mockFilmsWhere };
      }
      return {};
    });

    // Act
    await getCurrentVoting(mockRequest as Request, mockResponse as Response);

    // Assert
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.userBallot).toBeNull();
  });

  it('maps ballot submittedAt through .toDate() when ballot exists', async () => {
    // Arrange
    mockRequest.query = { visitorId: 'visitor-abc' };

    const submittedAt = new Date('2026-03-06T09:30:00Z');
    const submittedAtToDate = jest.fn().mockReturnValue(submittedAt);

    const mockRoundDoc = {
      id: 'round-1',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: jest.fn().mockReturnValue(new Date()) },
        closesAt: { toDate: jest.fn().mockReturnValue(new Date()) },
      }),
    };

    const mockBallotDoc = {
      exists: true,
      data: jest.fn().mockReturnValue({
        visitorId: 'visitor-abc',
        votes: [],
        submittedAt: { toDate: submittedAtToDate },
      }),
    };

    const mockBallotDocGet = jest.fn().mockResolvedValue(mockBallotDoc);
    const mockBallotDocRef = jest.fn().mockReturnValue({ get: mockBallotDocGet });
    const mockBallotsCollection = jest.fn().mockReturnValue({ doc: mockBallotDocRef });
    const mockRoundDocRef = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockRoundsLimit });

    const mockFilmsGet = jest.fn().mockResolvedValue({ docs: [] });
    const mockFilmsWhere = jest.fn().mockReturnValue({ get: mockFilmsGet });

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return { where: mockRoundsWhere, doc: mockRoundDocRef };
      }
      if (collectionName === 'films') {
        return { where: mockFilmsWhere };
      }
      return {};
    });

    // Act
    await getCurrentVoting(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(submittedAtToDate).toHaveBeenCalled();
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.userBallot.submittedAt).toBe(submittedAt);
  });

  it('does NOT fetch user ballot when visitorId is not provided', async () => {
    // Arrange
    mockRequest.query = {};

    const mockRoundDoc = {
      id: 'round-1',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: jest.fn().mockReturnValue(new Date()) },
        closesAt: { toDate: jest.fn().mockReturnValue(new Date()) },
      }),
    };

    const mockBallotDocGet = jest.fn();
    const mockBallotDocRef = jest.fn().mockReturnValue({ get: mockBallotDocGet });
    const mockBallotsCollection = jest.fn().mockReturnValue({ doc: mockBallotDocRef });
    const mockRoundDocRef = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsWhere = jest.fn().mockReturnValue({ limit: mockRoundsLimit });

    const mockFilmsGet = jest.fn().mockResolvedValue({ docs: [] });
    const mockFilmsWhere = jest.fn().mockReturnValue({ get: mockFilmsGet });

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return { where: mockRoundsWhere, doc: mockRoundDocRef };
      }
      if (collectionName === 'films') {
        return { where: mockFilmsWhere };
      }
      return {};
    });

    // Act
    await getCurrentVoting(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockBallotDocGet).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    // Arrange
    const error = new Error('Firestore unavailable');
    const mockGet = jest.fn().mockRejectedValue(error);
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await getCurrentVoting(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Get current voting error:', error);

    // Cleanup
    consoleErrorSpy.mockRestore();
  });
});

describe('POST /votes - submitVote', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = { body: {} };
    mockResponse = { status: mockStatus, json: mockJson };
    jest.clearAllMocks();
  });

  it('returns 400 when visitorId is missing', async () => {
    // Arrange
    mockRequest.body = { votes: [{ filmId: 'film-1', score: 2 }] };

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Invalid request. Provide visitorId and votes array.',
    });
  });

  it('returns 400 when votes is not an array', async () => {
    // Arrange
    mockRequest.body = { visitorId: 'visitor-1', votes: 'not-an-array' };

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Invalid request. Provide visitorId and votes array.',
    });
  });

  it('returns 400 when a vote is missing filmId', async () => {
    // Arrange
    mockRequest.body = { visitorId: 'visitor-1', votes: [{ score: 2 }] };

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Each vote must have filmId and score' });
  });

  it('returns 400 when a vote has a non-number score', async () => {
    // Arrange
    mockRequest.body = { visitorId: 'visitor-1', votes: [{ filmId: 'film-1', score: 'two' }] };

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Each vote must have filmId and score' });
  });

  it('returns 400 when a vote score is below 0', async () => {
    // Arrange
    mockRequest.body = { visitorId: 'visitor-1', votes: [{ filmId: 'film-1', score: -1 }] };

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Vote scores must be between 0 and 3' });
  });

  it('returns 400 when a vote score is above 3', async () => {
    // Arrange
    mockRequest.body = { visitorId: 'visitor-1', votes: [{ filmId: 'film-1', score: 4 }] };

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Vote scores must be between 0 and 3' });
  });

  it('returns 400 when no voting round is open', async () => {
    // Arrange
    mockRequest.body = { visitorId: 'visitor-1', votes: [{ filmId: 'film-1', score: 2 }] };

    const mockGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere });

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({ error: 'No voting round is currently open' });
  });

  it('saves ballot to the correct subcollection path (votingRounds/{roundId}/ballots/{visitorId})', async () => {
    // Arrange
    mockRequest.body = { visitorId: 'visitor-1', votes: [{ filmId: 'film-1', score: 2 }] };

    const mockRoundDoc = { id: 'round-99' };

    const mockSet = jest.fn().mockResolvedValue(undefined);
    const mockBallotDocRef = jest.fn().mockReturnValue({ set: mockSet });
    const mockBallotsCollection = jest.fn().mockReturnValue({ doc: mockBallotDocRef });
    const mockRoundDocRef = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });

    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere, doc: mockRoundDocRef });

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockRoundDocRef).toHaveBeenCalledWith('round-99');
    expect(mockBallotsCollection).toHaveBeenCalledWith('ballots');
    expect(mockBallotDocRef).toHaveBeenCalledWith('visitor-1');
    expect(mockSet).toHaveBeenCalled();
  });

  it('returns 200 with success:true and the ballot on success', async () => {
    // Arrange
    const votes = [{ filmId: 'film-1', score: 2 }];
    mockRequest.body = { visitorId: 'visitor-1', votes };

    const mockRoundDoc = { id: 'round-1' };

    const mockSet = jest.fn().mockResolvedValue(undefined);
    const mockBallotDocRef = jest.fn().mockReturnValue({ set: mockSet });
    const mockBallotsCollection = jest.fn().mockReturnValue({ doc: mockBallotDocRef });
    const mockRoundDocRef = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });

    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere, doc: mockRoundDocRef });

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.success).toBe(true);
    expect(jsonCall.ballot.visitorId).toBe('visitor-1');
    expect(jsonCall.ballot.votes).toEqual(votes);
    expect(jsonCall.ballot.submittedAt).toBeInstanceOf(Date);
  });

  it('accepts votes with score of exactly 0 (boundary)', async () => {
    // Arrange
    mockRequest.body = { visitorId: 'visitor-1', votes: [{ filmId: 'film-1', score: 0 }] };

    const mockRoundDoc = { id: 'round-1' };

    const mockSet = jest.fn().mockResolvedValue(undefined);
    const mockBallotDocRef = jest.fn().mockReturnValue({ set: mockSet });
    const mockBallotsCollection = jest.fn().mockReturnValue({ doc: mockBallotDocRef });
    const mockRoundDocRef = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });

    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere, doc: mockRoundDocRef });

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.success).toBe(true);
  });

  it('accepts votes with score of exactly 3 (boundary)', async () => {
    // Arrange
    mockRequest.body = { visitorId: 'visitor-1', votes: [{ filmId: 'film-1', score: 3 }] };

    const mockRoundDoc = { id: 'round-1' };

    const mockSet = jest.fn().mockResolvedValue(undefined);
    const mockBallotDocRef = jest.fn().mockReturnValue({ set: mockSet });
    const mockBallotsCollection = jest.fn().mockReturnValue({ doc: mockBallotDocRef });
    const mockRoundDocRef = jest.fn().mockReturnValue({ collection: mockBallotsCollection });

    const mockGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });

    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere, doc: mockRoundDocRef });

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.success).toBe(true);
  });

  it('returns 500 on unexpected error', async () => {
    // Arrange
    mockRequest.body = { visitorId: 'visitor-1', votes: [{ filmId: 'film-1', score: 2 }] };

    const error = new Error('Firestore write error');
    const mockGet = jest.fn().mockRejectedValue(error);
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await submitVote(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Submit vote error:', error);

    // Cleanup
    consoleErrorSpy.mockRestore();
  });
});

describe('GET /votes/results/latest - getLatestResults', () => {
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

  it('returns results:null and votingRound:null when no closed rounds exist', async () => {
    // Arrange
    const mockGet = jest.fn().mockResolvedValue({ empty: true, docs: [] });
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockOrderBy = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere });

    // Act
    await getLatestResults(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      results: null,
      votingRound: null,
    });
  });

  it('returns 500 when results document does not exist for a closed round', async () => {
    // Arrange
    const mockRoundDoc = {
      id: 'round-5',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: jest.fn().mockReturnValue(new Date()) },
        closedAt: { toDate: jest.fn().mockReturnValue(new Date()) },
      }),
    };

    const mockResultsDoc = { exists: false, data: jest.fn() };
    const mockResultsDocGet = jest.fn().mockResolvedValue(mockResultsDoc);
    const mockResultsDocRef = jest.fn().mockReturnValue({ get: mockResultsDocGet });
    const mockMetadataCollection = jest.fn().mockReturnValue({ doc: mockResultsDocRef });
    const mockRoundDocRef = jest.fn().mockReturnValue({ collection: mockMetadataCollection });

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsOrderBy = jest.fn().mockReturnValue({ limit: mockRoundsLimit });
    const mockRoundsWhere = jest.fn().mockReturnValue({ orderBy: mockRoundsOrderBy });

    (db.collection as jest.Mock).mockReturnValue({ where: mockRoundsWhere, doc: mockRoundDocRef });

    // Act
    await getLatestResults(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Results not found for closed round' });
  });

  it('returns results and round info when a closed round with results exists', async () => {
    // Arrange
    const openedAt = new Date('2026-02-01T10:00:00Z');
    const closedAt = new Date('2026-02-08T10:00:00Z');

    const mockRoundDoc = {
      id: 'round-5',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: jest.fn().mockReturnValue(openedAt) },
        closedAt: { toDate: jest.fn().mockReturnValue(closedAt) },
      }),
    };

    const mockResultsData = {
      winner: { filmId: 'film-3', title: 'Blade Runner 2049' },
      rankings: [],
    };

    const mockResultsDoc = { exists: true, data: jest.fn().mockReturnValue(mockResultsData) };
    const mockResultsDocGet = jest.fn().mockResolvedValue(mockResultsDoc);
    const mockResultsDocRef = jest.fn().mockReturnValue({ get: mockResultsDocGet });
    const mockMetadataCollection = jest.fn().mockReturnValue({ doc: mockResultsDocRef });
    const mockRoundDocRef = jest.fn().mockReturnValue({ collection: mockMetadataCollection });

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsOrderBy = jest.fn().mockReturnValue({ limit: mockRoundsLimit });
    const mockRoundsWhere = jest.fn().mockReturnValue({ orderBy: mockRoundsOrderBy });

    (db.collection as jest.Mock).mockReturnValue({ where: mockRoundsWhere, doc: mockRoundDocRef });

    // Act
    await getLatestResults(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      results: mockResultsData,
      votingRound: { id: 'round-5', openedAt, closedAt },
    });
  });

  it('maps openedAt and closedAt through .toDate()', async () => {
    // Arrange
    const openedAt = new Date('2026-01-10T00:00:00Z');
    const closedAt = new Date('2026-01-17T00:00:00Z');
    const openedAtToDate = jest.fn().mockReturnValue(openedAt);
    const closedAtToDate = jest.fn().mockReturnValue(closedAt);

    const mockRoundDoc = {
      id: 'round-7',
      data: jest.fn().mockReturnValue({
        openedAt: { toDate: openedAtToDate },
        closedAt: { toDate: closedAtToDate },
      }),
    };

    const mockResultsDoc = {
      exists: true,
      data: jest.fn().mockReturnValue({ winner: { filmId: 'film-1', title: 'Dune' } }),
    };
    const mockResultsDocGet = jest.fn().mockResolvedValue(mockResultsDoc);
    const mockResultsDocRef = jest.fn().mockReturnValue({ get: mockResultsDocGet });
    const mockMetadataCollection = jest.fn().mockReturnValue({ doc: mockResultsDocRef });
    const mockRoundDocRef = jest.fn().mockReturnValue({ collection: mockMetadataCollection });

    const mockRoundsGet = jest.fn().mockResolvedValue({ empty: false, docs: [mockRoundDoc] });
    const mockRoundsLimit = jest.fn().mockReturnValue({ get: mockRoundsGet });
    const mockRoundsOrderBy = jest.fn().mockReturnValue({ limit: mockRoundsLimit });
    const mockRoundsWhere = jest.fn().mockReturnValue({ orderBy: mockRoundsOrderBy });

    (db.collection as jest.Mock).mockReturnValue({ where: mockRoundsWhere, doc: mockRoundDocRef });

    // Act
    await getLatestResults(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(openedAtToDate).toHaveBeenCalled();
    expect(closedAtToDate).toHaveBeenCalled();
    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.votingRound.openedAt).toBe(openedAt);
    expect(jsonCall.votingRound.closedAt).toBe(closedAt);
  });

  it('returns 500 on unexpected error', async () => {
    // Arrange
    const error = new Error('Database connection failed');
    const mockGet = jest.fn().mockRejectedValue(error);
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockOrderBy = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
    (db.collection as jest.Mock).mockReturnValue({ where: mockWhere });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await getLatestResults(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Get latest results error:', error);

    // Cleanup
    consoleErrorSpy.mockRestore();
  });
});
