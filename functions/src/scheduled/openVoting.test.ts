import { DateTime } from 'luxon';
import { openVotingRound, shouldOpenVoting, tryOpenVotingRound } from './openVoting';
import { db } from '../utils/db';

jest.mock('../utils/db', () => ({ db: { collection: jest.fn() } }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuerySnapshot(docs: object[], empty?: boolean) {
  return {
    empty: empty !== undefined ? empty : docs.length === 0,
    size: docs.length,
    docs,
  };
}

function makeDocSnapshot(exists: boolean, data?: object) {
  return {
    exists,
    data: () => data,
  };
}

const DEFAULT_CONFIG = {
  votingSchedule: {
    openDay: 5,   // Friday
    openTime: '18:00',
    closeDay: 6,  // Saturday
    closeTime: '20:00',
  },
};

interface SetupOptions {
  openRoundsEmpty?: boolean;
  nominatedFilmsEmpty?: boolean;
  nominatedFilmsSize?: number;
  configExists?: boolean;
  configData?: object;
  mockSet?: jest.Mock;
  mockDocFn?: jest.Mock;
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
// openVotingRound — early-exit guard conditions
// ---------------------------------------------------------------------------

describe('openVotingRound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when a voting round is already open', async () => {
    const { mockSet } = setupMocks({ openRoundsEmpty: false });
    await openVotingRound();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does nothing when there are no nominated films', async () => {
    const { mockSet } = setupMocks({ nominatedFilmsEmpty: true, nominatedFilmsSize: 0 });
    await openVotingRound();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does nothing when club config document does not exist', async () => {
    const { mockSet } = setupMocks({ configExists: false });
    await openVotingRound();
    expect(mockSet).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Happy-path: round creation
  // -------------------------------------------------------------------------

  it('creates a voting round with the correct candidateCount', async () => {
    const { mockSet } = setupMocks({ nominatedFilmsSize: 5 });
    await openVotingRound();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ candidateCount: 5 })
    );
  });

  it('sets the voting round status to "open"', async () => {
    const { mockSet } = setupMocks();
    await openVotingRound();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'open' })
    );
  });

  it('includes openedAt and createdAt timestamps when creating the round', async () => {
    const { mockSet } = setupMocks();
    await openVotingRound();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        openedAt: expect.any(Date),
        createdAt: expect.any(Date),
      })
    );
  });

  // -------------------------------------------------------------------------
  // calculateNextCloseTime — exercised via openVotingRound
  // -------------------------------------------------------------------------

  it('sets closesAt to the correct day of the week from votingSchedule.closeDay', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-16T10:00:00.000Z')); // Monday UTC (GMT period)

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { openDay: 1, openTime: '10:00', closeDay: 6, closeTime: '18:30' },
      },
    });

    await openVotingRound();

    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    expect(closesAt.getDay()).toBe(6); // Saturday
    expect(closesAt.getUTCHours()).toBe(18); // GMT period: London == UTC
    expect(closesAt.getUTCMinutes()).toBe(30);

    jest.useRealTimers();
  });

  it('sets closesAt one week in the future when the close day has already passed this week', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-18T10:00:00.000Z')); // Wednesday (GMT period)

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { openDay: 3, openTime: '10:00', closeDay: 1, closeTime: '20:00' },
      },
    });

    await openVotingRound();

    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    expect(closesAt.getDay()).toBe(1); // Monday
    expect(closesAt.getTime()).toBeGreaterThan(new Date('2026-03-18T10:00:00.000Z').getTime());

    jest.useRealTimers();
  });

  it('sets closesAt one week in the future when close day is today but the time has already passed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-18T10:00:00.000Z')); // Wednesday 10:00 UTC (GMT)

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { openDay: 3, openTime: '10:00', closeDay: 3, closeTime: '09:00' },
      },
    });

    await openVotingRound();

    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    expect(closesAt.getDay()).toBe(3); // still Wednesday
    const sixDaysMs = 6 * 24 * 60 * 60 * 1000;
    expect(closesAt.getTime() - new Date('2026-03-18T10:00:00.000Z').getTime()).toBeGreaterThan(
      sixDaysMs
    );

    jest.useRealTimers();
  });

  it('sets closesAt hours and minutes to match the configured closeTime (GMT period)', async () => {
    // Use a winter date so GMT is in effect (London == UTC)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-05T10:00:00.000Z')); // Monday in GMT

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { openDay: 5, openTime: '18:00', closeDay: 5, closeTime: '19:45' },
      },
    });

    await openVotingRound();

    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    // During GMT, UTC hours == London hours
    expect(closesAt.getUTCHours()).toBe(19);
    expect(closesAt.getUTCMinutes()).toBe(45);
    expect(closesAt.getUTCSeconds()).toBe(0);
    expect(closesAt.getUTCMilliseconds()).toBe(0);

    jest.useRealTimers();
  });

  it('calculates closesAt based on votingSchedule.closeDay and closeTime from config', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-16T08:00:00.000Z')); // Monday (GMT period)

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { openDay: 1, openTime: '08:00', closeDay: 5, closeTime: '20:00' },
      },
    });

    await openVotingRound();

    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    expect(closesAt.getDay()).toBe(5); // Friday
    expect(closesAt.getUTCHours()).toBe(20); // GMT: UTC == London
    expect(closesAt.getUTCMinutes()).toBe(0);

    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // BST timezone correctness
  // -------------------------------------------------------------------------

  it('returns a UTC close time that accounts for the BST offset (UTC+1)', async () => {
    // 2026-04-30T19:00:00Z = 20:00 BST (Thursday evening in London)
    // Close day = Saturday (6), closeTime = '20:00' London = 19:00 UTC during BST
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-30T19:00:00.000Z'));

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { openDay: 5, openTime: '18:00', closeDay: 6, closeTime: '20:00' },
      },
    });

    await openVotingRound();

    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    // Saturday 2026-05-02 20:00 BST = 2026-05-02T19:00:00.000Z
    expect(closesAt.toISOString()).toBe('2026-05-02T19:00:00.000Z');

    jest.useRealTimers();
  });

  it('uses London day-of-week (not UTC) when UTC date and London date differ near midnight', async () => {
    // 2026-04-30T23:30:00Z = 2026-05-01T00:30:00 BST → Friday in London, Thursday in UTC
    // Close day = Saturday (6), so from London's Friday it's 1 day away
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-30T23:30:00.000Z'));

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { openDay: 5, openTime: '18:00', closeDay: 6, closeTime: '20:00' },
      },
    });

    await openVotingRound();

    const callArg = mockSet.mock.calls[0][0];
    const closesAt: Date = callArg.closesAt;
    // Saturday 2026-05-02 20:00 BST = 2026-05-02T19:00:00.000Z
    expect(closesAt.toISOString()).toBe('2026-05-02T19:00:00.000Z');

    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('throws the error when an unexpected error occurs', async () => {
    (db.collection as jest.Mock).mockImplementation(() => {
      throw new Error('Firestore unavailable');
    });

    await expect(openVotingRound()).rejects.toThrow('Firestore unavailable');
  });

  it('throws when the films query rejects', async () => {
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

    await expect(openVotingRound()).rejects.toThrow('Films query failed');
  });
});

