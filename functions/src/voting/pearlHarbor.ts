/**
 * Pearl Harbor Vote Reassignment
 *
 * Owner-requested easter egg. If Pearl Harbor somehow ends up among a round's
 * candidates, every rating it receives is quietly moved, at tally time, to one
 * other candidate chosen pseudo-randomly per voter. Pearl Harbor is removed
 * from the candidate list so it cannot win.
 *
 * Pure: the input ballots are never mutated (stored votes are untouched), and
 * the choice is seeded by round id + visitor id so a recount is identical.
 */

import { Ballot, FilmCandidate, Vote } from './types';
import { isPearlHarbor } from '../films/films.logic';

/** Chooses an index in [0, count) from a seed string. */
export type IndexPicker = (seed: string, count: number) => number;

/** FNV-1a 32-bit offset basis and prime. */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Deterministically maps a seed string to an index in [0, count) using a
 * 32-bit FNV-1a hash.
 * @param seed - Any string (e.g. "roundId:visitorId")
 * @param count - Number of choices; must be at least 1
 */
export function seededIndex(seed: string, count: number): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0) % count;
}

/**
 * Adds `score` for `filmId`, keeping the higher score if the voter already
 * rated that film.
 */
function mergeVote(votes: Vote[], filmId: string, score: number): Vote[] {
  const alreadyRated = votes.some((v) => v.filmId === filmId);
  if (!alreadyRated) {
    return [...votes, { filmId, score }];
  }
  return votes.map((v) => (v.filmId === filmId ? { ...v, score: Math.max(v.score, score) } : v));
}

/**
 * Moves each voter's Pearl Harbor rating to one other candidate and removes
 * Pearl Harbor from the candidates.
 *
 * - Rounds without Pearl Harbor are returned as-is (same references).
 * - Ballots without a Pearl Harbor rating are returned as-is.
 * - If the voter already rated the target film, the higher rating is kept.
 * - If Pearl Harbor is the only candidate, its ratings are dropped and it
 *   remains the sole candidate (there is nothing else to pick).
 *
 * @param roundId - Voting round id (part of the seed)
 * @param ballots - Ballots as stored
 * @param candidates - Candidate films for the round
 * @param pickIndex - Seeded index picker (injectable for tests)
 * @returns Ballots and candidates to feed to the voting algorithm
 */
export function reassignPearlHarborVotes(
  roundId: string,
  ballots: Ballot[],
  candidates: FilmCandidate[],
  pickIndex: IndexPicker = seededIndex
): { ballots: Ballot[]; candidates: FilmCandidate[] } {
  const pearlIds = new Set(candidates.filter((c) => isPearlHarbor(c.title)).map((c) => c.id));
  if (pearlIds.size === 0) {
    return { ballots, candidates };
  }

  const others = candidates.filter((c) => !pearlIds.has(c.id));

  const reassigned = ballots.map((ballot) => {
    const pearlVotes = ballot.votes.filter((v) => pearlIds.has(v.filmId));
    if (pearlVotes.length === 0) {
      return ballot;
    }

    const remaining = ballot.votes.filter((v) => !pearlIds.has(v.filmId));
    if (others.length === 0) {
      return { ...ballot, votes: remaining };
    }

    const pearlScore = Math.max(...pearlVotes.map((v) => v.score));
    const target = others[pickIndex(`${roundId}:${ballot.visitorId}`, others.length)];
    return { ...ballot, votes: mergeVote(remaining, target.id, pearlScore) };
  });

  return { ballots: reassigned, candidates: others.length > 0 ? others : candidates };
}
