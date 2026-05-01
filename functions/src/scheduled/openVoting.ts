import { DateTime } from 'luxon';
import { db } from '../utils/db';

const TIMEZONE = 'Europe/London';

export async function openVotingRound(): Promise<void> {
  try {
    console.log('Opening new voting round...');

    const openRounds = await db
      .collection('votingRounds')
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (!openRounds.empty) {
      console.log('Voting round already open. Skipping.');
      return;
    }

    const filmsSnapshot = await db
      .collection('films')
      .where('status', '==', 'nominated')
      .get();

    if (filmsSnapshot.empty) {
      console.log('No nominated films. Skipping voting round.');
      return;
    }

    const candidateCount = filmsSnapshot.size;
    console.log(`Found ${candidateCount} nominated films`);

    const configDoc = await db.collection('config').doc('club').get();
    if (!configDoc.exists) {
      console.error('Club not configured. Cannot open voting.');
      return;
    }

    const config = configDoc.data()!;
    const { votingSchedule } = config;

    const now = new Date();
    const closesAt = calculateNextCloseTime(now, votingSchedule.closeDay, votingSchedule.closeTime);

    const roundRef = db.collection('votingRounds').doc();
    await roundRef.set({
      status: 'open',
      openedAt: now,
      closesAt,
      candidateCount,
      createdAt: now,
    });

    console.log(`Voting round opened: ${roundRef.id}`);
    console.log(`Closes at: ${closesAt.toISOString()}`);
  } catch (error) {
    console.error('Error opening voting round:', error);
    throw error;
  }
}

/**
 * Returns true if the current London time matches the configured open day and hour.
 * Called hourly by the scheduler; we match on day + hour so the schedule is config-driven.
 */
export function shouldOpenVoting(openDay: number, openTime: string, now: DateTime): boolean {
  const [openHour] = openTime.split(':').map(Number);
  // Luxon weekday: 1=Mon..7=Sun → convert to JS convention: 0=Sun..6=Sat
  const nowJsDay = now.weekday % 7;
  return nowJsDay === openDay && now.hour === openHour;
}

/**
 * Reads the club config, checks whether it is the configured open time in London,
 * then delegates to openVotingRound(). Called by the hourly Cloud Scheduler.
 */
export async function tryOpenVotingRound(): Promise<void> {
  const configDoc = await db.collection('config').doc('club').get();
  if (!configDoc.exists) {
    console.error('Club not configured. Cannot check voting schedule.');
    return;
  }

  const config = configDoc.data()!;
  const { openDay, openTime } = config.votingSchedule;

  const now = DateTime.now().setZone(TIMEZONE);
  if (!shouldOpenVoting(openDay, openTime, now)) {
    console.log(`Not the scheduled open time (configured: day ${openDay} ${openTime}). Skipping.`);
    return;
  }

  await openVotingRound();
}

/**
 * Calculates the next close time in UTC, interpreting closeDay and closeTime as
 * Europe/London local time (handles GMT/BST correctly).
 *
 * @param from - reference point (now)
 * @param closeDay - 0-6 (JS convention: 0=Sun, 6=Sat) in London timezone
 * @param closeTime - HH:mm in London timezone
 */
function calculateNextCloseTime(from: Date, closeDay: number, closeTime: string): Date {
  const [closeHours, closeMinutes] = closeTime.split(':').map(Number);

  const fromDt = DateTime.fromJSDate(from, { zone: TIMEZONE });
  // Luxon weekday: 1=Mon..7=Sun → JS day: 0=Sun..6=Sat
  const fromJsDay = fromDt.weekday % 7;

  const daysUntilClose = closeDay - fromJsDay;

  let candidate = fromDt
    .plus({ days: daysUntilClose })
    .set({ hour: closeHours, minute: closeMinutes, second: 0, millisecond: 0 });

  if (candidate <= fromDt) {
    candidate = candidate.plus({ weeks: 1 });
  }

  return candidate.toJSDate();
}