// ---------------------------------------------------------------------------
// shouldOpenVoting
// ---------------------------------------------------------------------------

describe('shouldOpenVoting', () => {
  const london = (iso: string) => DateTime.fromISO(iso, { zone: 'Europe/London' });

  it('returns true when day and hour match the configured open time', () => {
    // Friday (JS day 5) at 18:00 London
    const now = london('2026-05-01T18:30:00'); // Friday BST
    expect(shouldOpenVoting(5, '18:00', now)).toBe(true);
  });

  it('returns false when the day is correct but the hour does not match', () => {
    const now = london('2026-05-01T17:30:00'); // Friday, but 17:xx not 18:xx
    expect(shouldOpenVoting(5, '18:00', now)).toBe(false);
  });

  it('returns false when the hour is correct but the day does not match', () => {
    const now = london('2026-04-30T18:30:00'); // Thursday, not Friday
    expect(shouldOpenVoting(5, '18:00', now)).toBe(false);
  });

  it('returns false when neither day nor hour match', () => {
    const now = london('2026-04-29T10:00:00'); // Wednesday at 10:xx
    expect(shouldOpenVoting(5, '18:00', now)).toBe(false);
  });

  it('handles Sunday (JS day 0) correctly using Luxon weekday 7', () => {
    // 2026-05-03 is a Sunday
    const now = london('2026-05-03T12:00:00');
    expect(shouldOpenVoting(0, '12:00', now)).toBe(true);
  });

  it('handles Saturday (JS day 6) correctly', () => {
    // 2026-05-02 is a Saturday
    const now = london('2026-05-02T09:00:00');
    expect(shouldOpenVoting(6, '09:00', now)).toBe(true);
  });

  it('works correctly with BST in effect — uses London hour not UTC hour', () => {
    // 2026-05-01T17:00:00Z = 18:00 BST (Friday)
    const now = DateTime.fromISO('2026-05-01T17:00:00Z').setZone('Europe/London');
    expect(shouldOpenVoting(5, '18:00', now)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tryOpenVotingRound — timing gate
// ---------------------------------------------------------------------------

describe('tryOpenVotingRound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens a round when the current London time matches openDay and openTime', async () => {
    // Friday (day 5) at 18:xx BST → 17:xx UTC
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T17:00:00.000Z')); // 18:00 BST Friday

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { openDay: 5, openTime: '18:00', closeDay: 6, closeTime: '20:00' },
      },
    });

    await tryOpenVotingRound();

    expect(mockSet).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('does not open a round when the current hour does not match openTime', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T16:00:00.000Z')); // 17:00 BST Friday — too early

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { openDay: 5, openTime: '18:00', closeDay: 6, closeTime: '20:00' },
      },
    });

    await tryOpenVotingRound();

    expect(mockSet).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('does not open a round when the day does not match openDay', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-30T17:00:00.000Z')); // 18:00 BST Thursday — wrong day

    const { mockSet } = setupMocks({
      configData: {
        votingSchedule: { openDay: 5, openTime: '18:00', closeDay: 6, closeTime: '20:00' },
      },
    });

    await tryOpenVotingRound();

    expect(mockSet).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('does nothing when club config document does not exist', async () => {
    const { mockSet } = setupMocks({ configExists: false });

    await tryOpenVotingRound();

    expect(mockSet).not.toHaveBeenCalled();
  });
});
