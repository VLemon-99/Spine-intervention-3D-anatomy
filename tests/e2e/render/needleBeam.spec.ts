// F7.3: a needle exactly along the beam ("down the beam") projects to a small
// spot; the same needle at 30° to the beam appears as a line. Fixed depth: the
// needle is 40 mm inside the phantom, entering on the back, at pose 0°/0°.
import { expect, test, type Page } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import type { CArmPose, Vec3 } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import { longestExtent, needlePixels, putNeedle, readWholeCanvas, straightTestNeedle } from './renderPage';

const POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const DEPTH_MM = 40;
const projection = createProjection(POSE);

/** The skin entry on the back: the phantom's body is round about the z axis with its skin at 42 mm. */
const ENTRY: Vec3 = { x: 25, y: Math.sqrt(42 * 42 - 25 * 25), z: -20 };

const unit = (v: Vec3): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
};
const along = (p: Vec3, d: Vec3, s: number): Vec3 => ({ x: p.x + d.x * s, y: p.y + d.y * s, z: p.z + d.z * s });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** Along the ray from the entry toward the source: against the beam, into the patient. */
const DOWN_THE_BEAM = unit({
  x: projection.source.x - ENTRY.x,
  y: projection.source.y - ENTRY.y,
  z: projection.source.z - ENTRY.z,
});
/** A direction at right angles to it, toward the feet (−z), in the plane of the ray and the z axis. */
const TOWARD_FEET = unit(along({ x: 0, y: 0, z: -1 }, DOWN_THE_BEAM, DOWN_THE_BEAM.z));
/** 30° from the down-the-beam direction, tipped toward the feet: cos 30° along the ray + sin 30° across it. */
const ANGLED = unit(along(along({ x: 0, y: 0, z: 0 }, DOWN_THE_BEAM, Math.cos(Math.PI / 6)), TOWARD_FEET, Math.sin(Math.PI / 6)));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await setPose(page, POSE);
});

/** The needle pixels of a needle from the entry, DEPTH_MM long in direction `direction` (default display settings). */
async function needlePixelsFor(page: Page, direction: Vec3): Promise<{ x: number; y: number }[]> {
  await takeImage(page);
  const without = await readWholeCanvas(page);
  await putNeedle(page, straightTestNeedle(ENTRY, along(ENTRY, direction, DEPTH_MM)));
  await takeImage(page);
  return needlePixels(await readWholeCanvas(page), without);
}

test('the test needles are set up as described', () => {
  // The entry is on the skin of the back, and both tips are 40 mm inside the body.
  expect(Math.hypot(ENTRY.x, ENTRY.y)).toBeCloseTo(42, 6);
  expect(ENTRY.y).toBeGreaterThan(0);
  for (const d of [DOWN_THE_BEAM, ANGLED]) {
    const tip = along(ENTRY, d, DEPTH_MM);
    expect(Math.hypot(tip.x, tip.y)).toBeLessThan(42);
    expect(Math.abs(tip.z)).toBeLessThan(42);
  }
  // Down the beam: both ends project to the same place. Angled: 30° to that ray.
  const a = projection.project(ENTRY);
  const b = projection.project(along(ENTRY, DOWN_THE_BEAM, DEPTH_MM));
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-6);
  expect((Math.acos(dot(ANGLED, DOWN_THE_BEAM)) * 180) / Math.PI).toBeCloseTo(30, 6);
});

test('down the beam, the needle’s pixel spot is no longer than 4 px', async ({ page }) => {
  const pixels = await needlePixelsFor(page, DOWN_THE_BEAM);
  expect(pixels.length, 'the needle shows as some pixels').toBeGreaterThan(0);
  const extent = longestExtent(pixels);
  expect(extent, `spot of ${pixels.length} pixels, ${extent.toFixed(2)} px long`).toBeLessThanOrEqual(4);
});

test('at 30° to the beam, the needle’s line is longer than 20 px', async ({ page }) => {
  const pixels = await needlePixelsFor(page, ANGLED);
  const extent = longestExtent(pixels);
  expect(extent, `line of ${pixels.length} pixels, ${extent.toFixed(2)} px long`).toBeGreaterThan(20);
});
