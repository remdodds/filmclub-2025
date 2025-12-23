/**
 * Tests for Voting History Archival
 *
 * Following TDD approach - these tests define the expected behavior
 * of our voting history system before implementation.
 */

import { archiveVotingRound, getVotingHistory } from './votingHistory';
import { db } from '../utils/db';
import { VotingResults } from '../voting/types';

// Mock Firestore
jest.mock('../utils/db', () => ({
  db: {
    collection: jest.fn(),
  },
}));

describe('archiveVotingRound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a history record with complete voting information', async () => {
    // Arrange
    const roundId = 'round-123';
    const votingRoundData = {
      status: 'closed',
      openedAt: new Date('2024-01-01'),
      closedAt: new Date('2024-01-08'),
      closesAt: new Date('2024-01-08'),
      candidateCount: 3,
      createdAt: new Date('2024-01-01'),
      winner: 'film-1',
      condorcetWinner: true,
      totalBallots: 5,
    };

    const votingResults: VotingResults = {
      winner: 'film-1',
      condorcetWinner: true,
      rankings: [
        {
          filmId: 'film-1',
          rank: 1,
          totalScore: 15,
          averageScore: 3.0,
          pairwiseWins: 2,
          pairwiseLosses: 0,
        },
        {
          filmId: 'film-2',
          rank: 2,
          totalScore: 10,
          averageScore: 2.0,
          pairwiseWins: 1,
          pairwiseLosses: 1,
        },
        {
          filmId: 'film-3',
          rank: 3,
          totalScore: 5,
          averageScore: 1.0,
          pairwiseWins: 0,
          pairwiseLosses: 2,
        },
      ],
      pairwiseComparisons: [
        { filmA: 'film-1', filmB: 'film-2', filmAWins: 4, filmBWins: 1, ties: 0 },
        { filmA: 'film-1', filmB: 'film-3', filmAWins: 5, filmBWins: 0, ties: 0 },
        { filmA: 'film-2', filmB: 'film-3', filmAWins: 3, filmBWins: 2, ties: 0 },
      ],
      totalBallots: 5,
      algorithm: 'Condorcet',
    };

    const films = [
      {
        id: 'film-1',
        title: 'The Matrix',
        addedBy: 'visitor-1',
        addedAt: new Date('2023-12-01'),
        status: 'watched',
      },
      {
        id: 'film-2',
        title: 'Inception',
        addedBy: 'visitor-2',
        addedAt: new Date('2023-12-05'),
        status: 'nominated',
      },
      {
        id: 'film-3',
        title: 'Interstellar',
        addedBy: 'visitor-3',
        addedAt: new Date('2023-12-10'),
        status: 'nominated',
      },
    ];

    // Mock Firestore calls
    const mockVotingRoundDoc = {
      id: roundId,
      data: () => votingRoundData,
      exists: true,
    };

    const mockResultsDoc = {
      data: () => votingResults,
      exists: true,
    };

    const mockFilmDocs = films.map((film) => ({
      id: film.id,
      data: () => film,
      exists: true,
    }));

    const mockSet = jest.fn().mockResolvedValue(undefined);

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return {
          doc: (docId: string) => ({
            get: jest.fn().mockResolvedValue(mockVotingRoundDoc),
            collection: (subCollection: string) => ({
              doc: (subDocId: string) => ({
                get: jest.fn().mockResolvedValue(mockResultsDoc),
              }),
            }),
          }),
        };
      }
      if (collectionName === 'films') {
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({
            docs: mockFilmDocs,
          }),
        };
      }
      if (collectionName === 'votingHistory') {
        return {
          doc: jest.fn().mockReturnValue({
            set: mockSet,
          }),
        };
      }
      return undefined;
    });

    // Act
    await archiveVotingRound(roundId);

    // Assert
    expect(mockSet).toHaveBeenCalledWith({
      roundId: roundId,
      openedAt: votingRoundData.openedAt,
      closedAt: votingRoundData.closedAt,
      totalBallots: 5,
      candidateCount: 3,
      winner: {
        filmId: 'film-1',
        title: 'The Matrix',
        nominatedBy: 'visitor-1',
      },
      condorcetWinner: true,
      algorithm: 'Condorcet',
      rankings: expect.arrayContaining([
        expect.objectContaining({
          filmId: 'film-1',
          title: 'The Matrix',
          rank: 1,
          totalScore: 15,
          averageScore: 3.0,
          pairwiseWins: 2,
          pairwiseLosses: 0,
        }),
        expect.objectContaining({
          filmId: 'film-2',
          title: 'Inception',
          rank: 2,
        }),
        expect.objectContaining({
          filmId: 'film-3',
          title: 'Interstellar',
          rank: 3,
        }),
      ]),
      pairwiseComparisons: votingResults.pairwiseComparisons,
      archivedAt: expect.any(Date),
    });
  });

  it('should handle voting rounds with no winner', async () => {
    // Arrange
    const roundId = 'round-no-winner';
    const votingRoundData = {
      status: 'closed',
      openedAt: new Date('2024-01-01'),
      closedAt: new Date('2024-01-08'),
      closesAt: new Date('2024-01-08'),
      candidateCount: 2,
      createdAt: new Date('2024-01-01'),
      winner: null,
      condorcetWinner: false,
      totalBallots: 0,
    };

    const votingResults: VotingResults = {
      winner: null,
      condorcetWinner: false,
      rankings: [],
      pairwiseComparisons: [],
      totalBallots: 0,
      algorithm: 'Condorcet',
    };

    const mockVotingRoundDoc = {
      id: roundId,
      data: () => votingRoundData,
      exists: true,
    };

    const mockResultsDoc = {
      data: () => votingResults,
      exists: true,
    };

    const mockSet = jest.fn().mockResolvedValue(undefined);

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return {
          doc: () => ({
            get: jest.fn().mockResolvedValue(mockVotingRoundDoc),
            collection: () => ({
              doc: () => ({
                get: jest.fn().mockResolvedValue(mockResultsDoc),
              }),
            }),
          }),
        };
      }
      if (collectionName === 'films') {
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: [] }),
        };
      }
      if (collectionName === 'votingHistory') {
        return {
          doc: jest.fn().mockReturnValue({
            set: mockSet,
          }),
        };
      }
      return undefined;
    });

    // Act
    await archiveVotingRound(roundId);

    // Assert
    expect(mockSet).toHaveBeenCalledWith({
      roundId: roundId,
      openedAt: votingRoundData.openedAt,
      closedAt: votingRoundData.closedAt,
      totalBallots: 0,
      candidateCount: 2,
      winner: null,
      condorcetWinner: false,
      algorithm: 'Condorcet',
      rankings: [],
      pairwiseComparisons: [],
      archivedAt: expect.any(Date),
    });
  });

  it('should throw error if voting round does not exist', async () => {
    // Arrange
    const roundId = 'non-existent-round';

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return {
          doc: () => ({
            get: jest.fn().mockResolvedValue({
              exists: false,
            }),
          }),
        };
      }
      return undefined;
    });

    // Act & Assert
    await expect(archiveVotingRound(roundId)).rejects.toThrow(
      'Voting round not found'
    );
  });

  it('should throw error if voting results do not exist', async () => {
    // Arrange
    const roundId = 'round-no-results';

    const mockVotingRoundDoc = {
      id: roundId,
      data: () => ({
        status: 'closed',
        openedAt: new Date(),
        closedAt: new Date(),
      }),
      exists: true,
    };

    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return {
          doc: () => ({
            get: jest.fn().mockResolvedValue(mockVotingRoundDoc),
            collection: () => ({
              doc: () => ({
                get: jest.fn().mockResolvedValue({
                  exists: false,
                }),
              }),
            }),
          }),
        };
      }
      return undefined;
    });

    // Act & Assert
    await expect(archiveVotingRound(roundId)).rejects.toThrow(
      'Voting results not found'
    );
  });
});

