// F2.2: the GPU image on the canvas matches the CPU reference (renderDrrCpu)
// on the phantom at three poses.
import { expect, test } from '@playwright/test';
import { createPhantom } from '../../../src/core/phantom';
import type { CArmPose } from '../../../src/core/types';
import { renderDrrCpu } from '../../../src/render/drrCpu';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import { readWholeCanvas, setRenderSettings } from './renderPage';

/** 3% of the grey range (0–255). */
const MAX_MEAN_DIFFERENCE = 0.03 * 255;

const POSES: { name: string; pose: CArmPose }[] = [
  { name: 'the default pose', pose: { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 } },
  {
    name: 'oblique +30°, tilt +15°',
    pose: { oblique: 30, tilt: 15, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 },
  },
  {
    name: 'oblique −45°, tilt −20°, table moved on all three axes',
    pose: { oblique: -45, tilt: -20, tableLeftRight: 10, tableHeadFoot: -15, tableHeight: 20 },
  },
];

const phantom = createPhantom();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

for (const { name, pose } of POSES) {
  test(`the canvas matches the CPU reference at ${name}`, async ({ page }) => {
    const reference = renderDrrCpu(phantom, pose);
    // A blank reference could match a blank canvas: it must show dark anatomy and open air.
    expect(reference.data.some((v) => v < 0.5)).toBe(true);
    expect(reference.data.some((v) => v === 1)).toBe(true);

    await setPose(page, pose);
    await setRenderSettings(page, { noiseLevel: 0 });
    await takeImage(page);
    expect((await getSimState(page)).lastImagePose).toEqual(pose);

    const canvas = await readWholeCanvas(page);
    expect([canvas.width, canvas.height]).toEqual([reference.width, reference.height]);
    expect(canvas.data.length).toBe(reference.data.length);

    let sum = 0;
    let worst = 0;
    for (let i = 0; i < canvas.data.length; i++) {
      const difference = Math.abs(canvas.data[i]! - reference.data[i]! * 255);
      sum += difference;
      worst = Math.max(worst, difference);
    }
    const mean = sum / canvas.data.length;
    expect(mean, `mean difference ${mean.toFixed(3)} grey levels, worst pixel ${worst.toFixed(1)}`).toBeLessThanOrEqual(
      MAX_MEAN_DIFFERENCE,
    );
  });
}
