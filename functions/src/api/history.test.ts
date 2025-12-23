/**
 * Voting History API Endpoint Tests
 *
 * Following TDD - these tests define the expected API behavior
 */

import { Request, Response } from 'express';
import { getHistory } from './history';
import * as votingHistoryModule from '../history/votingHistory';

// Mock the voting history module
jest.mock('../history/votingHistory');

describe('GET /history', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {
      query: {},
    };
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
    jest.clearAllMocks();
  });

  it('should return voting history with default limit', async () => {
    // Arrange
    const mockHistory = [
      {
        roundId: 'round-3',
        openedAt: new Date('2024-03-01'),
        closedAt: new Date('2024-03-08'),
        totalBallots: 10,
        candidateCount: 5,
        winner: {
          filmId: 'film-5',
          title: 'The Matrix',
          nominatedBy: 'visitor-1',
        },
        condorcetWinner: true,
        algorithm: 'Condorcet',
        rankings: [
          {
            filmId: 'film-5',
            title: 'The Matrix',
            rank: 1,
            totalScore: 30,
            averageScore: 3.0,
            pairwiseWins: 4,
            pairwiseLosses: 0,
          },
        ],
        pairwiseComparisons: [],
        archivedAt: new Date('2024-03-08'),
      },
      {
        roundId: 'round-2',
        openedAt: new Date('2024-02-01'),
        closedAt: new Date('2024-02-08'),
        totalBallots: 8,
        candidateCount: 4,
        winner: {
          filmId: 'film-3',
          title: 'Inception',
          nominatedBy: 'visitor-2',
        },
        condorcetWinner: true,
        algorithm: 'Condorcet',
        rankings: [],
        pairwiseComparisons: [],
        archivedAt: new Date('2024-02-08'),
      },
    ];

    (votingHistoryModule.getVotingHistory as jest.Mock).mockResolvedValue(mockHistory);

    // Act
    await getHistory(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(votingHistoryModule.getVotingHistory).toHaveBeenCalledWith(50);
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      history: mockHistory,
    });
  });

  it('should support custom limit parameter', async () => {
    // Arrange
    mockRequest.query = { limit: '10' };
    const mockHistory: any[] = [];

    (votingHistoryModule.getVotingHistory as jest.Mock).mockResolvedValue(mockHistory);

    // Act
    await getHistory(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(votingHistoryModule.getVotingHistory).toHaveBeenCalledWith(10);
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      history: mockHistory,
    });
  });

  it('should handle invalid limit parameter', async () => {
    // Arrange
    mockRequest.query = { limit: 'invalid' };
    const mockHistory: any[] = [];

    (votingHistoryModule.getVotingHistory as jest.Mock).mockResolvedValue(mockHistory);

    // Act
    await getHistory(mockRequest as Request, mockResponse as Response);

    // Assert
    // Should use default limit when limit is invalid
    expect(votingHistoryModule.getVotingHistory).toHaveBeenCalledWith(50);
    expect(mockStatus).toHaveBeenCalledWith(200);
  });

  it('should enforce maximum limit of 100', async () => {
    // Arrange
    mockRequest.query = { limit: '200' };
    const mockHistory: any[] = [];

    (votingHistoryModule.getVotingHistory as jest.Mock).mockResolvedValue(mockHistory);

    // Act
    await getHistory(mockRequest as Request, mockResponse as Response);

    // Assert
    // Should cap at 100
    expect(votingHistoryModule.getVotingHistory).toHaveBeenCalledWith(100);
    expect(mockStatus).toHaveBeenCalledWith(200);
  });

  it('should return empty array when no history exists', async () => {
    // Arrange
    (votingHistoryModule.getVotingHistory as jest.Mock).mockResolvedValue([]);

    // Act
    await getHistory(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      history: [],
    });
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    const error = new Error('Database error');
    (votingHistoryModule.getVotingHistory as jest.Mock).mockRejectedValue(error);

    // Mock console.error to avoid test output noise
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await getHistory(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Internal server error',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Get voting history error:', error);

    // Cleanup
    consoleErrorSpy.mockRestore();
  });
});
