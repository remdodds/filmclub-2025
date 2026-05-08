/**
 * Close Voting Scheduled Function
 *
 * Cloud Scheduler triggers this function to close voting and determine winner
 * Schedule: Configured based on club's voting schedule (e.g., Saturday 8pm)
 */

import { DateTime } from 'luxon';
import { db } from '../utils/db';
import { getDefaultAlgorithm } from '../voting/index';
import { Ballot, FilmCandidate, VotingResults } from '../voting/types';
import { markFilmAsWatched, Film } from '../films/films.logic';
import { archiveVotingRound } from '../history/votingHistory';

const TIMEZONE = 'Europe/London';

/**
 * Returns true if the configured close time has passed within the last 60 minutes.
 * Called hourly by the scheduler; actual close day/time is read from club config.
 */
export function shouldCloseVoting(closeDay: number, closeTime: string, now: DateTime): boolean {
  const [closeHour, closeMinute] = closeTime.split(':').map(Number);
  // Luxon weekday: 1=Mon..7=Sun → JS day: 0=Sun..6=Sat
  const nowJsDay = now.weekday % 7;
  const daysAgo = (nowJsDay - closeDay + 7) % 7;
  const scheduledClose = now
    .minus({ days: daysAgo })
    .set({ hour: closeHour, minute: closeMinute, second: 0, millisecond: 0 });
  const minutesSince = now.diff(scheduledClose, 'minutes').minutes;
  return minutesSince >= 0 && minutesSince < 60;
}

/**
 * Reads the club config, checks whether it is the configured close time in London,
 * then delegates to closeVotingRound(). Called by the hourly Cloud Scheduler.
 */
export async function tryCloseVotingRound(): Promise<void> {
  const configDoc = await db.collection('config').doc('club').get();
  if (!configDoc.exists) {
    console.error('Club not configured. Cannot check voting schedule.');
    return;
  }

  const config = configDoc.data()!;
  const { closeDay, closeTime } = config.votingSchedule;

  const now = DateTime.now().setZone(TIMEZONE);
  if (!shouldCloseVoting(closeDay, closeTime, now)) {
    console.log(`Not the scheduled close time (configured: day ${closeDay} ${closeTime}). Skipping.`);
    return;
  }

  await closeVotingRound();
}

/**
 * Closes the current voting round and determines the winner
 *
 * This function:
 * 1. Gets the current open voting round
 * 2. Retrieves all ballots
 * 3. Gets all candidate films
 * 4. Runs the Condorcet algorithm to determine winner
 * 5. Marks winning film as watched
 * 6. Removes winner from nominations
 * 7. Stores results
 * 8. Closes the voting round
 * 9. Archives the voting round to history collection
 */
export async function closeVotingRound(): Promise<void> {
  try {
    console.log('Closing voting round...');

    // Get current open voting round
    const openRounds = await db
      .collection('votingRounds')
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (openRounds.empty) {
      console.log('No open voting round to close.');
      return;
    }

    const roundDoc = openRounds.docs[0];
    const roundId = roundDoc.id;
    console.log(`Closing voting round: ${roundId}`);

    // Get all ballots for this round
    const ballotsSnapshot = await db
      .collection('votingRounds')
      .doc(roundId)
      .collection('ballots')
      .get();

    const ballots: Ballot[] = ballotsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        visitorId: data.visitorId,
        votes: data.votes,
        submittedAt: data.submittedAt.toDate(),
      };
    });

    console.log(`Found ${ballots.length} ballots`);

    // Get candidate films
    const filmsSnapshot = await db
      .collection('films')
      .where('status', '==', 'nominated')
      .get();

    const candidates: FilmCandidate[] = filmsSnapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      addedBy: doc.data().addedBy,
    }));

    console.log(`Found ${candidates.length} candidates`);

    // Calculate winner using Condorcet algorithm
    const algorithm = getDefaultAlgorithm();
    let results: VotingResults = algorithm.calculateWinner(ballots, candidates);

    // If no votes were cast but there are nominated films, pick one at random
    if (!results.winner && candidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      const randomWinner = candidates[randomIndex];
      results = { ...results, winner: randomWinner.id, condorcetWinner: false };
      console.log(`No votes cast - randomly selected winner: ${randomWinner.title}`);
    }

    console.log(`Winner: ${results.winner || 'None'}`);
    console.log(`Condorcet winner: ${results.condorcetWinner}`);

    // If there's a winner, mark film as watched and remove from nominations
    if (results.winner) {
      const winningFilmDoc = await db.collection('films').doc(results.winner).get();

      if (winningFilmDoc.exists) {
        const filmData = winningFilmDoc.data()!;
        const film: Film = {
          id: winningFilmDoc.id,
          title: filmData.title,
          addedBy: filmData.addedBy,
          addedAt: filmData.addedAt.toDate(),
          status: filmData.status,
        };

        // Mark as watched
        const watchedFilm = markFilmAsWatched(film);

        // Update in Firestore
        await db.collection('films').doc(results.winner).update({
          status: 'watched',
          watchedAt: watchedFilm.watchedAt,
        });

        console.log(`Marked "${film.title}" as watched`);
      }
    }

    // Store results
    await db
      .collection('votingRounds')
      .doc(roundId)
      .collection('metadata')
      .doc('results')
      .set({
        ...results,
        calculatedAt: new Date(),
      });

    // Close the voting round
    await db.collection('votingRounds').doc(roundId).update({
      status: 'closed',
      closedAt: new Date(),
      winner: results.winner,
      condorcetWinner: results.condorcetWinner,
      totalBallots: results.totalBallots,
    });

    console.log('Voting round closed successfully');

    // Archive voting round to history collection
    try {
      await archiveVotingRound(roundId);
      console.log('Voting round archived to history');
    } catch (archiveError) {
      console.error('Error archiving voting round:', archiveError);
      // Don't throw - we don't want to fail the close if archival fails
    }
  } catch (error) {
    console.error('Error closing voting round:', error);
    throw error;
  }
}
