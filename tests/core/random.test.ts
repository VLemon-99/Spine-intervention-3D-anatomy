import { describe, expect, it } from 'vitest';
import { createRandom } from '../../src/core/random';

const take = (seed: number, n: number): number[] => {
  const random = createRandom(seed);
  return Array.from({ length: n }, () => random());
};

describe('seeded random numbers', () => {
  it('gives identical sequences of 1000 numbers for the same seed', () => {
    expect(take(42, 1000)).toEqual(take(42, 1000));
  });

  it('gives different sequences for different seeds', () => {
    expect(take(1, 1000)).not.toEqual(take(2, 1000));
    expect(take(0, 1000)).not.toEqual(take(42, 1000));
  });

  it('gives values in [0, 1)', () => {
    for (const seed of [0, 1, 42, 123456789, -7]) {
      for (const value of take(seed, 1000)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });
});
