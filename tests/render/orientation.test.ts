import { describe, expect, it } from 'vitest';
import { createProjection } from '../../src/core/geometry';
import type { CArmPose, Volume } from '../../src/core/types';
import { renderDrrCpu, transmissionAt, type DrrCpuOptions, type DrrImage } from '../../src/render/drrCpu';
import { ROTATIONS, orientPixel, unorientPixel, type Orientation } from '../../src/render/orientation';

const AP_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const NONE: Orientation = { flipHorizontal: false, flipVertical: false, rotation: 0 };

/** An empty 21³ block of 1 mm voxels with a dense 3×3×3 mm blob in its middle, at an off-centre place. */
function blobVolume(): Volume {
  const n = 21;
  const intensity = new Uint8Array(n * n * n);
  for (let k = 9; k <= 11; k++) for (let j = 9; j <= 11; j++) for (let i = 9; i <= 11; i++) intensity[i + n * (j + n * k)] = 255;
  // Blob centre: 20 mm to the patient's left and 35 mm toward the head.
  return {
    region: 'blob',
    size: { x: n, y: n, z: n },
    spacing: { x: 1, y: 1, z: 1 },
    origin: { x: 20 - 10, y: -10, z: 35 - 10 },
    orientation: [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    intensity,
    labels: new Uint8Array(n * n * n),
  };
}

const volume = blobVolume();
const plain = renderDrrCpu(volume, AP_POSE);

/** The dark spot: its pixels (as "x,y" keys) and its darkest pixel. */
function spot(image: DrrImage): { pixels: Set<string>; darkest: { x: number; y: number } } {
  const pixels = new Set<string>();
  let darkest = { x: -1, y: -1 };
  let lowest = 1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const v = image.data[x + image.width * y]!;
      if (v < 1) pixels.add(`${x},${y}`);
      if (v < lowest) {
        lowest = v;
        darkest = { x, y };
      }
    }
  }
  return { pixels, darkest };
}

const plainSpot = spot(plain);
/** The darkest pixel of the spot, with its value: a pixel to follow. */
const marker = { ...plainSpot.darkest, value: plain.data[plainSpot.darkest.x + 512 * plainSpot.darkest.y]! };

/** Check the image rendered with `options` is the plain image with every pixel moved as `move` says. */
function expectMoved(options: DrrCpuOptions, move: (p: { x: number; y: number }) => { x: number; y: number }): void {
  const image = renderDrrCpu(volume, AP_POSE, options);
  let wrong = 0;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const to = move({ x, y });
      if (image.data[to.x + 512 * to.y] !== plain.data[x + 512 * y]) wrong += 1;
    }
  }
  expect(wrong).toBe(0);
  const to = move(marker);
  expect(image.data[to.x + 512 * to.y]).toBe(marker.value);
  expect(spot(image).pixels.size).toBe(plainSpot.pixels.size);
}

describe('the test image', () => {
  it('has one dark spot away from the centre and from both diagonals', () => {
    expect(plainSpot.pixels.size).toBeGreaterThan(4);
    const { x, y } = plainSpot.darkest;
    // Image right is the patient's right; the blob is on the patient's left → left half, upper half.
    expect(x).toBeLessThan(256 - 20);
    expect(y).toBeLessThan(256 - 40);
    expect(Math.abs(x - 256)).not.toBe(Math.abs(y - 256));
  });
});

