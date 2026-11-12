import { describe, expect, it } from 'vitest';
import { DEFAULT_HU_WINDOW, huToIntensity, huVolumeToIntensity, makeHuWindow } from '../../tools/anatomy/intensity';

describe('huToIntensity', () => {
  it('uses the default window −1000 → 0, +2000 → 255, and +500 → about 128', () => {
    expect(DEFAULT_HU_WINDOW).toEqual({ lower: -1000, upper: 2000 });
    expect(huToIntensity(-1000)).toBe(0);
    expect(huToIntensity(2000)).toBe(255);
    expect(Math.abs(huToIntensity(500) - 128)).toBeLessThanOrEqual(1);
  });

  it('clamps values below the window to 0 and above it to 255', () => {
    expect(huToIntensity(-1001)).toBe(0);
    expect(huToIntensity(-3024)).toBe(0);
    expect(huToIntensity(2001)).toBe(255);
    expect(huToIntensity(30000)).toBe(255);
  });

  it('never decreases as HU rises, over −1500 … +2500 in steps of 1', () => {
    let previous = -1;
    for (let hu = -1500; hu <= 2500; hu++) {
      const value = huToIntensity(hu);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('maps the ends of a custom window (−200 … +1500) to 0 and 255', () => {
    const window = makeHuWindow(-200, 1500);
    expect(huToIntensity(-200, window)).toBe(0);
    expect(huToIntensity(1500, window)).toBe(255);
    expect(huToIntensity(-1000, window)).toBe(0);
    expect(huToIntensity(2000, window)).toBe(255);
  });

  it('rejects a window whose lower end is not below its upper end, or that is not finite', () => {
    expect(() => makeHuWindow(500, 500)).toThrow(/lower.*below.*upper/i);
    expect(() => makeHuWindow(1000, -1000)).toThrow(/lower.*below.*upper/i);
    expect(() => makeHuWindow(Number.NaN, 2000)).toThrow(/finite/i);
    expect(() => makeHuWindow(-1000, Number.POSITIVE_INFINITY)).toThrow(/finite/i);
    expect(() => huToIntensity(0, { lower: 10, upper: 0 })).toThrow(/lower.*below.*upper/i);
  });

  it('turns a NaN voxel value into 0 (air) rather than garbage', () => {
    expect(huToIntensity(Number.NaN)).toBe(0);
  });

  it('converts a whole volume into 8-bit values', () => {
    const out = huVolumeToIntensity(Float32Array.from([-2000, -1000, 500, 2000, 5000]));
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(Math.abs(out[2] - 128)).toBeLessThanOrEqual(1);
    expect(out[3]).toBe(255);
    expect(out[4]).toBe(255);
  });
});
