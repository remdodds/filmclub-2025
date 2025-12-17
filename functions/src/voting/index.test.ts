import { describe, it, expect } from '@jest/globals';
import { getAlgorithm, getDefaultAlgorithm, listAlgorithms } from './index';

describe('Voting Algorithm Registry', () => {
  describe('getAlgorithm', () => {
    it('should return Condorcet algorithm', () => {
      const algorithm = getAlgorithm('condorcet');

      expect(algorithm.name).toBe('Condorcet');
      expect(algorithm.calculateWinner).toBeDefined();
    });

    it('should be case-insensitive', () => {
      const lower = getAlgorithm('condorcet');
      const upper = getAlgorithm('CONDORCET');
      const mixed = getAlgorithm('CoNdOrCeT');

      expect(lower.name).toBe(upper.name);
      expect(lower.name).toBe(mixed.name);
    });

    it('should throw error for unknown algorithm', () => {
      expect(() => getAlgorithm('unknown')).toThrow('Unknown voting algorithm: unknown');
    });

    it('should throw error for empty string', () => {
      expect(() => getAlgorithm('')).toThrow('Unknown voting algorithm:');
    });
  });

  describe('getDefaultAlgorithm', () => {
    it('should return Condorcet as default', () => {
      const algorithm = getDefaultAlgorithm();

      expect(algorithm.name).toBe('Condorcet');
    });

    it('should return same instance as getAlgorithm("condorcet")', () => {
      const defaultAlg = getDefaultAlgorithm();
      const namedAlg = getAlgorithm('condorcet');

      expect(defaultAlg).toBe(namedAlg);
    });
  });

  describe('listAlgorithms', () => {
    it('should return array of algorithm names', () => {
      const algorithms = listAlgorithms();

      expect(Array.isArray(algorithms)).toBe(true);
      expect(algorithms.length).toBeGreaterThan(0);
    });

    it('should include condorcet', () => {
      const algorithms = listAlgorithms();

      expect(algorithms).toContain('condorcet');
    });

    it('should return consistent list', () => {
      const list1 = listAlgorithms();
      const list2 = listAlgorithms();

      expect(list1).toEqual(list2);
    });
  });
});