describe('orientPixel', () => {
  const p = { x: 300, y: 120 };

  it('moves a pixel as documented for each single option', () => {
    expect(orientPixel(p, NONE)).toEqual({ x: 300, y: 120 });
    expect(orientPixel(p, { ...NONE, flipHorizontal: true })).toEqual({ x: 211, y: 120 });
    expect(orientPixel(p, { ...NONE, flipVertical: true })).toEqual({ x: 300, y: 391 });
    expect(orientPixel(p, { ...NONE, rotation: 90 })).toEqual({ x: 391, y: 300 });
    expect(orientPixel(p, { ...NONE, rotation: 180 })).toEqual({ x: 211, y: 391 });
    expect(orientPixel(p, { ...NONE, rotation: 270 })).toEqual({ x: 120, y: 211 });
  });

  it('applies the flips first and then the rotation', () => {
    // Flip left-right: (300, 120) → (211, 120); then 90° clockwise: → (511 − 120, 211).
    expect(orientPixel(p, { flipHorizontal: true, flipVertical: false, rotation: 90 })).toEqual({ x: 391, y: 211 });
    // The other order would give a different pixel.
    const rotatedFirst = orientPixel(orientPixel(p, { ...NONE, rotation: 90 }), { ...NONE, flipHorizontal: true });
    expect(rotatedFirst).not.toEqual({ x: 391, y: 211 });
  });

  it('four 90° turns map every pixel back to itself', () => {
    const quarter: Orientation = { ...NONE, rotation: 90 };
    let wrong = 0;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        let q = { x, y };
        for (let turn = 0; turn < 4; turn++) q = orientPixel(q, quarter);
        if (q.x !== x || q.y !== y) wrong += 1;
      }
    }
    expect(wrong).toBe(0);
  });

  it('two, three turns of 90° equal the 180° and 270° settings', () => {
    const quarter: Orientation = { ...NONE, rotation: 90 };
    const twice = orientPixel(orientPixel(p, quarter), quarter);
    expect(orientPixel(p, { ...NONE, rotation: 180 })).toEqual(twice);
    expect(orientPixel(p, { ...NONE, rotation: 270 })).toEqual(orientPixel(twice, quarter));
  });

  it('unorientPixel undoes orientPixel for every combination', () => {
    for (const flipHorizontal of [false, true]) {
      for (const flipVertical of [false, true]) {
        for (const rotation of ROTATIONS) {
          const o = { flipHorizontal, flipVertical, rotation };
          for (const q of [p, { x: 0, y: 0 }, { x: 511, y: 0 }, { x: 17, y: 499 }]) {
            expect(unorientPixel(orientPixel(q, o), o)).toEqual(q);
          }
        }
      }
    }
  });
});

describe('orientation in the CPU reference', () => {
  it('flip left-right moves the spot to (511 − x, y)', () => {
    expectMoved({ flipHorizontal: true }, ({ x, y }) => ({ x: 511 - x, y }));
  });

  it('flip up-down moves the spot to (x, 511 − y)', () => {
    expectMoved({ flipVertical: true }, ({ x, y }) => ({ x, y: 511 - y }));
  });

  it('rotation 90° clockwise moves the spot to (511 − y, x)', () => {
    expectMoved({ rotation: 90 }, ({ x, y }) => ({ x: 511 - y, y: x }));
  });

  it('rotation 180° moves the spot to (511 − x, 511 − y)', () => {
    expectMoved({ rotation: 180 }, ({ x, y }) => ({ x: 511 - x, y: 511 - y }));
  });

  it('rotation 270° moves the spot to (y, 511 − x)', () => {
    expectMoved({ rotation: 270 }, ({ x, y }) => ({ x: y, y: 511 - x }));
  });

  it('flip left-right with rotation 90° puts the spot where flip first, then rotation predicts', () => {
    expectMoved({ flipHorizontal: true, rotation: 90 }, ({ x, y }) => ({ x: 511 - y, y: 511 - x }));
    // Rotation first and then the flip would put the marker somewhere else.
    const image = renderDrrCpu(volume, AP_POSE, { flipHorizontal: true, rotation: 90 });
    const other = { x: 511 - (511 - marker.y), y: marker.x };
    expect(image.data[other.x + 512 * other.y]).toBe(1); // empty there: the spot is elsewhere
  });

  it('rotation 0 with no flips gives the unchanged image', () => {
    const image = renderDrrCpu(volume, AP_POSE, { flipHorizontal: false, flipVertical: false, rotation: 0 });
    expect(image.data).toEqual(plain.data);
  });

  it('a single pixel is looked up the same way (transmissionAt)', () => {
    const projection = createProjection(AP_POSE);
    const options: DrrCpuOptions = { flipHorizontal: true, rotation: 90 };
    const to = orientPixel(marker, { flipHorizontal: true, flipVertical: false, rotation: 90 });
    expect(Math.fround(transmissionAt(volume, projection, { x: to.x + 0.5, y: to.y + 0.5 }, options))).toBe(
      marker.value,
    );
  });

  it('rejects a rotation other than 0, 90, 180 or 270 with a clear error', () => {
    for (const bad of [45, 360, -90, 1, Number.NaN]) {
      const options = { rotation: bad } as DrrCpuOptions;
      expect(() => renderDrrCpu(volume, AP_POSE, options), `rotation ${bad}`).toThrow(/rotation/i);
      expect(() => orientPixel({ x: 1, y: 2 }, { ...NONE, rotation: bad as 0 })).toThrow(/rotation/i);
    }
  });
});
