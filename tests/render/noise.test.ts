import { describe, expect, it } from 'vitest';
import type { CArmPose, Volume } from '../../src/core/types';
import { renderDrrCpu, type DrrCpuOptions } from '../../src/render/drrCpu';
import { addNoise, grainAt } from '../../src/render/noise';
import { DEFAULT_NOISE_LEVEL, NO_SIGNAL, defaultNoiseLevel, isCollimated } from '../../src/render/pipeline';

const AP_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };

/** A uniform 20 mm slab across the beam (see tests/render/drrCpu.test.ts for the layout). */
function slabVolume(): Volume {
  const size = { x: 41, y: 80, z: 41 };
  const spacing = { x: 2, y: 1, z: 3 };
  const count = size.x * size.y * size.z;
  const data = new Uint8Array(count);
  for (let k = 0; k < size.z; k++) {
    for (let j = 30; j < 50; j++) for (let i = 0; i < size.x; i++) data[i + size.x * (j + size.y * k)] = 200;
  }
  return {
    region: 'slab',
    size,
    spacing,
    origin: { x: -40, y: -39.5, z: -60 },
    orientation: [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    intensity: data,
    labels: new Uint8Array(count),
  };
}

const slab = slabVolume();
const clean = renderDrrCpu(slab, AP_POSE);

/** Mean and standard deviation of the 100×100 pixels in the middle of the image (well inside the slab). */
function middleStats(data: Float32Array): { mean: number; sd: number } {
  let sum = 0;
  let sumSquares = 0;
  let n = 0;
  for (let y = 206; y < 306; y++) {
    for (let x = 206; x < 306; x++) {
      const v = data[x + 512 * y]!;
      sum += v;
      sumSquares += v * v;
      n += 1;
    }
  }
  const mean = sum / n;
  return { mean, sd: Math.sqrt(Math.max(0, sumSquares / n - mean * mean)) };
}

const noisy = (seed: number, level: number, extra: DrrCpuOptions = {}): Float32Array =>
  renderDrrCpu(slab, AP_POSE, { ...extra, noise: { seed, level } }).data;

describe('grainAt', () => {
  it('is the same every time for the same seed and pixel, and lies within −0.5…0.5', () => {
    expect(grainAt(7, 100, 200)).toBe(grainAt(7, 100, 200));
    for (let n = 0; n < 1000; n++) {
      const g = grainAt(3, n % 512, (n * 7) % 512);
      expect(g).toBeGreaterThanOrEqual(-0.5);
      expect(g).toBeLessThan(0.5);
    }
  });

  it('differs between pixels and between seeds', () => {
    expect(grainAt(7, 100, 200)).not.toBe(grainAt(7, 101, 200));
    expect(grainAt(7, 100, 200)).not.toBe(grainAt(7, 100, 201));
    expect(grainAt(7, 100, 200)).not.toBe(grainAt(8, 100, 200));
  });

  it('has a mean of about zero over the image', () => {
    let sum = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) sum += grainAt(1, x, y);
    expect(Math.abs(sum / (512 * 512))).toBeLessThan(0.005);
  });
});

describe('addNoise', () => {
  it('level 0 changes nothing and the result always stays within 0…1', () => {
    expect(addNoise(0.4, { seed: 5, level: 0 }, 10, 10)).toBe(0.4);
    for (let x = 0; x < 200; x++) {
      for (const value of [0, 0.01, 0.5, 0.99, 1]) {
        const v = addNoise(value, { seed: 2, level: 1 }, x, 3);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('noise in the CPU reference', () => {
  it('the same seed and level give an identical image; a different seed gives a different one', () => {
    const a = noisy(1, 0.2);
    expect(noisy(1, 0.2)).toEqual(a);
    const b = noisy(2, 0.2);
    let different = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) different += 1;
    // Almost every pixel of the slab differs (air pixels are kept at 1 either way about half the time).
    expect(different).toBeGreaterThan(a.length / 2);
  });

  it('on a uniform region the spread is 0 at level 0 and rises with each higher level', () => {
    expect(middleStats(clean.data).sd).toBe(0);
    expect(middleStats(noisy(1, 0)).sd).toBe(0);
    const levels = [0, 0.05, 0.2, 0.5, 1];
    const spreads = levels.map((level) => middleStats(noisy(1, level)).sd);
    for (let n = 1; n < spreads.length; n++) expect(spreads[n]!, `level ${levels[n]}`).toBeGreaterThan(spreads[n - 1]!);
  });

  it('level 0 gives exactly the image without noise', () => {
    expect(noisy(9, 0)).toEqual(clean.data);
  });

  it('the mean of the region stays within 2% and every value within 0…1', () => {
    const cleanMean = middleStats(clean.data).mean;
    expect(cleanMean).toBeGreaterThan(0.3);
    expect(cleanMean).toBeLessThan(0.9);
    // Every level with one seed, and the strongest level with two more seeds.
    for (const [seed, level] of [
      [1, 0.05],
      [1, 0.2],
      [1, 0.5],
      [1, 1],
      [2, 1],
      [3, 1],
    ] as const) {
      const data = noisy(seed, level);
      const { mean } = middleStats(data);
      expect(Math.abs(mean - cleanMean) / cleanMean, `level ${level}, seed ${seed}`).toBeLessThan(0.02);
      expect(data.every((v) => v >= 0 && v <= 1)).toBe(true);
    }
  }, 30_000); // six whole images

  it('collimated pixels still have exactly the NO_SIGNAL value with noise on', () => {
    const collimation = { left: 20, right: 10, top: 30, bottom: 0 };
    const data = noisy(4, 1, { collimation });
    const open = noisy(4, 1);
    let wrong = 0;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const expected = isCollimated(x, y, collimation) ? NO_SIGNAL : open[x + 512 * y]!;
        if (data[x + 512 * y] !== expected) wrong += 1;
      }
    }
    expect(wrong).toBe(0);
  });

  it('rejects a level outside 0…1 or a seed that is not a finite number', () => {
    for (const noise of [
      { seed: 1, level: -0.1 },
      { seed: 1, level: 1.5 },
      { seed: 1, level: Number.NaN },
      { seed: Number.NaN, level: 0.5 },
      { seed: Number.POSITIVE_INFINITY, level: 0.5 },
    ]) {
      expect(() => renderDrrCpu(slab, AP_POSE, { noise })).toThrow(/noise/i);
    }
  });
});

describe('default noise levels', () => {
  it('fluoro frames are grainier than single shots, and shots have some grain', () => {
    expect(defaultNoiseLevel('fluoro')).toBeGreaterThan(defaultNoiseLevel('shot'));
    expect(defaultNoiseLevel('shot')).toBeGreaterThan(0);
    expect(defaultNoiseLevel('fluoro')).toBeLessThanOrEqual(1);
    expect(defaultNoiseLevel('shot')).toBe(DEFAULT_NOISE_LEVEL.shot);
    expect(defaultNoiseLevel('fluoro')).toBe(DEFAULT_NOISE_LEVEL.fluoro);
  });
});
