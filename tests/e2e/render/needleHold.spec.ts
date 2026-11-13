// F7.4: the needle in the image is the needle at the moment of the exposure.
// Moving the needle afterwards does not change the held image, also not when
// a display setting re-shows it; the next image shows the new needle.
import { expect, test } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import type { CArmPose, Vec3 } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import {
  getRenderInfo,
  press,
  putNeedle,
  readWholeCanvas,
  samePixels,
  setRenderSettings,
  straightTestNeedle,
} from './renderPage';

const POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const projection = createProjection(POSE);

/**
 * Two needles across the beam in muscle above the upper block (bone ends at
 * z = 26, the skin starts at z = 38); the second 3 mm further toward the head.
 */
const OLD = { hub: { x: -10, y: 30, z: 32 }, tip: { x: 10, y: 30, z: 32 } };
const NEW = { hub: { x: -10, y: 30, z: 35 }, tip: { x: 10, y: 30, z: 35 } };
const middle = (n: { hub: Vec3; tip: Vec3 }): Vec3 => ({ x: 0, y: n.hub.y, z: n.hub.z });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await setRenderSettings(page, { noiseLevel: 0 });
  await setPose(page, POSE);
});

test('moving the needle after an image leaves the held image and its needleTip unchanged', async ({ page }) => {
  await putNeedle(page, straightTestNeedle(OLD.hub, OLD.tip));
  await takeImage(page);
  const before = await readWholeCanvas(page);
  expect((await getRenderInfo(page)).lastImage?.needleTip).toEqual(OLD.tip);

  await putNeedle(page, straightTestNeedle(NEW.hub, NEW.tip));
  expect(samePixels(await readWholeCanvas(page), before)).toBe(true);
  expect((await getRenderInfo(page)).lastImage?.needleTip).toEqual(OLD.tip);
});

test('after the next image the picture changes and needleTip is the new tip', async ({ page }) => {
  await putNeedle(page, straightTestNeedle(OLD.hub, OLD.tip));
  await takeImage(page);
  const before = await readWholeCanvas(page);
  await putNeedle(page, straightTestNeedle(NEW.hub, NEW.tip));
  await takeImage(page);
  expect(samePixels(await readWholeCanvas(page), before)).toBe(false);
  expect((await getRenderInfo(page)).lastImage?.needleTip).toEqual(NEW.tip);
});

test('with no needle at the exposure needleTip is null', async ({ page }) => {
  await takeImage(page);
  expect((await getRenderInfo(page)).lastImage?.needleTip).toBeNull();
});

test('turning Invert on after moving the needle shows the inverted image with the OLD needle', async ({ page }) => {
  await putNeedle(page, straightTestNeedle(OLD.hub, OLD.tip));
  await takeImage(page);
  await putNeedle(page, straightTestNeedle(NEW.hub, NEW.tip));
  await press(page, 'invert-toggle');
  await expect.poll(async () => (await getRenderInfo(page)).settings.invert).toBe(true);

  const canvas = await readWholeCanvas(page);
  const grey = (x: number, y: number): number => canvas.data[x + canvas.width * y]!;
  const at = (p: Vec3): { x: number; y: number } => {
    const q = projection.project(p);
    return { x: Math.floor(q.x), y: Math.floor(q.y) };
  };
  // Inverted: the needle (strong absorption) is lighter than the tissue 5 px above and below it.
  const old = at(middle(OLD));
  expect(grey(old.x, old.y)).toBeGreaterThan(grey(old.x, old.y - 5) + 20);
  expect(grey(old.x, old.y)).toBeGreaterThan(grey(old.x, old.y + 5) + 20);
  // At the new place there is no needle in the held image.
  const moved = at(middle(NEW));
  expect(Math.abs(grey(moved.x, moved.y) - grey(moved.x, moved.y - 5))).toBeLessThan(20);
});
