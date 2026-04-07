/**
 * Admin API Endpoints
 *
 * Public admin endpoints for viewing current votes and triggering winner selection.
 * No authentication required - visible to everyone.
 */

import { Request, Response } from 'express';
import { db } from '../utils/db';
import { FilmCandidate, Ballot } from '../voting/types';
import { closeVotingRound } from '../scheduled/closeVoting';
import { openVotingRound } from '../scheduled/openVoting';

/**
 * GET /admin/votes
 * Get votes cast in the current open voting round
 *
 * Response:
 * {
 *   isOpen: boolean,
 *   votingRound: { id, openedAt, closesAt } | null,
 *   candidates: FilmCandidate[],
 *   ballots: { visitorId, votes, submittedAt }[],
 *   totalBallots: number
 * }
 */
export async function getAdminVotes(req: Request, res: Response): Promise<void> {
  try {
    // Always fetch nominated films
    const filmsSnapshot = await db
      .collection('films')
      .where('status', '==', 'nominated')
      .get();

    const candidates: FilmCandidate[] = filmsSnapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      addedBy: doc.data().addedBy,
    }));

    // Get current open voting round
    const roundsSnapshot = await db
      .collection('votingRounds')
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (roundsSnapshot.empty) {
      res.status(200).json({
        isOpen: false,
        votingRound: null,
        candidates,
        ballots: [],
        totalBallots: 0,
      });
      return;
    }

    const roundDoc = roundsSnapshot.docs[0];
    const roundData = roundDoc.data();

    // Get all ballots for this round
    const ballotsSnapshot = await db
      .collection('votingRounds')
      .doc(roundDoc.id)
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

    res.status(200).json({
      isOpen: true,
      votingRound: {
        id: roundDoc.id,
        openedAt: roundData.openedAt.toDate(),
        closesAt: roundData.closesAt.toDate(),
      },
      candidates,
      ballots,
      totalBallots: ballots.length,
    });
  } catch (error) {
    console.error('Get admin votes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /admin/open-round
 * Open a new voting round
 *
 * Response:
 * { success: true, message: string }
 */
export async function openRound(req: Request, res: Response): Promise<void> {
  try {
    // Check if there's already an open round
    const openRounds = await db
      .collection('votingRounds')
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (!openRounds.empty) {
      res.status(400).json({ error: 'A voting round is already open' });
      return;
    }

    // Check there are films to vote on
    const filmsSnapshot = await db
      .collection('films')
      .where('status', '==', 'nominated')
      .limit(1)
      .get();

    if (filmsSnapshot.empty) {
      res.status(400).json({ error: 'No nominated films to vote on' });
      return;
    }

    await openVotingRound();
    res.status(200).json({ success: true, message: 'Voting round opened' });
  } catch (error: any) {
    console.error('Open round error:', error);
    res.status(500).json({ error: error.message || 'Failed to open voting round' });
  }
}

/**
 * POST /admin/select-winner
 * Trigger the winner selection algorithm (closes the current voting round)
 *
 * Response:
 * { success: true, message: string }
 */
export async function selectWinner(req: Request, res: Response): Promise<void> {
  try {
    await closeVotingRound();
    res.status(200).json({ success: true, message: 'Winner selected and voting round closed' });
  } catch (error: any) {
    console.error('Select winner error:', error);
    res.status(500).json({ error: error.message || 'Failed to select winner' });
  }
}

/**
 * DELETE /admin/clear-films
 * Delete all nominated films. Blocked when a voting round is open.
 *
 * Response:
 * { success: true, message: string, count: number }
 */
export async function clearNominatedFilms(req: Request, res: Response): Promise<void> {
  try {
    const openRounds = await db
      .collection('votingRounds')
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (!openRounds.empty) {
      res.status(400).json({ error: 'Cannot clear films while a voting round is open' });
      return;
    }

    const filmsSnapshot = await db
      .collection('films')
      .where('status', '==', 'nominated')
      .get();

    if (filmsSnapshot.empty) {
      res.status(200).json({ success: true, message: 'No nominated films to clear', count: 0 });
      return;
    }

    const batch = db.batch();
    filmsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    res.status(200).json({
      success: true,
      message: `Cleared ${filmsSnapshot.size} nominated film${filmsSnapshot.size === 1 ? '' : 's'}`,
      count: filmsSnapshot.size,
    });
  } catch (error) {
    console.error('Clear nominated films error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /admin/history/:roundId
 * Delete a voting history record.
 *
 * Response:
 * { success: true, message: string }
 */
export async function deleteHistoryRecord(req: Request, res: Response): Promise<void> {
  try {
    const { roundId } = req.params;
    const docRef = db.collection('votingHistory').doc(roundId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: 'History record not found' });
      return;
    }

    await docRef.delete();
    res.status(200).json({ success: true, message: 'History record deleted' });
  } catch (error) {
    console.error('Delete history record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /admin/history/:roundId
 * Update the winner title on a voting history record.
 *
 * Body: { winnerTitle: string }
 *
 * Response:
 * { success: true, message: string }
 */
export async function updateHistoryRecord(req: Request, res: Response): Promise<void> {
  try {
    const { roundId } = req.params;
    const { winnerTitle } = req.body;

    if (typeof winnerTitle !== 'string' || !winnerTitle.trim()) {
      res.status(400).json({ error: 'winnerTitle is required' });
      return;
    }

    const docRef = db.collection('votingHistory').doc(roundId);
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: 'History record not found' });
      return;
    }

    if (!doc.data()?.winner) {
      res.status(400).json({ error: 'This record has no winner to edit' });
      return;
    }

    await docRef.update({ 'winner.title': winnerTitle.trim() });
    res.status(200).json({ success: true, message: 'Winner title updated' });
  } catch (error) {
    console.error('Update history record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
