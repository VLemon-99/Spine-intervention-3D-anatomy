import { expect, test } from '@playwright/test';
import { createProjection, type Pixel } from '../../../src/core/geometry';
import { TISSUE, isBone } from '../../../src/core/labels';
import { PHANTOM_TEST_POINTS, createPhantom } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas } from '../../fixtures/readCanvas';
import { getSimState, takeImage } from '../../fixtures/simPage';

const DEFAULT_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const CORNER = { x: 0, y: 0 };
const phantom = createPhantom();
const projection = createProjection(DEFAULT_POSE);
const blockPixel = projection.project(PHANTOM_TEST_POINTS.blockCentres.upper);
// A point 30 mm to the patient's left of the canal, beside the bones (|x| ≤ 18 mm).
const softTissuePixel = projection.project({ x: 30, y: 0, z: 0 });

/** Labels crossed by a pixel's ray through the phantom, sampled every 0.25 mm. */
function labelsOnRay(pixel: Pixel): number[] {
  const pixelCentre = { x: Math.floor(pixel.x) + 0.5, y: Math.floor(pixel.y) + 0.5 };
  const { origin, direction } = projection.unproject(pixelCentre);
  const { x: nx, y: ny, z: nz } = phantom.size;
  const labels: number[] = [];
  for (let t = 0; t <= 1000; t += 0.25) {
    const i = Math.round((origin.x + t * direction.x - phantom.origin.x) / phantom.spacing.x);
    const j = Math.round((origin.y + t * direction.y - phantom.origin.y) / phantom.spacing.y);
    const k = Math.round((origin.z + t * direction.z - phantom.origin.z) / phantom.spacing.z);
    if (i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz) labels.push(phantom.labels[i + nx * (j + ny * k)] ?? 0);
  }
  return labels;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  // Spacebar on desktop, tap on 'Shot' on the tablet.
  await takeImage(page);
  expect((await getSimState(page)).lastImagePose).toEqual(DEFAULT_POSE);
});

test('the vertebra block centre is at least 50 grey levels darker than an image corner (air)', async ({ page }) => {
  const [block, corner] = await readCanvas(page, [blockPixel, CORNER]);
  expect(corner! - block!, `block ${block}, corner ${corner}`).toBeGreaterThanOrEqual(50);
});

test('bone is darker than soft tissue', async ({ page }) => {
  // Check the comparison point is what it claims: soft tissue but no bone.
  const softLabels = labelsOnRay(softTissuePixel);
  expect(softLabels.some((l) => l === TISSUE.muscle)).toBe(true);
  expect(softLabels.some((l) => isBone(l))).toBe(false);
  expect(labelsOnRay(blockPixel).some((l) => isBone(l))).toBe(true);

  const [block, soft, corner] = await readCanvas(page, [blockPixel, softTissuePixel, CORNER]);
  expect(block!, `block ${block}, soft tissue ${soft}`).toBeLessThan(soft!);
  // Soft tissue is grey: darker than air.
  expect(soft!).toBeLessThan(corner!);
});
