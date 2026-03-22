import { openVotingRound } from './openVoting';
import { db } from '../utils/db';

jest.mock('../utils/db', () => ({ db: { collection: jest.fn() } }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Firestore QuerySnapshot stub.
 */
function makeQuerySnapshot(docs: object[], empty?: boolean) {
  return {
    empty: empty !== undefined ? empty : docs.length === 0,
    size: docs.length,
    docs,
  };
}

/**
 * Build a minimal Firestore DocumentSnapshot stub.
 */
function makeDocSnapshot(exists: boolean, data?: object) {
  return {
    exists,
    data: () => data,
  };
}

/**
 * Standard config used across tests unless overridden.
 */
const DEFAULT_CONFIG = {
  votingSchedule: {
    closeDay: 5, // Friday
    closeTime: '20:00',
  },
};

/**
 * Wire up (db.collection as jest.Mock) so that all three top-level paths
 * (votingRounds, films, config) return sensible defaults.  Individual tests
 * pass overrides for the fields they care about.
 */
interface SetupOptions {
  openRoundsEmpty?: boolean;
  nominatedFilmsEmpty?: boolean;
  nominatedFilmsSize?: number;
  configExists?: boolean;
  configData?: object;
  mockSet?: jest.Mock;
  mockDocFn?: jest.Mock; // override the .doc() factory for votingRounds
}

function setupMocks(opts: SetupOptions = {}) {
  const {
    openRoundsEmpty = true,
    nominatedFilmsEmpty = false,
    nominatedFilmsSize = 3,
    configExists = true,
    configData = DEFAULT_CONFIG,
    mockSet = jest.fn().mockResolvedValue(undefined),
    mockDocFn,
  } = opts;

  // doc() stub used when creating the new round
  const defaultDocStub = {
    id: 'new-round-id',
    set: mockSet,
  };

  (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
    if (collectionName === 'votingRounds') {
      return {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(
          makeQuerySnapshot([], openRoundsEmpty)
        ),
        doc: mockDocFn ?? jest.fn().mockReturnValue(defaultDocStub),
      };
    }

    if (collectionName === 'films') {
      const filmDocs = Array.from({ length: nominatedFilmsSize }, (_, i) => ({
        id: `film-${i + 1}`,
      }));
      return {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(
          makeQuerySnapshot(filmDocs, nominatedFilmsEmpty)
        ),
      };
    }

    if (collectionName === 'config') {
      return {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(makeDocSnapshot(configExists, configData)),
        }),
      };
    }

    return undefined;
  });

  return { mockSet };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('openVotingRound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Early-exit guard conditions
  // -------------------------------------------------------------------------

  it('does nothing when a voting round is already open', async () => {
    // Arrange – the open-rounds query returns a non-empty snapshot
    const { mockSet } = setupMocks({ openRoundsEmpty: false });

    // Act
    await openVotingRound();

    // Assert – no document should have been written
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does nothing when there are no nominated films', async () => {
    // Arrange
    const { mockSet } = setupMocks({ nominatedFilmsEmpty: true, nominatedFilmsSize: 0 });

    // Act
    await openVotingRound();

    // Assert
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does nothing when club config document does not exist', async () => {
    // Arrange
    const { mockSet } = setupMocks({ configExists: false });

    // Act
    await openVotingRound();

    // Assert
    expect(mockSet).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Happy-path: round creation
  // -------------------------------------------------------------------------

  it('creates a voting round with the correct candidateCount', async () => {
    // Arrange
    const { mockSet } = setupMocks({ nominatedFilmsSize: 5 });

    // Act
    await openVotingRound();

    // Assert
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ candidateCount: 5 })
    );
  });

  it('sets the voting round status to "open"', async () => {
    // Arrange
    const { mockSet } = setupMocks();

    // Act
    await openVotingRound();

    // Assert
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'open' })
    );
  });

  it('includes openedAt and createdAt timestamps when creating the round', async () => {
    // Arrange
    const { mockSet } = setupMocks();

    // Act
    await openVotingRound();

    // Assert
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        openedAt: expect.any(Date),
        createdAt: expect.any(Date),
      })
    );
  });

  // -------------------------------------------------------------------------
  // calculateNextCloseTime – exercised via openVotingRound behavior
  // -------------------------------------------------------------------------

  it('sets closesAt to the correct day of the week from votingSchedule.closeDay', async () => {
    // Arrange – close on Saturday (day 6), time 18:30
    // Use a fixed "now" on Monday 2026-03-16 (day 1) so we know the expected date.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-16T10:00:00.000Z')); // Monday UTC

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { closeDay: 6, closeTime: '18:30' },
      },
    });

    // Act
    await openVotingRound();

    // Assert – from Monday the next Saturday is +5 days → 2026-03-21
    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    expect(closesAt.getDay()).toBe(6); // Saturday
    expect(closesAt.getHours()).toBe(18);
    expect(closesAt.getMinutes()).toBe(30);

    jest.useRealTimers();
  });

  it('sets closesAt one week in the future when the close day has already passed this week', async () => {
    // Arrange – close on Monday (day 1); "now" is Wednesday (day 3).
    // The previous Monday already passed, so the next Monday is 5 days away.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-18T10:00:00.000Z')); // Wednesday

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { closeDay: 1, closeTime: '20:00' },
      },
    });

    // Act
    await openVotingRound();

    // Assert – next Monday from Wednesday is +5 days → 2026-03-23
    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    expect(closesAt.getDay()).toBe(1); // Monday
    // It must be strictly in the future relative to "now" (Wednesday)
    expect(closesAt.getTime()).toBeGreaterThan(new Date('2026-03-18T10:00:00.000Z').getTime());

    jest.useRealTimers();
  });

  it('sets closesAt one week in the future when close day is today but the time has already passed', async () => {
    // Arrange – close on Wednesday (day 3) at 09:00; "now" is Wednesday 10:00.
    // The configured time has already passed today, so it should roll over to next Wednesday.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-18T10:00:00.000Z')); // Wednesday 10:00 UTC

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { closeDay: 3, closeTime: '09:00' },
      },
    });

    // Act
    await openVotingRound();

    // Assert – closesAt should be next Wednesday (7 days later), not today
    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    expect(closesAt.getDay()).toBe(3); // still Wednesday
    // Must be more than 6 days ahead (i.e. next week's Wednesday)
    const sixDaysMs = 6 * 24 * 60 * 60 * 1000;
    expect(closesAt.getTime() - new Date('2026-03-18T10:00:00.000Z').getTime()).toBeGreaterThan(
      sixDaysMs
    );

    jest.useRealTimers();
  });

  it('sets closesAt hours and minutes to match the configured closeTime', async () => {
    // Arrange
    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { closeDay: 5, closeTime: '19:45' },
      },
    });

    // Act
    await openVotingRound();

    // Assert
    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    expect(closesAt.getHours()).toBe(19);
    expect(closesAt.getMinutes()).toBe(45);
    expect(closesAt.getSeconds()).toBe(0);
    expect(closesAt.getMilliseconds()).toBe(0);
  });

  it('calculates closesAt based on votingSchedule.closeDay and closeTime from config', async () => {
    // Arrange – use a fixed point in time so the result is deterministic
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-16T08:00:00.000Z')); // Monday

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { closeDay: 5, closeTime: '20:00' }, // Friday
      },
    });

    // Act
    await openVotingRound();

    // Assert – next Friday from Monday is +4 days
    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    expect(closesAt.getDay()).toBe(5); // Friday
    expect(closesAt.getHours()).toBe(20);
    expect(closesAt.getMinutes()).toBe(0);

    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('throws the error when an unexpected error occurs', async () => {
    // Arrange – make the very first Firestore call blow up
    (db.collection as jest.Mock).mockImplementation(() => {
      throw new Error('Firestore unavailable');
    });

    // Act & Assert
    await expect(openVotingRound()).rejects.toThrow('Firestore unavailable');
  });

  it('throws when the films query rejects', async () => {
    // Arrange
    (db.collection as jest.Mock).mockImplementation((collectionName: string) => {
      if (collectionName === 'votingRounds') {
        return {
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue(makeQuerySnapshot([], true)),
          doc: jest.fn(),
        };
      }
      if (collectionName === 'films') {
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockRejectedValue(new Error('Films query failed')),
        };
      }
      return undefined;
    });

    // Act & Assert
    await expect(openVotingRound()).rejects.toThrow('Films query failed');
  });
});
