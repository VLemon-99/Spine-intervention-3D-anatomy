import { describe, expect, it } from 'vitest';
import { IMAGE_SIZE_PX, createProjection } from '../../src/core/geometry';
import { PHANTOM_TEST_POINTS, createPhantom } from '../../src/core/phantom';
import { initialState } from '../../src/core/store';
import type { CArmPose, Volume } from '../../src/core/types';
import { renderDrrCpu, transmissionAt } from '../../src/render/drrCpu';
import { ABSORPTION_PER_MM, MARCH_STEP_MM } from '../../src/render/pipeline';

const AP_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const IMAGE_CENTRE = { x: IMAGE_SIZE_PX / 2, y: IMAGE_SIZE_PX / 2 };
const SLAB_INTENSITY = 200;

/**
 * A block of 41 × 80 × 41 voxels centred on the isocentre, with a different
 * spacing on each axis (2, 1 and 3 mm). The voxels within `thicknessMm` of the
 * middle (along y, the beam direction at pose 0°/0°) have `intensity`; the
 * rest is empty. So the beam crosses a uniform slab of that thickness.
 */
function slabVolume(thicknessMm: number, intensity = SLAB_INTENSITY): Volume {
  const size = { x: 41, y: 80, z: 41 };
  const spacing = { x: 2, y: 1, z: 3 };
  const count = size.x * size.y * size.z;
  const data = new Uint8Array(count);
  const jMid = (size.y - 1) / 2;
  for (let k = 0; k < size.z; k++) {
    for (let j = 0; j < size.y; j++) {
      // Voxel j is centred at y = (j − jMid) mm (a half millimetre), so an even
      // thickness in mm is made of exactly that many whole 1 mm voxels.
      if (Math.abs(j - jMid) > thicknessMm / 2) continue;
      for (let i = 0; i < size.x; i++) data[i + size.x * (j + size.y * k)] = intensity;
    }
  }
  return {
    region: 'slab',
    size,
    spacing,
    origin: {
      x: (-(size.x - 1) / 2) * spacing.x,
      y: (-(size.y - 1) / 2) * spacing.y,
      z: (-(size.z - 1) / 2) * spacing.z,
    },
    orientation: [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    intensity: data,
    labels: new Uint8Array(count),
  };
}

const centreTransmission = (thicknessMm: number): number =>
  transmissionAt(slabVolume(thicknessMm), createProjection(AP_POSE), IMAGE_CENTRE);

describe('pipeline numbers', () => {
  it('keeps the F0 values (the GPU image must not change)', () => {
    expect(MARCH_STEP_MM).toBe(0.5);
    expect(ABSORPTION_PER_MM).toBe(0.025);
  });
});

describe('renderDrrCpu', () => {
  it('gives exactly 1 at every one of the 512×512 pixels for an empty volume', () => {
    const empty = slabVolume(0);
    expect(empty.intensity.every((v) => v === 0)).toBe(true);
    const image = renderDrrCpu(empty, AP_POSE);
    expect(image.width).toBe(512);
    expect(image.height).toBe(512);
    expect(image.data).toBeInstanceOf(Float32Array);
    expect(image.data.length).toBe(512 * 512);
    expect(image.data.every((v) => v === 1)).toBe(true);
  });

  it('stores pixel (x, y) at index x + 512 × y, using the ray through the pixel centre', () => {
    const phantom = createPhantom();
    const pose = initialState().pose;
    const projection = createProjection(pose);
    const image = renderDrrCpu(phantom, pose);
    for (const [x, y] of [
      [0, 0],
      [255, 255],
      [300, 180],
      [100, 400],
      [511, 511],
    ] as const) {
      const expected = transmissionAt(phantom, projection, { x: x + 0.5, y: y + 0.5 });
      expect(image.data[x + 512 * y]).toBe(Math.fround(expected));
    }
  });

  it('keeps every value of the phantom image within 0…1', () => {
    const image = renderDrrCpu(createPhantom(), initialState().pose);
    expect(image.data.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it('on the phantom at the default pose, the upper vertebra block centre is darker than pixel (0, 0)', () => {
    const pose = initialState().pose;
    const image = renderDrrCpu(createPhantom(), pose);
    const p = createProjection(pose).project(PHANTOM_TEST_POINTS.blockCentres.upper);
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    const block = image.data[x + 512 * y]!;
    const corner = image.data[0]!;
    expect(corner).toBe(1); // the corner ray crosses only air
    expect(block).toBeLessThan(corner);
    expect(block).toBeLessThan(0.5);
  });
});

describe('absorption law on a uniform slab at pose (0°, 0°)', () => {
  it('the centre pixel gets darker each time the slab gets thicker', () => {
    const values = [10, 20, 40, 80].map(centreTransmission);
    expect(values[0]).toBeLessThan(1);
    for (let n = 1; n < values.length; n++) expect(values[n]!).toBeLessThan(values[n - 1]!);
  });

  it('follows e^(−absorption per mm × thickness)', () => {
    const expected = Math.exp(-(SLAB_INTENSITY / 255) * ABSORPTION_PER_MM * 20);
    expect(centreTransmission(20)).toBeCloseTo(expected, 6);
  });

  it('doubling the thickness squares the transmitted fraction, within 2%', () => {
    for (const thickness of [10, 20, 40]) {
      const single = centreTransmission(thickness);
      const double = centreTransmission(thickness * 2);
      expect(Math.abs(double - single * single) / (single * single)).toBeLessThan(0.02);
    }
  });

  it('the whole-image render agrees at the centre pixels', () => {
    const image = renderDrrCpu(slabVolume(20), AP_POSE);
    const expected = Math.exp(-(SLAB_INTENSITY / 255) * ABSORPTION_PER_MM * 20);
    // Pixel (255, 255) is half a pixel off the central ray, so its path is a touch longer.
    expect(image.data[255 + 512 * 255]!).toBeGreaterThan(expected * 0.98);
    expect(image.data[255 + 512 * 255]!).toBeLessThan(expected * 1.02);
  });
});

describe('volume layout', () => {
  it('rejects a volume whose orientation is not the identity, with a clear error', () => {
    const turned: Volume = {
      ...slabVolume(20),
      orientation: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
      ],
    };
    expect(() => renderDrrCpu(turned, AP_POSE)).toThrow(/orientation/i);
    expect(() => transmissionAt(turned, createProjection(AP_POSE), IMAGE_CENTRE)).toThrow(/orientation/i);
  });

  it('accepts the identity orientation', () => {
    expect(() => transmissionAt(slabVolume(20), createProjection(AP_POSE), IMAGE_CENTRE)).not.toThrow();
  });
});
