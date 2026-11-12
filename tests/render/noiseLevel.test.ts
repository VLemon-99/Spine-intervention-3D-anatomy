import { describe, expect, it } from 'vitest';
import { defaultNoiseLevel, noiseLevelFor } from '../../src/render/pipeline';

const RATIO = defaultNoiseLevel('fluoro') / defaultNoiseLevel('shot');

describe('noiseLevelFor (the level an image is actually taken with)', () => {
  it('a single shot uses the setting as it is', () => {
    for (const setting of [0, 0.01, 0.04, 0.3, 1]) {
      expect(noiseLevelFor('shot', setting)).toBe(setting);
    }
  });

  it('an image of unknown kind (null) uses the setting as it is', () => {
    expect(noiseLevelFor(null, 0.2)).toBe(0.2);
  });

  it('a fluoro frame is higher by the ratio of the two default levels', () => {
    expect(RATIO).toBeGreaterThan(1);
    for (const setting of [0.01, 0.04, 0.1, 0.3]) {
      expect(noiseLevelFor('fluoro', setting)).toBeCloseTo(setting * RATIO, 12);
      expect(noiseLevelFor('fluoro', setting)).toBeGreaterThan(noiseLevelFor('shot', setting));
    }
  });

  it('at the default shot setting a fluoro frame gets the default fluoro level', () => {
    expect(noiseLevelFor('fluoro', defaultNoiseLevel('shot'))).toBeCloseTo(defaultNoiseLevel('fluoro'), 12);
  });

  it('never goes above 1', () => {
    expect(noiseLevelFor('fluoro', 0.9)).toBe(1);
    expect(noiseLevelFor('fluoro', 1)).toBe(1);
    expect(noiseLevelFor('fluoro', 1 / RATIO + 0.01)).toBe(1);
  });

  it('at setting 0 both kinds are 0', () => {
    expect(noiseLevelFor('shot', 0)).toBe(0);
    expect(noiseLevelFor('fluoro', 0)).toBe(0);
  });
});
