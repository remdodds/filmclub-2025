/**
 * Voting Algorithm Types
 *
 * Defines data structures for the voting system
 */

/**
 * A single vote from a visitor
 */
export interface Vote {
  filmId: string;
  score: number; // 0-3 scale
}

/**
 * Complete ballot from a visitor
 */
export interface Ballot {
  visitorId: string;
  votes: Vote[];
  submittedAt: Date;
}

/**
 * Film information for voting
 */
export interface FilmCandidate {
  id: string;
  title: string;
  addedBy?: string;
}

/**
 * Pairwise comparison result between two films
 */
export interface PairwiseComparison {
  filmA: string;
  filmB: string;
  filmAWins: number; // Number of voters who ranked A > B
  filmBWins: number; // Number of voters who ranked B > A
  ties: number; // Number of voters who ranked them equally
}

/**
 * Voting results after running the algorithm
 */
export interface VotingResults {
  winner: string | null; // Film ID of the winner
  condorcetWinner: boolean; // True if clear Condorcet winner
  rankings: FilmRanking[];
  pairwiseComparisons: PairwiseComparison[];
  totalBallots: number;
  algorithm: string;
}

/**
 * Final ranking of a film
 */
export interface FilmRanking {
  filmId: string;
  rank: number; // 1 = winner, 2 = second place, etc.
  totalScore: number; // Sum of all scores from voters
  averageScore: number; // Average score
  pairwiseWins: number; // Number of pairwise victories
  pairwiseLosses: number; // Number of pairwise defeats
}

/**
 * Voting algorithm interface
 */
export interface VotingAlgorithm {
  name: string;
  description: string;
  calculateWinner(ballots: Ballot[], candidates: FilmCandidate[]): VotingResults;
}
