import { describe, it, expect } from '@jest/globals';
import { Ballot, FilmCandidate } from './types';
import { CondorcetVoting } from './condorcet';

describe('Condorcet Voting Algorithm', () => {
  const algorithm = new CondorcetVoting();

  describe('Algorithm metadata', () => {
    it('should have correct name', () => {
      expect(algorithm.name).toBe('Condorcet');
    });

    it('should have a description', () => {
      expect(algorithm.description).toBeDefined();
      expect(algorithm.description.length).toBeGreaterThan(0);
    });
  });

  describe('Simple majority case', () => {
    it('should select clear winner when one film is universally preferred', () => {
      const candidates: FilmCandidate[] = [
        { id: 'film1', title: 'The Godfather' },
        { id: 'film2', title: 'Battlefield Earth' },
      ];

      const ballots: Ballot[] = [
        {
          visitorId: 'voter1',
          votes: [
            { filmId: 'film1', score: 3 },
            { filmId: 'film2', score: 0 },
          ],
          submittedAt: new Date(),
        },
        {
          visitorId: 'voter2',
          votes: [
            { filmId: 'film1', score: 3 },
            { filmId: 'film2', score: 1 },
          ],
          submittedAt: new Date(),
        },
        {
          visitorId: 'voter3',
          votes: [
            { filmId: 'film1', score: 2 },
            { filmId: 'film2', score: 1 },
          ],
          submittedAt: new Date(),
        },
      ];

      const results = algorithm.calculateWinner(ballots, candidates);

      expect(results.winner).toBe('film1');
      expect(results.condorcetWinner).toBe(true);
      expect(results.totalBallots).toBe(3);
      expect(results.algorithm).toBe('Condorcet');
    });
  });

  describe('Pairwise comparisons', () => {
    it('should correctly count pairwise victories', () => {
      const candidates: FilmCandidate[] = [
        { id: 'film1', title: 'Film A' },
        { id: 'film2', title: 'Film B' },
        { id: 'film3', title: 'Film C' },
      ];

      // Film1 > Film2 > Film3 (clear transitive preference)
      const ballots: Ballot[] = [
        {
          visitorId: 'voter1',
          votes: [
            { filmId: 'film1', score: 3 },
            { filmId: 'film2', score: 2 },
            { filmId: 'film3', score: 1 },
          ],
          submittedAt: new Date(),
        },
        {
          visitorId: 'voter2',
          votes: [
            { filmId: 'film1', score: 3 },
            { filmId: 'film2', score: 2 },
            { filmId: 'film3', score: 0 },
          ],
          submittedAt: new Date(),
        },
      ];

      const results = algorithm.calculateWinner(ballots, candidates);

      expect(results.winner).toBe('film1');
      expect(results.condorcetWinner).toBe(true);

      // Check rankings
      const film1Ranking = results.rankings.find((r) => r.filmId === 'film1');
      const film2Ranking = results.rankings.find((r) => r.filmId === 'film2');
      const film3Ranking = results.rankings.find((r) => r.filmId === 'film3');

      expect(film1Ranking?.rank).toBe(1);
      expect(film2Ranking?.rank).toBe(2);
      expect(film3Ranking?.rank).toBe(3);

      expect(film1Ranking?.pairwiseWins).toBe(2); // Beats film2 and film3
      expect(film2Ranking?.pairwiseWins).toBe(1); // Beats film3
      expect(film3Ranking?.pairwiseWins).toBe(0); // Beats nobody
    });

    it('should record pairwise comparison details', () => {
      const candidates: FilmCandidate[] = [
        { id: 'film1', title: 'Film A' },
        { id: 'film2', title: 'Film B' },
      ];

      const ballots: Ballot[] = [
        {
          visitorId: 'voter1',
          votes: [
            { filmId: 'film1', score: 3 },
            { filmId: 'film2', score: 1 },
          ],
          submittedAt: new Date(),
        },
        {
          visitorId: 'voter2',
          votes: [
            { filmId: 'film1', score: 2 },
            { filmId: 'film2', score: 2 },
          ],
          submittedAt: new Date(),
        },
        {
          visitorId: 'voter3',
          votes: [
            { filmId: 'film1', score: 1 },
            { filmId: 'film2', score: 3 },
          ],
          submittedAt: new Date(),
        },
      ];

      const results = algorithm.calculateWinner(ballots, candidates);

      expect(results.pairwiseComparisons).toHaveLength(1);

      const comparison = results.pairwiseComparisons[0];
      expect(comparison.filmAWins).toBe(1); // voter1 prefers film1
      expect(comparison.filmBWins).toBe(1); // voter3 prefers film2
      expect(comparison.ties).toBe(1); // voter2 ranks them equally
    });
  });

  describe('Condorcet paradox (cycle) handling', () => {
    it('should handle rock-paper-scissors scenario with tiebreaker', () => {
      const candidates: FilmCandidate[] = [
        { id: 'rock', title: 'Film Rock' },
        { id: 'paper', title: 'Film Paper' },
        { id: 'scissors', title: 'Film Scissors' },
      ];

      // Create a cycle: Rock > Scissors, Scissors > Paper, Paper > Rock
      const ballots: Ballot[] = [
        {
          visitorId: 'voter1',
          votes: [
            { filmId: 'rock', score: 3 },
            { filmId: 'scissors', score: 2 },
            { filmId: 'paper', score: 1 },
          ],
          submittedAt: new Date(),
        },
        {
          visitorId: 'voter2',
          votes: [
            { filmId: 'paper', score: 3 },
            { filmId: 'rock', score: 2 },
            { filmId: 'scissors', score: 1 },
          ],
          submittedAt: new Date(),
        },
        {
          visitorId: 'voter3',
          votes: [
            { filmId: 'scissors', score: 3 },
            { filmId: 'paper', score: 2 },
            { filmId: 'rock', score: 1 },
          ],
          submittedAt: new Date(),
        },
      ];

      const results = algorithm.calculateWinner(ballots, candidates);

      // No Condorcet winner due to cycle
      expect(results.condorcetWinner).toBe(false);

      // Should use tiebreaker (highest total score)
      expect(results.winner).toBeDefined();

      // All films should have equal pairwise wins and losses
      results.rankings.forEach((ranking) => {
        expect(ranking.pairwiseWins).toBe(1);
        expect(ranking.pairwiseLosses).toBe(1);
      });
    });

    it('should break ties by total score', () => {
      const candidates: FilmCandidate[] = [
        { id: 'film1', title: 'Film 1' },
        { id: 'film2', title: 'Film 2' },
      ];

      // Both films get same pairwise results but different total scores
      const ballots: Ballot[] = [
        {
          visitorId: 'voter1',
          votes: [
            { filmId: 'film1', score: 3 },
            { filmId: 'film2', score: 2 },
          ],
          submittedAt: new Date(),
        },
        {
          visitorId: 'voter2',
          votes: [
            { filmId: 'film1', score: 2 },
            { filmId: 'film2', score: 3 },
          ],
          submittedAt: new Date(),
        },
      ];

      const results = algorithm.calculateWinner(ballots, candidates);

      // Film1: 3+2 = 5, Film2: 2+3 = 5
      // It's a perfect tie, algorithm should pick one consistently
      expect(results.winner).toBeDefined();
      expect(['film1', 'film2']).toContain(results.winner);
    });
  });

  describe('Edge cases', () => {
    it('should handle single candidate', () => {
      const candidates: FilmCandidate[] = [{ id: 'only', title: 'Only Film' }];

      const ballots: Ballot[] = [
        {
          visitorId: 'voter1',
          votes: [{ filmId: 'only', score: 3 }],
          submittedAt: new Date(),
        },
      ];

      const results = algorithm.calculateWinner(ballots, candidates);

      expect(results.winner).toBe('only');
      expect(results.condorcetWinner).toBe(true);
      expect(results.rankings).toHaveLength(1);
      expect(results.pairwiseComparisons).toHaveLength(0);
    });

    it('should handle no ballots', () => {
      const candidates: FilmCandidate[] = [
        { id: 'film1', title: 'Film 1' },
        { id: 'film2', title: 'Film 2' },
      ];

      const ballots: Ballot[] = [];

      const results = algorithm.calculateWinner(ballots, candidates);

      expect(results.winner).toBeNull();
      expect(results.totalBallots).toBe(0);
      expect(results.rankings).toHaveLength(0);
    });

    it('should handle incomplete ballots', () => {
      const candidates: FilmCandidate[] = [
        { id: 'film1', title: 'Film 1' },
        { id: 'film2', title: 'Film 2' },
        { id: 'film3', title: 'Film 3' },
      ];

      // Voter only voted for some films
      const ballots: Ballot[] = [
        {
          visitorId: 'voter1',
          votes: [
            { filmId: 'film1', score: 3 },
            { filmId: 'film2', score: 2 },
            // film3 not voted
          ],
          submittedAt: new Date(),
        },
        {
          visitorId: 'voter2',
          votes: [
            { filmId: 'film1', score: 3 },
            { filmId: 'film3', score: 1 },
            // film2 not voted
          ],
          submittedAt: new Date(),
        },
      ];

      const results = algorithm.calculateWinner(ballots, candidates);

      // Should still calculate results with missing votes treated as 0
      expect(results.winner).toBe('film1');
      expect(results.rankings).toHaveLength(3);
    });

    it('should handle all zero scores', () => {
      const candidates: FilmCandidate[] = [
        { id: 'film1', title: 'Film 1' },
        { id: 'film2', title: 'Film 2' },
      ];

      const ballots: Ballot[] = [
        {
          visitorId: 'voter1',
          votes: [
            { filmId: 'film1', score: 0 },
            { filmId: 'film2', score: 0 },
          ],
          submittedAt: new Date(),
        },
      ];

      const results = algorithm.calculateWinner(ballots, candidates);

      // Should handle gracefully - both tied at 0
      expect(results.winner).toBeDefined();
    });
  });

  describe('Score calculations', () => {
    it('should correctly calculate total and average scores', () => {
      const candidates: FilmCandidate[] = [
        { id: 'film1', title: 'Film 1' },
        { id: 'film2', title: 'Film 2' },
      ];

      const ballots: Ballot[] = [
        {
          visitorId: 'voter1',
          votes: [
            { filmId: 'film1', score: 3 },
            { filmId: 'film2', score: 1 },
          ],
          submittedAt: new Date(),
        },
        {
          visitorId: 'voter2',
          votes: [
            { filmId: 'film1', score: 2 },
            { filmId: 'film2', score: 3 },
          ],
          submittedAt: new Date(),
        },
        {
          visitorId: 'voter3',
          votes: [
            { filmId: 'film1', score: 1 },
            { filmId: 'film2', score: 2 },
          ],
          submittedAt: new Date(),
        },
      ];

      const results = algorithm.calculateWinner(ballots, candidates);

      const film1Ranking = results.rankings.find((r) => r.filmId === 'film1');
      const film2Ranking = results.rankings.find((r) => r.filmId === 'film2');

      expect(film1Ranking?.totalScore).toBe(6); // 3+2+1
      expect(film1Ranking?.averageScore).toBe(2); // 6/3

      expect(film2Ranking?.totalScore).toBe(6); // 1+3+2
      expect(film2Ranking?.averageScore).toBe(2); // 6/3
    });
  });
});
