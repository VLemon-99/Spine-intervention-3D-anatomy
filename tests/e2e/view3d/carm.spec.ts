// F8.1, F8.2: the C-arm source, detector and beam follow the live pose.
import { expect, test } from '@playwright/test';
import { DETECTOR_SIZE_MM, createProjection } from '../../../src/core/geometry';
import type { CArmPose, Vec3 } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose } from '../../fixtures/simPage';
import { getView3d, press, sceneObject } from './view3dPage';

const TOLERANCE_MM = 0.5;
const ZERO: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Expected corners: top-left, top-right, bottom-right, bottom-left. */
function expectedCorners(pose: CArmPose): Vec3[] {
  const p = createProjection(pose);
  const h = DETECTOR_SIZE_MM / 2;
  return [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ].map(([r, u]) => ({
    x: p.detectorCentre.x + h * (r! * p.detectorRight.x + u! * p.detectorUp.x),
    y: p.detectorCentre.y + h * (r! * p.detectorRight.y + u! * p.detectorUp.y),
    z: p.detectorCentre.z + h * (r! * p.detectorRight.z + u! * p.detectorUp.z),
  }));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await press(page, 'view3d-toggle');
  await expect(page.getByTestId('view3d-canvas')).toBeVisible();
});

test('the source, detector and beam are visible objects in the scene', async ({ page }) => {
  const info = await getView3d(page);
  for (const name of ['source', 'detector', 'beam']) {
    const object = sceneObject(info, name);
    expect(object, `${name} in ${JSON.stringify(info.objects)}`).toBeDefined();
    expect(object!.visible, name).toBe(true);
  }
});

const POSES: { label: string; pose: CArmPose }[] = [
  { label: 'oblique and tilt', pose: { ...ZERO, oblique: 30, tilt: -12 } },
  { label: 'table offsets', pose: { ...ZERO, tableLeftRight: 25, tableHeadFoot: -40, tableHeight: 15 } },
  { label: 'lateral', pose: { ...ZERO, oblique: 90 } },
];

test('after each pose change the C-arm parts match the projection within 0.5 mm', async ({ page }) => {
  for (const { label, pose } of POSES) {
    await setPose(page, pose);
    const projection = createProjection(pose);
    await expect
      .poll(async () => distance((await getView3d(page)).carm.source, projection.source), { message: label })
      .toBeLessThan(TOLERANCE_MM);
    const { carm } = await getView3d(page);
    expect(distance(carm.detectorCentre, projection.detectorCentre), label).toBeLessThan(TOLERANCE_MM);
    expect(carm.detectorCorners).toHaveLength(4);
    expectedCorners(pose).forEach((corner, i) => {
      expect(distance(carm.detectorCorners[i]!, corner), `${label} corner ${i}`).toBeLessThan(TOLERANCE_MM);
    });
  }
});
