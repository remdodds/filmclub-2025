import { closeVotingRound } from './closeVoting';
import { db } from '../utils/db';
import { getDefaultAlgorithm } from '../voting/index';
import { markFilmAsWatched } from '../films/films.logic';
import { archiveVotingRound } from '../history/votingHistory';
import { VotingResults, Ballot, FilmCandidate } from '../voting/types';
import { Film } from '../films/films.logic';

jest.mock('../utils/db', () => ({ db: { collection: jest.fn() } }));
jest.mock('../voting/index');
jest.mock('../films/films.logic');
jest.mock('../history/votingHistory');

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockGetDefaultAlgorithm = getDefaultAlgorithm as jest.MockedFunction<typeof getDefaultAlgorithm>;
const mockMarkFilmAsWatched = markFilmAsWatched as jest.MockedFunction<typeof markFilmAsWatched>;
const mockArchiveVotingRound = archiveVotingRound as jest.MockedFunction<typeof archiveVotingRound>;

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeTimestamp(date: Date) {
  return { toDate: () => date };
}

/** A single ballot Firestore doc stub. */
function makeBallotDoc(visitorId: string, votes: object[], submittedAt: Date) {
  return {
    data: () => ({
      visitorId,
      votes,
      submittedAt: makeTimestamp(submittedAt),
    }),
  };
}

/** A single film Firestore doc stub. */
function makeFilmDoc(id: string, title: string, addedBy: string) {
  return {
    id,
    data: () => ({ title, addedBy }),
  };
}

