export interface Film {
  id: string;
  title: string;
  nominatedBy: string;
  addedAt: string | Date;
  status: 'nominated' | 'watched';
  watchedAt?: string | Date;
  votingResults?: {
    winner: boolean;
    totalScore: number;
    averageScore: number;
  };
}

export interface Config {
  clubName: string;
  timezone: string;
  votingSchedule: {
    openDay: number;
    openTime: string;
    closeDay: number;
    closeTime: string;
  };
}

export interface VotingRound {
  id: string;
  openedAt: string;
  closesAt: string;
  status: 'open' | 'closed';
  films: { id: string; title: string }[];
  yourVotes?: Record<string, number>;
}

export interface VotingResults {
  votingRoundId: string;
  closedAt: string;
  winner: {
    id: string;
    title: string;
    rank: number;
    totalScore: number;
    averageScore: number;
    pairwiseWins?: number;
    pairwiseLosses?: number;
  };
  rankings: Array<{
    id: string;
    title: string;
    rank: number;
    totalScore: number;
    averageScore: number;
  }>;
  algorithm?: string;
  totalVoters?: number;
}

export interface AuthState {
  sessionToken: string | null;
  visitorId: string | null;
  isLoggedIn: boolean;
}

export interface PairwiseComparison {
  filmA: string;
  filmB: string;
  filmAWins: number;
  filmBWins: number;
  ties: number;
}

export interface RankingWithFilmInfo {
  filmId: string;
  title: string;
  nominatedBy?: string;
  rank: number;
  totalScore: number;
  averageScore: number;
  pairwiseWins: number;
  pairwiseLosses: number;
}

export interface VotingHistoryRecord {
  roundId: string;
  openedAt: Date | string;
  closedAt: Date | string;
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
  archivedAt: Date | string;
}