describe('getVotingHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should retrieve voting history ordered by closedAt descending', async () => {
    // Arrange
    const mockHistoryDocs = [
      {
        id: 'round-3',
        data: () => ({
          roundId: 'round-3',
          closedAt: new Date('2024-03-01'),
          winner: { filmId: 'film-5', title: 'Film 5', nominatedBy: 'visitor-1' },
          totalBallots: 10,
        }),
      },
      {
        id: 'round-2',
        data: () => ({
          roundId: 'round-2',
          closedAt: new Date('2024-02-01'),
          winner: { filmId: 'film-3', title: 'Film 3', nominatedBy: 'visitor-2' },
          totalBallots: 8,
        }),
      },
      {
        id: 'round-1',
        data: () => ({
          roundId: 'round-1',
          closedAt: new Date('2024-01-01'),
          winner: { filmId: 'film-1', title: 'Film 1', nominatedBy: 'visitor-3' },
          totalBallots: 5,
        }),
      },
    ];

    const mockOrderBy = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockGet = jest.fn().mockResolvedValue({
      docs: mockHistoryDocs,
    });

    (db.collection as jest.Mock).mockReturnValue({
      orderBy: mockOrderBy,
      limit: mockLimit,
      get: mockGet,
    });

    // Act
    const history = await getVotingHistory();

    // Assert
    expect(db.collection).toHaveBeenCalledWith('votingHistory');
    expect(mockOrderBy).toHaveBeenCalledWith('closedAt', 'desc');
    expect(mockGet).toHaveBeenCalled();
    expect(history).toHaveLength(3);
    expect(history[0].roundId).toBe('round-3');
    expect(history[1].roundId).toBe('round-2');
    expect(history[2].roundId).toBe('round-1');
  });

  it('should support pagination with limit parameter', async () => {
    // Arrange
    const mockLimit = jest.fn().mockReturnThis();
    const mockGet = jest.fn().mockResolvedValue({ docs: [] });

    (db.collection as jest.Mock).mockReturnValue({
      orderBy: jest.fn().mockReturnThis(),
      limit: mockLimit,
      get: mockGet,
    });

    // Act
    await getVotingHistory(10);

    // Assert
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('should return empty array when no history exists', async () => {
    // Arrange
    (db.collection as jest.Mock).mockReturnValue({
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    });

    // Act
    const history = await getVotingHistory();

    // Assert
    expect(history).toEqual([]);
  });
});
