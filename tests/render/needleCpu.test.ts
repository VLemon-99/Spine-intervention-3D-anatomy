import { describe, expect, it } from 'vitest';
import { createProjection, type Pixel } from '../../src/core/geometry';
import { PHANTOM_TEST_POINTS, createPhantom } from '../../src/core/phantom';
import type { CArmPose, Vec3 } from '../../src/core/types';
import { renderDrrCpu, transmissionAt } from '../../src/render/drrCpu';

const POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const phantom = createPhantom();
const projection = createProjection(POSE);

/** A straight needle from a to b, as a shaft of several points (hub → tip). */
function straightNeedle(a: Vec3, b: Vec3, count = 11): Vec3[] {
  return Array.from({ length: count }, (_, i) => {
    const f = i / (count - 1);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
  });
}

/** The centre of the image pixel that point p projects into. */
function pixelCentreOf(p: Vec3): Pixel {
  const q = projection.project(p);
  return { x: Math.floor(q.x) + 0.5, y: Math.floor(q.y) + 0.5 };
}

const at = (pixel: Pixel, needle?: Vec3[]): number =>
  transmissionAt(phantom, projection, pixel, needle ? { needle } : {});

describe('the needle in the CPU reference image', () => {
  it('a needle across the beam in muscle is darker at its middle than 5 px to either side, and than without it', () => {
    // Along x, behind the laminae and above the upper block: muscle all round.
    const needle = straightNeedle({ x: -10, y: 30, z: 32 }, { x: 10, y: 30, z: 32 });
    const middle = pixelCentreOf({ x: 0, y: 30, z: 32 });
    const onNeedle = at(middle, needle);
    // The needle runs left-right in the image, so "to the side" is up and down.
    expect(onNeedle).toBeLessThan(at({ x: middle.x, y: middle.y - 5 }, needle));
    expect(onNeedle).toBeLessThan(at({ x: middle.x, y: middle.y + 5 }, needle));
    expect(onNeedle).toBeLessThan(at(middle));
  });

  it('a needle in muscle beside the spine is darker than the projected upper vertebra body centre (metal is darker than bone)', () => {
    const needle = straightNeedle({ x: 30, y: 0, z: -10 }, { x: 30, y: 0, z: 10 });
    const onNeedle = at(pixelCentreOf({ x: 30, y: 0, z: 0 }), needle);
    const onBone = at(pixelCentreOf(PHANTOM_TEST_POINTS.blockCentres.upper), needle);
    expect(onNeedle).toBeLessThan(onBone);
  });

  it('a needle outside the volume’s box (in the air at y = 55 mm) still darkens its pixels', () => {
    const needle = straightNeedle({ x: -10, y: 55, z: 10 }, { x: 10, y: 55, z: 10 });
    const middle = pixelCentreOf({ x: 0, y: 55, z: 10 });
    expect(at(middle, needle)).toBeLessThan(at(middle) * 0.5);
  });

  it('renderDrrCpu draws the needle too, at the same value as transmissionAt', () => {
    const needle = straightNeedle({ x: -10, y: 30, z: 32 }, { x: 10, y: 30, z: 32 });
    const middle = pixelCentreOf({ x: 0, y: 30, z: 32 });
    const image = renderDrrCpu(phantom, POSE, { needle });
    const value = image.data[Math.floor(middle.x) + image.width * Math.floor(middle.y)]!;
    expect(value).toBeCloseTo(at(middle, needle), 6);
    expect(value).toBeLessThan(at(middle));
  });

  it('with no needle option every pixel is the same as before (no needle, an empty shaft, or none given)', () => {
    const before = renderDrrCpu(phantom, POSE);
    const noNeedle = renderDrrCpu(phantom, POSE, { needle: undefined });
    const empty = renderDrrCpu(phantom, POSE, { needle: [] });
    expect(noNeedle.data).toEqual(before.data);
    expect(empty.data).toEqual(before.data);
  });
});
