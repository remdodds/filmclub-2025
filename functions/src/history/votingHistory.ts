/**
 * Voting History Management
 *
 * Handles archiving and retrieval of completed voting rounds
 * for display on the history page.
 */

import { db } from '../utils/db';
import { VotingResults, FilmRanking, PairwiseComparison } from '../voting/types';

/**
 * Voting history record stored in Firestore
 * Contains denormalized data with film titles embedded for easy display
 */
export interface VotingHistoryRecord {
  roundId: string;
  openedAt: Date;
  closedAt: Date;
  totalBallots: number;
  candidateCount: number;
  winner: {
    filmId: string;
    title: string;
    nominatedBy: string;
  } | null;
  condorcetWinner: boolean;
  algorithm: string;
  rankings: RankingWithFilmInfo[];
  pairwiseComparisons: PairwiseComparison[];
  archivedAt: Date;
}

/**
 * Film ranking with embedded film information
 */
export interface RankingWithFilmInfo extends FilmRanking {
  title: string;
  nominatedBy?: string;
}

/**
 * Archives a completed voting round to the votingHistory collection
 *
 * This function should be called after a voting round is closed.
 * It creates a denormalized record with all film titles embedded
 * for efficient retrieval on the history page.
 *
 * @param roundId - ID of the voting round to archive
 * @throws Error if voting round or results not found
 */
export async function archiveVotingRound(roundId: string): Promise<void> {
  // Get voting round document
  const roundDoc = await db.collection('votingRounds').doc(roundId).get();

  if (!roundDoc.exists) {
    throw new Error('Voting round not found');
  }

  const roundData = roundDoc.data()!;

  // Get voting results
  const resultsDoc = await db
    .collection('votingRounds')
    .doc(roundId)
    .collection('metadata')
    .doc('results')
    .get();

  if (!resultsDoc.exists) {
    throw new Error('Voting results not found');
  }

  const results = resultsDoc.data() as VotingResults;

  // Get all film IDs from rankings
  const filmIds = results.rankings.map((r) => r.filmId);

  // Fetch film details for all films in the rankings
  const filmDetailsMap = new Map<string, { title: string; addedBy: string }>();

  if (filmIds.length > 0) {
    // Firestore 'in' query supports up to 10 items, so we need to batch if more
    const batchSize = 10;
    for (let i = 0; i < filmIds.length; i += batchSize) {
      const batch = filmIds.slice(i, i + batchSize);
      const filmsSnapshot = await db
        .collection('films')
        .where('__name__', 'in', batch)
        .get();

      filmsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        filmDetailsMap.set(doc.id, {
          title: data.title,
          addedBy: data.addedBy,
        });
      });
    }
  }

  // Build rankings with film info
  const rankingsWithFilmInfo: RankingWithFilmInfo[] = results.rankings.map((ranking) => {
    const filmDetails = filmDetailsMap.get(ranking.filmId);
    return {
      ...ranking,
      title: filmDetails?.title || 'Unknown Film',
      nominatedBy: filmDetails?.addedBy,
    };
  });

  // Build winner object
  let winner = null;
  if (results.winner) {
    const winnerDetails = filmDetailsMap.get(results.winner);
    winner = {
      filmId: results.winner,
      title: winnerDetails?.title || 'Unknown Film',
      nominatedBy: winnerDetails?.addedBy || 'Unknown',
    };
  }

  // Helper to convert Firestore timestamp or Date to Date
  const toDate = (value: any): Date => {
    if (value instanceof Date) {
      return value;
    }
    if (value && typeof value.toDate === 'function') {
      return value.toDate();
    }
    return value;
  };

  // Create history record
  const historyRecord: VotingHistoryRecord = {
    roundId,
    openedAt: toDate(roundData.openedAt),
    closedAt: toDate(roundData.closedAt),
    totalBallots: results.totalBallots,
    candidateCount: roundData.candidateCount,
    winner,
    condorcetWinner: results.condorcetWinner,
    algorithm: results.algorithm,
    rankings: rankingsWithFilmInfo,
    pairwiseComparisons: results.pairwiseComparisons,
    archivedAt: new Date(),
  };

  // Store in votingHistory collection
  await db.collection('votingHistory').doc(roundId).set(historyRecord);
}

/**
 * Retrieves voting history records ordered by most recent first
 *
 * @param limit - Maximum number of records to return (default: 50)
 * @returns Array of voting history records
 */
export async function getVotingHistory(
  limit: number = 50
): Promise<VotingHistoryRecord[]> {
  const snapshot = await db
    .collection('votingHistory')
    .orderBy('closedAt', 'desc')
    .limit(limit)
    .get();

  // Helper to convert Firestore timestamp or Date to Date
  const toDate = (value: any): Date => {
    if (value instanceof Date) {
      return value;
    }
    if (value && typeof value.toDate === 'function') {
      return value.toDate();
    }
    return value;
  };

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      openedAt: toDate(data.openedAt),
      closedAt: toDate(data.closedAt),
      archivedAt: toDate(data.archivedAt),
    } as VotingHistoryRecord;
  });
}
