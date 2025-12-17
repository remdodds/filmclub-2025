/**
 * Voting Algorithm Registry
 *
 * Central registry for all available voting algorithms
 */

import { VotingAlgorithm } from './types';
import { CondorcetVoting } from './condorcet';

// Available algorithms
const ALGORITHMS: Record<string, VotingAlgorithm> = {
  condorcet: new CondorcetVoting(),
};

/**
 * Get a voting algorithm by name
 * @param name - Algorithm name
 * @returns Voting algorithm instance
 * @throws Error if algorithm not found
 */
export function getAlgorithm(name: string): VotingAlgorithm {
  const algorithm = ALGORITHMS[name.toLowerCase()];

  if (!algorithm) {
    throw new Error(`Unknown voting algorithm: ${name}`);
  }

  return algorithm;
}

/**
 * Get the default voting algorithm
 * @returns Default voting algorithm (Condorcet)
 */
export function getDefaultAlgorithm(): VotingAlgorithm {
  return ALGORITHMS.condorcet;
}

/**
 * List all available algorithms
 * @returns Array of algorithm names
 */
export function listAlgorithms(): string[] {
  return Object.keys(ALGORITHMS);
}

// Re-export types for convenience
export * from './types';
export { CondorcetVoting } from './condorcet';
