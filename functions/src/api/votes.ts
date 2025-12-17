/**
 * Votes API Endpoints
 *
 * Thin Express route handlers using voting business logic
 */

import { Request, Response } from 'express';
import { db } from '../utils/db';
import { Ballot, FilmCandidate } from '../voting/types';

/**
 * GET /votes/current
 * Get current voting round information
 *
 * Response:
 * {
 *   isOpen: boolean,
 *   votingRound: {
 *     id: string,
 *     openedAt: Date,
 *     closesAt: Date,
 *     candidates: FilmCandidate[]
 *   } | null,
 *   userBallot: Ballot | null (if visitorId provided)
 * }
 */
export async function getCurrentVoting(req: Request, res: Response): Promise<void> {
  try {
    const visitorId = req.query.visitorId as string | undefined;

    // Get current voting round
    const roundsSnapshot = await db
      .collection('votingRounds')
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (roundsSnapshot.empty) {
      res.status(200).json({
        isOpen: false,
        votingRound: null,
        userBallot: null,
      });
      return;
    }

    const roundDoc = roundsSnapshot.docs[0];
    const roundData = roundDoc.data();

    // Get candidates (nominated films)
    const filmsSnapshot = await db
      .collection('films')
      .where('status', '==', 'nominated')
      .get();

    const candidates: FilmCandidate[] = filmsSnapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      addedBy: doc.data().addedBy,
    }));

    // Get user's ballot if visitorId provided
    let userBallot: Ballot | null = null;
    if (visitorId) {
      const ballotDoc = await db
        .collection('votingRounds')
        .doc(roundDoc.id)
        .collection('ballots')
        .doc(visitorId)
        .get();

      if (ballotDoc.exists) {
        const ballotData = ballotDoc.data()!;
        userBallot = {
          visitorId: ballotData.visitorId,
          votes: ballotData.votes,
          submittedAt: ballotData.submittedAt.toDate(),
        };
      }
    }

    res.status(200).json({
      isOpen: true,
      votingRound: {
        id: roundDoc.id,
        openedAt: roundData.openedAt.toDate(),
        closesAt: roundData.closesAt.toDate(),
        candidates,
      },
      userBallot,
    });
  } catch (error) {
    console.error('Get current voting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /votes
 * Submit or update a vote
 *
 * Request body:
 * {
 *   visitorId: string,
 *   votes: Vote[] // Array of { filmId: string, score: number (0-3) }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   ballot: Ballot
 * }
 */
export async function submitVote(req: Request, res: Response): Promise<void> {
  try {
    const { visitorId, votes } = req.body;

    // Validate input
    if (!visitorId || !Array.isArray(votes)) {
      res.status(400).json({ error: 'Invalid request. Provide visitorId and votes array.' });
      return;
    }

    // Validate vote scores
    for (const vote of votes) {
      if (!vote.filmId || typeof vote.score !== 'number') {
        res.status(400).json({ error: 'Each vote must have filmId and score' });
        return;
      }
      if (vote.score < 0 || vote.score > 3) {
        res.status(400).json({ error: 'Vote scores must be between 0 and 3' });
        return;
      }
    }

    // Get current open voting round
    const roundsSnapshot = await db
      .collection('votingRounds')
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (roundsSnapshot.empty) {
      res.status(400).json({ error: 'No voting round is currently open' });
      return;
    }

    const roundDoc = roundsSnapshot.docs[0];

    // Create ballot
    const ballot: Ballot = {
      visitorId,
      votes,
      submittedAt: new Date(),
    };

    // Save/update ballot
    await db
      .collection('votingRounds')
      .doc(roundDoc.id)
      .collection('ballots')
      .doc(visitorId)
      .set({
        visitorId: ballot.visitorId,
        votes: ballot.votes,
        submittedAt: ballot.submittedAt,
      });

    res.status(200).json({
      success: true,
      ballot,
    });
  } catch (error) {
    console.error('Submit vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /votes/results/latest
 * Get results of the latest completed voting round
 *
 * Response:
 * {
 *   results: VotingResults | null,
 *   votingRound: {
 *     id: string,
 *     openedAt: Date,
 *     closedAt: Date
 *   } | null
 * }
 */
export async function getLatestResults(req: Request, res: Response): Promise<void> {
  try {
    // Get most recent closed voting round
    const roundsSnapshot = await db
      .collection('votingRounds')
      .where('status', '==', 'closed')
      .orderBy('closedAt', 'desc')
      .limit(1)
      .get();

    if (roundsSnapshot.empty) {
      res.status(200).json({
        results: null,
        votingRound: null,
      });
      return;
    }

    const roundDoc = roundsSnapshot.docs[0];
    const roundData = roundDoc.data();

    // Get stored results
    const resultsDoc = await db
      .collection('votingRounds')
      .doc(roundDoc.id)
      .collection('metadata')
      .doc('results')
      .get();

    if (!resultsDoc.exists) {
      res.status(500).json({ error: 'Results not found for closed round' });
      return;
    }

    const results = resultsDoc.data();

    res.status(200).json({
      results,
      votingRound: {
        id: roundDoc.id,
        openedAt: roundData.openedAt.toDate(),
        closedAt: roundData.closedAt.toDate(),
      },
    });
  } catch (error) {
    console.error('Get latest results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
