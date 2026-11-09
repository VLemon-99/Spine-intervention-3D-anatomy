import { expect, test } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import { PHANTOM_TEST_POINTS } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas } from '../../fixtures/readCanvas';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';

const CORNERS = [
  { x: 0, y: 0 },
  { x: 511, y: 0 },
  { x: 0, y: 511 },
  { x: 511, y: 511 },
];
const BLOCKS = [PHANTOM_TEST_POINTS.blockCentres.upper, PHANTOM_TEST_POINTS.blockCentres.lower];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

async function expectOutline(page: import('@playwright/test').Page, pose: CArmPose): Promise<void> {
  const projection = createProjection(pose);
  const blockPixels = BLOCKS.map((p) => projection.project(p));
  const blocks = await readCanvas(page, blockPixels);
  const corners = await readCanvas(page, CORNERS);
  const darkestCorner = Math.min(...corners);
  for (const value of blocks) {
    expect(darkestCorner - value, `block ${value} vs corners ${corners.join(', ')}`).toBeGreaterThanOrEqual(50);
  }
}

test('at the default pose, the block centres are dark and the corners light', async ({ page }) => {
  await takeImage(page);
  const { lastImagePose } = await getSimState(page);
  expect(lastImagePose).toEqual({ oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 });
  await expectOutline(page, lastImagePose as CArmPose);
});

test('at oblique +30° and tilt +15°, the block centres are still dark and the corners light', async ({ page }) => {
  await setPose(page, { oblique: 30, tilt: 15 });
  await takeImage(page);
  const { lastImagePose } = await getSimState(page);
  expect(lastImagePose?.oblique).toBe(30);
  expect(lastImagePose?.tilt).toBe(15);
  await expectOutline(page, lastImagePose as CArmPose);
});
