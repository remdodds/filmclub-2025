import { describe, it, expect, jest } from '@jest/globals';
import { reassignPearlHarborVotes, seededIndex } from './pearlHarbor';
import { Ballot, FilmCandidate } from './types';

const SUBMITTED_AT = new Date('2026-03-20T09:00:00.000Z');
const ROUND_ID = 'round-123';

function makeBallot(visitorId: string, scores: Record<string, number>): Ballot {
  return {
    visitorId,
    votes: Object.entries(scores).map(([filmId, score]) => ({ filmId, score })),
    submittedAt: SUBMITTED_AT,
  };
}

const MATRIX: FilmCandidate = { id: 'film-matrix', title: 'The Matrix' };
const INCEPTION: FilmCandidate = { id: 'film-inception', title: 'Inception' };
const PEARL: FilmCandidate = { id: 'film-pearl', title: 'Pearl Harbor (2001)' };

/** A picker that always chooses the given index among the other candidates. */
const pickAlways = (index: number) => () => index;

describe('reassignPearlHarborVotes', () => {
  it('should leave ballots and candidates untouched when Pearl Harbor is not a candidate', () => {
    // Arrange
    const ballots = [makeBallot('v1', { [MATRIX.id]: 3, [INCEPTION.id]: 1 })];
    const candidates = [MATRIX, INCEPTION];

    // Act
    const result = reassignPearlHarborVotes(ROUND_ID, ballots, candidates, pickAlways(0));

    // Assert
    expect(result.ballots).toBe(ballots);
    expect(result.candidates).toBe(candidates);
  });

  it("should move a voter's Pearl Harbor rating to the picked film and drop Pearl Harbor from the candidates", () => {
    // Arrange
    const ballots = [makeBallot('v1', { [MATRIX.id]: 1, [PEARL.id]: 3 })];
    const candidates = [MATRIX, PEARL, INCEPTION];

    // Act — index 1 among the non-Pearl candidates [MATRIX, INCEPTION] is INCEPTION
    const result = reassignPearlHarborVotes(ROUND_ID, ballots, candidates, pickAlways(1));

    // Assert
    expect(result.candidates).toEqual([MATRIX, INCEPTION]);
    expect(result.ballots).toEqual([makeBallot('v1', { [MATRIX.id]: 1, [INCEPTION.id]: 3 })]);
  });

  it('should leave ballots that did not rate Pearl Harbor unchanged', () => {
    // Arrange
    const untouched = makeBallot('v2', { [MATRIX.id]: 2, [INCEPTION.id]: 0 });
    const ballots = [makeBallot('v1', { [PEARL.id]: 2 }), untouched];

    // Act
    const result = reassignPearlHarborVotes(ROUND_ID, ballots, [MATRIX, PEARL, INCEPTION], pickAlways(0));

    // Assert
    expect(result.ballots[0]).toEqual(makeBallot('v1', { [MATRIX.id]: 2 }));
    expect(result.ballots[1]).toEqual(untouched);
  });

  it('should keep the higher rating when the voter already rated the target film', () => {
    // Arrange — v1's Pearl rating is higher than the target's; v2's is lower
    const ballots = [
      makeBallot('v1', { [MATRIX.id]: 1, [PEARL.id]: 3 }),
      makeBallot('v2', { [MATRIX.id]: 2, [PEARL.id]: 1 }),
    ];

    // Act
    const result = reassignPearlHarborVotes(ROUND_ID, ballots, [MATRIX, PEARL], pickAlways(0));

    // Assert — exactly one Matrix vote per ballot, holding the max
    expect(result.ballots).toEqual([
      makeBallot('v1', { [MATRIX.id]: 3 }),
      makeBallot('v2', { [MATRIX.id]: 2 }),
    ]);
  });

  it('should drop Pearl Harbor ratings without reassigning when it is the only candidate', () => {
    // Arrange
    const ballots = [makeBallot('v1', { [PEARL.id]: 3 })];
    const picker = jest.fn(pickAlways(0));

    // Act
    const result = reassignPearlHarborVotes(ROUND_ID, ballots, [PEARL], picker);

    // Assert — nothing else to watch, so Pearl Harbor stays but gets no ratings
    expect(result.candidates).toEqual([PEARL]);
    expect(result.ballots).toEqual([makeBallot('v1', {})]);
    expect(picker).not.toHaveBeenCalled();
  });

  it('should seed the picker with the round id and voter id and the number of other films', () => {
    // Arrange
    const ballots = [makeBallot('v1', { [PEARL.id]: 3 }), makeBallot('v2', { [PEARL.id]: 1 })];
    const picker = jest.fn(pickAlways(0));

    // Act
    reassignPearlHarborVotes(ROUND_ID, ballots, [MATRIX, PEARL, INCEPTION], picker);

    // Assert
    expect(picker.mock.calls).toEqual([
      [`${ROUND_ID}:v1`, 2],
      [`${ROUND_ID}:v2`, 2],
    ]);
  });

  it('should default to a deterministic seeded picker so recounting gives the same result', () => {
    // Arrange
    const ballots = ['v1', 'v2', 'v3', 'v4'].map((id) => makeBallot(id, { [PEARL.id]: 3 }));
    const candidates = [MATRIX, PEARL, INCEPTION];
    const others = [MATRIX, INCEPTION];

    // Act
    const first = reassignPearlHarborVotes(ROUND_ID, ballots, candidates);
    const second = reassignPearlHarborVotes(ROUND_ID, ballots, candidates);

    // Assert — same outcome both times, and each voter's rating lands on the seeded film
    expect(second).toEqual(first);
    first.ballots.forEach((ballot) => {
      const expectedTarget = others[seededIndex(`${ROUND_ID}:${ballot.visitorId}`, others.length)];
      expect(ballot.votes).toEqual([{ filmId: expectedTarget.id, score: 3 }]);
    });
  });

  it("should leave the voter's other ratings intact when merging into an already-rated film", () => {
    // Arrange
    const ballots = [makeBallot('v1', { [MATRIX.id]: 1, [PEARL.id]: 3, [INCEPTION.id]: 2 })];

    // Act
    const result = reassignPearlHarborVotes(ROUND_ID, ballots, [MATRIX, PEARL, INCEPTION], pickAlways(0));

    // Assert
    expect(result.ballots).toEqual([makeBallot('v1', { [MATRIX.id]: 3, [INCEPTION.id]: 2 })]);
  });

  it('should not mutate the original ballots', () => {
    // Arrange
    const ballots = [makeBallot('v1', { [MATRIX.id]: 1, [PEARL.id]: 3 })];
    const snapshot = JSON.parse(JSON.stringify(ballots));

    // Act
    reassignPearlHarborVotes(ROUND_ID, ballots, [MATRIX, PEARL], pickAlways(0));

    // Assert
    expect(JSON.parse(JSON.stringify(ballots))).toEqual(snapshot);
  });

  it('should treat every Pearl Harbor variant in the round as Pearl Harbor', () => {
    // Arrange
    const pearlBritish: FilmCandidate = { id: 'film-pearl-uk', title: 'pearl harbour' };
    const ballots = [makeBallot('v1', { [PEARL.id]: 2, [pearlBritish.id]: 3 })];

    // Act
    const result = reassignPearlHarborVotes(ROUND_ID, ballots, [PEARL, MATRIX, pearlBritish], pickAlways(0));

    // Assert — both variants gone; the target keeps the higher of the moved ratings
    expect(result.candidates).toEqual([MATRIX]);
    expect(result.ballots).toEqual([makeBallot('v1', { [MATRIX.id]: 3 })]);
  });
});


describe('seededIndex', () => {
  it('should return the same index for the same seed every time', () => {
    expect(seededIndex('round-1:v1', 5)).toBe(seededIndex('round-1:v1', 5));
  });

  it('should always return an index within range', () => {
    for (let i = 0; i < 200; i++) {
      const index = seededIndex(`round-${i}:visitor-${i * 7}`, 3);
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(3);
    }
  });

  it('should spread different seeds across every index', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 50; i++) {
      seen.add(seededIndex(`round-123:visitor-${i}`, 4));
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });
});
