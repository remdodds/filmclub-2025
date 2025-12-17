/**
 * Condorcet Voting Algorithm Implementation
 *
 * The Condorcet method selects the candidate that would win a head-to-head
 * election against each of the other candidates. If no such candidate exists
 * (Condorcet paradox), we use total score as a tiebreaker.
 */

import {
  Ballot,
  FilmCandidate,
  VotingResults,
  VotingAlgorithm,
  PairwiseComparison,
  FilmRanking,
} from './types';

export class CondorcetVoting implements VotingAlgorithm {
  name = 'Condorcet';
  description =
    'Selects the film that would beat every other film in head-to-head comparisons. Uses total score as tiebreaker if no clear winner exists.';

  calculateWinner(ballots: Ballot[], candidates: FilmCandidate[]): VotingResults {
    // Handle edge case: no ballots
    if (ballots.length === 0) {
      return {
        winner: null,
        condorcetWinner: false,
        rankings: [],
        pairwiseComparisons: [],
        totalBallots: 0,
        algorithm: this.name,
      };
    }

    // Handle edge case: single candidate
    if (candidates.length === 1) {
      const candidate = candidates[0];
      const totalScore = this.calculateTotalScore(candidate.id, ballots);

      return {
        winner: candidate.id,
        condorcetWinner: true,
        rankings: [
          {
            filmId: candidate.id,
            rank: 1,
            totalScore,
            averageScore: totalScore / ballots.length,
            pairwiseWins: 0,
            pairwiseLosses: 0,
          },
        ],
        pairwiseComparisons: [],
        totalBallots: ballots.length,
        algorithm: this.name,
      };
    }

    // Calculate all pairwise comparisons
    const pairwiseComparisons = this.calculatePairwiseComparisons(candidates, ballots);

    // Calculate pairwise wins for each candidate
    const pairwiseWinCounts = this.calculatePairwiseWins(candidates, pairwiseComparisons);

    // Create rankings with scores
    const rankings = this.createRankings(candidates, ballots, pairwiseWinCounts);

    // Sort rankings by pairwise wins (descending), then by total score (descending)
    rankings.sort((a, b) => {
      if (b.pairwiseWins !== a.pairwiseWins) {
        return b.pairwiseWins - a.pairwiseWins;
      }
      return b.totalScore - a.totalScore;
    });

    // Assign ranks
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    // Determine winner and if it's a Condorcet winner
    const topRanking = rankings[0];
    const winner = topRanking.filmId;

    // A Condorcet winner must beat all other candidates
    const isCondorcetWinner = topRanking.pairwiseWins === candidates.length - 1;

    return {
      winner,
      condorcetWinner: isCondorcetWinner,
      rankings,
      pairwiseComparisons,
      totalBallots: ballots.length,
      algorithm: this.name,
    };
  }

  /**
   * Calculate all pairwise comparisons between candidates
   */
  private calculatePairwiseComparisons(
    candidates: FilmCandidate[],
    ballots: Ballot[]
  ): PairwiseComparison[] {
    const comparisons: PairwiseComparison[] = [];

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const filmA = candidates[i].id;
        const filmB = candidates[j].id;

        let filmAWins = 0;
        let filmBWins = 0;
        let ties = 0;

        // Compare each ballot
        for (const ballot of ballots) {
          const scoreA = this.getScore(filmA, ballot);
          const scoreB = this.getScore(filmB, ballot);

          if (scoreA > scoreB) {
            filmAWins++;
          } else if (scoreB > scoreA) {
            filmBWins++;
          } else {
            ties++;
          }
        }

        comparisons.push({
          filmA,
          filmB,
          filmAWins,
          filmBWins,
          ties,
        });
      }
    }

    return comparisons;
  }

  /**
   * Calculate how many pairwise victories each candidate has
   */
  private calculatePairwiseWins(
    candidates: FilmCandidate[],
    comparisons: PairwiseComparison[]
  ): Map<string, { wins: number; losses: number }> {
    const counts = new Map<string, { wins: number; losses: number }>();

    // Initialize counts
    candidates.forEach((candidate) => {
      counts.set(candidate.id, { wins: 0, losses: 0 });
    });

    // Count wins and losses from pairwise comparisons
    comparisons.forEach((comparison) => {
      const { filmA, filmB, filmAWins, filmBWins } = comparison;

      if (filmAWins > filmBWins) {
        // Film A beats Film B
        counts.get(filmA)!.wins++;
        counts.get(filmB)!.losses++;
      } else if (filmBWins > filmAWins) {
        // Film B beats Film A
        counts.get(filmB)!.wins++;
        counts.get(filmA)!.losses++;
      }
      // Ties don't count as wins or losses
    });

    return counts;
  }

  /**
   * Create rankings with all metrics
   */
  private createRankings(
    candidates: FilmCandidate[],
    ballots: Ballot[],
    pairwiseWinCounts: Map<string, { wins: number; losses: number }>
  ): FilmRanking[] {
    return candidates.map((candidate) => {
      const totalScore = this.calculateTotalScore(candidate.id, ballots);
      const averageScore = ballots.length > 0 ? totalScore / ballots.length : 0;
      const { wins, losses } = pairwiseWinCounts.get(candidate.id)!;

      return {
        filmId: candidate.id,
        rank: 0, // Will be assigned later
        totalScore,
        averageScore,
        pairwiseWins: wins,
        pairwiseLosses: losses,
      };
    });
  }

  /**
   * Get score for a film from a ballot (returns 0 if not found)
   */
  private getScore(filmId: string, ballot: Ballot): number {
    const vote = ballot.votes.find((v) => v.filmId === filmId);
    return vote ? vote.score : 0;
  }

  /**
   * Calculate total score for a film across all ballots
   */
  private calculateTotalScore(filmId: string, ballots: Ballot[]): number {
    return ballots.reduce((sum, ballot) => {
      return sum + this.getScore(filmId, ballot);
    }, 0);
  }
}
