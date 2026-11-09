// Seeded random numbers (docs/ARCHITECTURE.md → Determinism).
// The same seed always gives the same sequence. Uses the small, well-known
// "mulberry32" generator — good enough for noise and random case choices,
// not for anything security-related.

/** A function returning the next number in [0, 1). */
export type RandomFn = () => number;

/** Create a generator from a seed (any number; it is reduced to 32 bits). */
export function createRandom(seed: number): RandomFn {
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
