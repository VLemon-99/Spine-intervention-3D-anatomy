// F7.2: the needle tip found in the image lands on geometry.project(tip)
// within 2 px, for 5 poses drawn with a seed, with default display settings.
import { expect, test } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import type { Vec3 } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import { findTipPixel, needlePixels, putNeedle, readWholeCanvas, seededPoses, straightTestNeedle } from './renderPage';

const SEED = 7;
const POSES = seededPoses(SEED);

/**
 * A needle running toward the feet in the muscle to the patient's left of the
 * spine (outside the bone boxes |x| ≤ 18 and the nerve roots |x| ≤ 26); its
 * tip at (28, 10, −30) is in muscle. It runs across every beam in the pose range.
 */
const HUB: Vec3 = { x: 28, y: 14, z: -8 };
const TIP: Vec3 = { x: 28, y: 10, z: -30 };

test('the same seed always gives the same 5 poses, inside the ranges', () => {
  expect(seededPoses(SEED)).toEqual(POSES);
  expect(POSES).toHaveLength(5);
  for (const pose of POSES) {
    expect(Math.abs(pose.oblique)).toBeLessThanOrEqual(40);
    expect(Math.abs(pose.tilt)).toBeLessThanOrEqual(20);
  }
  // Different seeds give different poses (the seed is really used).
  expect(seededPoses(SEED + 1)).not.toEqual(POSES);
});

POSES.forEach((pose, n) => {
  test(`pose ${n + 1} (oblique ${pose.oblique.toFixed(1)}°, tilt ${pose.tilt.toFixed(1)}°): the tip pixel is within 2 px of project(tip)`, async ({
    page,
  }) => {
    await page.goto('/');
    await getSimState(page);
    await acceptDisclaimer(page);
    await setPose(page, pose);

    await takeImage(page);
    const without = await readWholeCanvas(page);
    await putNeedle(page, straightTestNeedle(HUB, TIP));
    await takeImage(page);
    const withNeedle = await readWholeCanvas(page);

    const projection = createProjection(pose);
    const pixels = needlePixels(withNeedle, without);
    expect(pixels.length, 'some needle pixels').toBeGreaterThan(10);
    const found = findTipPixel(pixels, projection.project(HUB));
    const expected = projection.project(TIP);
    expect(found).not.toBeNull();
    const miss = Math.hypot(found!.x - expected.x, found!.y - expected.y);
    expect(miss, `tip found at (${found!.x}, ${found!.y}), expected (${expected.x.toFixed(2)}, ${expected.y.toFixed(2)})`).toBeLessThanOrEqual(2);
  });
});
