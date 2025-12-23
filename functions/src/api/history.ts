/**
 * Voting History API Endpoints
 *
 * Thin Express route handlers for voting history retrieval
 */

import { Request, Response } from 'express';
import { getVotingHistory } from '../history/votingHistory';

/**
 * GET /history
 * Get voting history ordered by most recent first
 *
 * Query Parameters:
 * - limit: number (optional, default 50, max 100) - number of records to return
 *
 * Response:
 * {
 *   history: VotingHistoryRecord[]
 * }
 */
export async function getHistory(req: Request, res: Response): Promise<void> {
  try {
    // Parse and validate limit parameter
    const limitParam = req.query.limit as string | undefined;
    let limit = 50; // default

    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 100); // cap at 100
      }
    }

    // Fetch history
    const history = await getVotingHistory(limit);

    res.status(200).json({ history });
  } catch (error) {
    console.error('Get voting history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
