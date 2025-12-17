/**
 * Open Voting Scheduled Function
 *
 * Cloud Scheduler triggers this function to open a new voting round
 * Schedule: Configured based on club's voting schedule (e.g., Friday 6pm)
 */

import { db } from '../utils/db';

/**
 * Opens a new voting round
 *
 * This function:
 * 1. Checks if there's already an open voting round
 * 2. Gets nominated films to use as candidates
 * 3. Creates a new voting round document
 * 4. Calculates when voting should close based on club config
 */
export async function openVotingRound(): Promise<void> {
  try {
    console.log('Opening new voting round...');

    // Check if there's already an open round
    const openRounds = await db
      .collection('votingRounds')
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (!openRounds.empty) {
      console.log('Voting round already open. Skipping.');
      return;
    }

    // Get nominated films
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

    // Get club config for close time
    const configDoc = await db.collection('config').doc('club').get();
    if (!configDoc.exists) {
      console.error('Club not configured. Cannot open voting.');
      return;
    }

    const config = configDoc.data()!;
    const { votingSchedule } = config;

    // Calculate close time
    // This is a simple implementation - in production you'd want to use a proper
    // timezone library to handle DST and edge cases
    const now = new Date();
    const closesAt = calculateNextCloseTime(
      now,
      votingSchedule.closeDay,
      votingSchedule.closeTime
    );

    // Create voting round
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
 * Calculate the next close time based on day and time
 * @param from - Starting date/time
 * @param closeDay - Day of week (0-6, Sunday-Saturday)
 * @param closeTime - Time in HH:mm format
 * @returns Date when voting should close
 */
function calculateNextCloseTime(from: Date, closeDay: number, closeTime: string): Date {
  const [hours, minutes] = closeTime.split(':').map(Number);

  const result = new Date(from);
  result.setHours(hours, minutes, 0, 0);

  // Calculate days until close day
  const currentDay = from.getDay();
  let daysUntilClose = closeDay - currentDay;

  // If close day is before current day, or same day but time has passed, go to next week
  if (daysUntilClose < 0 || (daysUntilClose === 0 && result <= from)) {
    daysUntilClose += 7;
  }

  result.setDate(result.getDate() + daysUntilClose);

  return result;
}