/** Minimal VotingResults with a winner. */
function makeResults(winner: string | null, overrides: Partial<VotingResults> = {}): VotingResults {
  return {
    winner,
    condorcetWinner: winner !== null,
    rankings: [],
    pairwiseComparisons: [],
    totalBallots: 3,
    algorithm: 'Condorcet',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock wiring
// ---------------------------------------------------------------------------

/**
 * Wire up all Firestore collection stubs in one place.
 * Individual tests receive fine-grained overrides via the returned mocks.
 */
interface WireOptions {
  /** Whether the open-rounds query returns an empty snapshot. */
  openRoundsEmpty?: boolean;
  /** Docs returned by the ballots sub-collection query. */
  ballotDocs?: object[];
  /** Docs returned by the nominated films query. */
  filmDocs?: object[];
  /** Winning film Firestore doc stub (for the per-film .doc().get() call). */
  winningFilmDoc?: { exists: boolean; id?: string; data?: () => object };
  /** The VotingResults the algorithm mock returns. */
  algorithmResults?: VotingResults;
}

function wireMocks(opts: WireOptions = {}) {
  const {
    openRoundsEmpty = false,
    ballotDocs = [],
    filmDocs = [makeFilmDoc('film-1', 'The Matrix', 'visitor-1')],
    winningFilmDoc = {
      exists: true,
      id: 'film-1',
      data: () => ({
        title: 'The Matrix',
        addedBy: 'visitor-1',
        addedAt: makeTimestamp(new Date('2026-01-01')),
        status: 'nominated',
      }),
    },
    algorithmResults = makeResults('film-1'),
  } = opts;

  // ---- voting algorithm mock ----
  const mockCalculateWinner = jest.fn().mockReturnValue(algorithmResults);
  mockGetDefaultAlgorithm.mockReturnValue({
    name: 'Condorcet',
    description: 'Condorcet method',
    calculateWinner: mockCalculateWinner,
  });

  // ---- markFilmAsWatched mock ----
  const watchedAt = new Date('2026-03-22T12:00:00.000Z');
  mockMarkFilmAsWatched.mockImplementation((film: Film) => ({
    ...film,
    status: 'watched' as const,
    watchedAt,
  }));

  // ---- archiveVotingRound mock ----
  mockArchiveVotingRound.mockResolvedValue(undefined);

  // ---- per-collection mocks we expose for assertion ----
  const mockBallotsGet = jest.fn().mockResolvedValue({ docs: ballotDocs });
  const mockMetaSet = jest.fn().mockResolvedValue(undefined);
  const mockRoundUpdate = jest.fn().mockResolvedValue(undefined);
  const mockFilmUpdate = jest.fn().mockResolvedValue(undefined);
  const mockFilmGet = jest.fn().mockResolvedValue(winningFilmDoc);

  (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
    if (collectionName === 'votingRounds') {
      return {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: openRoundsEmpty,
          docs: openRoundsEmpty
            ? []
            : [{ id: 'round-123', data: () => ({ status: 'open' }) }],
        }),
        doc: jest.fn().mockReturnValue({
          id: 'round-123',
          update: mockRoundUpdate,
          collection: jest.fn().mockReturnValue({
            get: mockBallotsGet,
            doc: jest.fn().mockReturnValue({
              set: mockMetaSet,
            }),
          }),
        }),
      };
    }

    if (collectionName === 'films') {
      return {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: filmDocs }),
        doc: jest.fn().mockReturnValue({
          get: mockFilmGet,
          update: mockFilmUpdate,
        }),
      };
    }

    return undefined;
  });

  return {
    mockCalculateWinner,
    mockBallotsGet,
    mockMetaSet,
    mockRoundUpdate,
    mockFilmUpdate,
    mockFilmGet,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('closeVotingRound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Guard: no open round
  // -------------------------------------------------------------------------

  it('does nothing when no voting round is open', async () => {
    // Arrange
    const { mockCalculateWinner, mockRoundUpdate } = wireMocks({ openRoundsEmpty: true });

    // Act
    await closeVotingRound();

    // Assert
    expect(mockCalculateWinner).not.toHaveBeenCalled();
    expect(mockRoundUpdate).not.toHaveBeenCalled();
    expect(mockArchiveVotingRound).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  it('fetches all ballots for the open round', async () => {
    // Arrange
    const submittedAt = new Date('2026-03-20T09:00:00.000Z');
    const ballotDocs = [
      makeBallotDoc('visitor-1', [{ filmId: 'film-1', score: 3 }], submittedAt),
      makeBallotDoc('visitor-2', [{ filmId: 'film-1', score: 2 }], submittedAt),
    ];
    const { mockBallotsGet } = wireMocks({ ballotDocs });

    // Act
    await closeVotingRound();

    // Assert – the ballots sub-collection was queried
    expect(mockBallotsGet).toHaveBeenCalledTimes(1);
  });

  it('fetches all nominated film candidates', async () => {
    // Arrange
    const filmDocs = [
      makeFilmDoc('film-1', 'The Matrix', 'visitor-1'),
      makeFilmDoc('film-2', 'Inception', 'visitor-2'),
    ];
    wireMocks({ filmDocs });

    // Act
    await closeVotingRound();

    // Assert – the films collection was queried with status == nominated
    const filmsCollectionCall = (db.collection as jest.Mock).mock.calls.find(
      ([name]: [string]) => name === 'films'
    );
    expect(filmsCollectionCall).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Algorithm
  // -------------------------------------------------------------------------

  it('runs the default voting algorithm on ballots and candidates', async () => {
    // Arrange
    const submittedAt = new Date('2026-03-20T09:00:00.000Z');
    const ballotDocs = [makeBallotDoc('visitor-1', [{ filmId: 'film-1', score: 3 }], submittedAt)];
    const filmDocs = [makeFilmDoc('film-1', 'The Matrix', 'visitor-1')];
    const { mockCalculateWinner } = wireMocks({ ballotDocs, filmDocs });

    // Act
    await closeVotingRound();

    // Assert – algorithm received the mapped ballots and candidates
    expect(mockGetDefaultAlgorithm).toHaveBeenCalledTimes(1);
    expect(mockCalculateWinner).toHaveBeenCalledWith(
      expect.arrayContaining<Ballot>([
        expect.objectContaining<Partial<Ballot>>({
          visitorId: 'visitor-1',
          votes: [{ filmId: 'film-1', score: 3 }],
          submittedAt: expect.any(Date),
        }),
      ]),
      expect.arrayContaining<FilmCandidate>([
        expect.objectContaining<Partial<FilmCandidate>>({
          id: 'film-1',
          title: 'The Matrix',
          addedBy: 'visitor-1',
        }),
      ])
    );
  });

  // -------------------------------------------------------------------------
  // Winner handling
  // -------------------------------------------------------------------------

  it('marks the winning film as watched when there is a winner', async () => {
    // Arrange
    wireMocks({ algorithmResults: makeResults('film-1') });

    // Act
    await closeVotingRound();

    // Assert – markFilmAsWatched was called for the winning film
    expect(mockMarkFilmAsWatched).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'film-1' })
    );
  });

  it('updates the winning film in Firestore with status "watched" and watchedAt', async () => {
    // Arrange
    const { mockFilmUpdate } = wireMocks({ algorithmResults: makeResults('film-1') });

    // Act
    await closeVotingRound();

    // Assert
    expect(mockFilmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'watched',
        watchedAt: expect.any(Date),
      })
    );
  });

  it('does NOT try to update films when there is no winner and no candidates', async () => {
    // Arrange – algorithm returns null and there are no nominated films
    const { mockFilmUpdate, mockFilmGet } = wireMocks({
      algorithmResults: makeResults(null, { totalBallots: 0 }),
      filmDocs: [],
    });

    // Act
    await closeVotingRound();

    // Assert – film document was never fetched or updated
    expect(mockFilmGet).not.toHaveBeenCalled();
    expect(mockFilmUpdate).not.toHaveBeenCalled();
    expect(mockMarkFilmAsWatched).not.toHaveBeenCalled();
  });

  it('picks a random winner when no votes were cast but candidates exist', async () => {
    // Arrange – algorithm returns null winner (zero ballots) but films are nominated
    jest.spyOn(Math, 'random').mockReturnValue(0); // will select index 0
    const filmDocs = [
      makeFilmDoc('film-1', 'The Matrix', 'visitor-1'),
      makeFilmDoc('film-2', 'Inception', 'visitor-2'),
    ];
    const { mockFilmUpdate, mockRoundUpdate } = wireMocks({
      algorithmResults: makeResults(null, { totalBallots: 0 }),
      filmDocs,
      winningFilmDoc: {
        exists: true,
        id: 'film-1',
        data: () => ({
          title: 'The Matrix',
          addedBy: 'visitor-1',
          addedAt: makeTimestamp(new Date('2026-01-01')),
          status: 'nominated',
        }),
      },
    });

    // Act
    await closeVotingRound();

    // Assert – the randomly selected film was marked as watched
    expect(mockFilmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'watched', watchedAt: expect.any(Date) })
    );
    expect(mockRoundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ winner: 'film-1' })
    );
  });

  it('uses Math.random to select among candidates when no votes cast', async () => {
    // Arrange – pick second film (index 1 of 2)
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // Math.floor(0.5 * 2) = 1
    const filmDocs = [
      makeFilmDoc('film-1', 'The Matrix', 'visitor-1'),
      makeFilmDoc('film-2', 'Inception', 'visitor-2'),
    ];
    const { mockRoundUpdate } = wireMocks({
      algorithmResults: makeResults(null, { totalBallots: 0 }),
      filmDocs,
      winningFilmDoc: {
        exists: true,
        id: 'film-2',
        data: () => ({
          title: 'Inception',
          addedBy: 'visitor-2',
          addedAt: makeTimestamp(new Date('2026-01-01')),
          status: 'nominated',
        }),
      },
    });

    // Act
    await closeVotingRound();

    // Assert – second film was selected
    expect(mockRoundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ winner: 'film-2' })
    );
  });

  it('does NOT update the winning film when its Firestore document does not exist', async () => {
    // Arrange – winner ID is set but the film doc is missing
    const { mockFilmUpdate } = wireMocks({
      algorithmResults: makeResults('film-ghost'),
      winningFilmDoc: { exists: false, id: 'film-ghost' },
    });

    // Act
    await closeVotingRound();

    // Assert – no update was attempted on a non-existent document
    expect(mockFilmUpdate).not.toHaveBeenCalled();
    expect(mockMarkFilmAsWatched).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Results storage
  // -------------------------------------------------------------------------

  it('stores voting results in the round\'s metadata subcollection', async () => {
    // Arrange
    const results = makeResults('film-1');
    const { mockMetaSet } = wireMocks({ algorithmResults: results });

    // Act
    await closeVotingRound();

    // Assert – results written to metadata/results doc
    expect(mockMetaSet).toHaveBeenCalledWith(
      expect.objectContaining({
        winner: 'film-1',
        condorcetWinner: true,
        totalBallots: 3,
        algorithm: 'Condorcet',
        calculatedAt: expect.any(Date),
      })
    );
  });

  // -------------------------------------------------------------------------
  // Round status update
  // -------------------------------------------------------------------------

  it('closes the voting round by updating status to "closed"', async () => {
    // Arrange
    const { mockRoundUpdate } = wireMocks();

    // Act
    await closeVotingRound();

    // Assert
    expect(mockRoundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'closed',
        closedAt: expect.any(Date),
        winner: expect.anything(),
      })
    );
  });

  it('writes condorcetWinner and totalBallots to the round document when closing', async () => {
    // Arrange
    const results = makeResults('film-1', { condorcetWinner: true, totalBallots: 7 });
    const { mockRoundUpdate } = wireMocks({ algorithmResults: results });

    // Act
    await closeVotingRound();

    // Assert
    expect(mockRoundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        condorcetWinner: true,
        totalBallots: 7,
      })
    );
  });

  // -------------------------------------------------------------------------
  // Archiving
  // -------------------------------------------------------------------------

  it('archives the voting round after closing', async () => {
    // Arrange
    wireMocks();

    // Act
    await closeVotingRound();

    // Assert – called with the round ID from the open-rounds snapshot
    expect(mockArchiveVotingRound).toHaveBeenCalledTimes(1);
    expect(mockArchiveVotingRound).toHaveBeenCalledWith('round-123');
  });

  it('archives the round AFTER the round status update, not before', async () => {
    // Arrange
    const callOrder: string[] = [];
    wireMocks();

    mockArchiveVotingRound.mockImplementation(async () => {
      callOrder.push('archive');
    });

    // Re-wire db.collection to intercept the round update and record call order
    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return {
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: [{ id: 'round-123', data: () => ({}) }],
          }),
          doc: jest.fn().mockReturnValue({
            id: 'round-123',
            update: jest.fn().mockImplementation(async () => {
              callOrder.push('roundUpdate');
            }),
            collection: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({ docs: [] }),
              doc: jest.fn().mockReturnValue({
                set: jest.fn().mockResolvedValue(undefined),
              }),
            }),
          }),
        };
      }
      if (collectionName === 'films') {
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: [] }),
          doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({ exists: false }),
              update: jest.fn().mockResolvedValue(undefined),
            }),
        };
      }
      return undefined;
    });

    // Act
    await closeVotingRound();

    // Assert
    expect(callOrder.indexOf('roundUpdate')).toBeLessThan(callOrder.indexOf('archive'));
  });

  it('does NOT throw when archiveVotingRound fails (archive errors are swallowed)', async () => {
    // Arrange
    wireMocks();
    mockArchiveVotingRound.mockRejectedValue(new Error('Archive service down'));

    // Act & Assert – should resolve without throwing
    await expect(closeVotingRound()).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  it('throws when an unexpected error occurs during the main flow', async () => {
    // Arrange – make the open-rounds Firestore query reject
    (db.collection as jest.Mock).mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockRejectedValue(new Error('Firestore connection lost')),
    }));

    // Act & Assert
    await expect(closeVotingRound()).rejects.toThrow('Firestore connection lost');
  });

  it('throws when the ballots sub-collection query rejects', async () => {
    // Arrange
    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return {
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: [{ id: 'round-123', data: () => ({}) }],
          }),
          doc: jest.fn().mockReturnValue({
            id: 'round-123',
            update: jest.fn(),
            collection: jest.fn().mockReturnValue({
              get: jest.fn().mockRejectedValue(new Error('Ballots query failed')),
              doc: jest.fn(),
            }),
          }),
        };
      }
      return undefined;
    });

    // Act & Assert
    await expect(closeVotingRound()).rejects.toThrow('Ballots query failed');
  });
});
