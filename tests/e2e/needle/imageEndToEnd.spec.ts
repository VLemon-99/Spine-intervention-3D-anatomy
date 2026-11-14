// F5-S15: end to end with the real needle controls (F5) and the needle in the
// image (F7): the needle steered with the real controls shows on the next
// image (F7.1), and moving it without a new image leaves the picture
// unchanged (last image hold, F7.4).
import { expect, test, type Page } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import type { CArmPose, Vec3 } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas } from '../../fixtures/readCanvas';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import { markEntryAtPixel, readNeedle, waitForVolume } from './needlePage';

const isTablet = () => test.info().project.use.hasTouch === true;
const OBLIQUE_20: CArmPose = { oblique: 20, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };

/** Advance `mm` whole millimetres with the real controls: W on desktop, the Advance button on the tablet. */
async function advanceWithControls(page: Page, mm: number): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const start = (await readNeedle(page))!.insertedDepth;
  for (let i = 1; i <= mm; i++) {
    if (isTablet()) await page.getByTestId('needle-advance').tap();
    else await page.keyboard.press('w');
    await expect.poll(async () => (await readNeedle(page))!.insertedDepth).toBeCloseTo(start + i, 6);
  }
}

async function press(page: Page, testId: string): Promise<void> {
  if (isTablet()) await page.getByTestId(testId).tap();
  else await page.getByTestId(testId).click();
}

const lastImageTip = (page: Page): Promise<Vec3 | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __sim: { render(): { lastImage: { needleTip: Vec3 | null } | null } } }).__sim.render()
        .lastImage?.needleTip ?? null,
  );

/** A checksum of every pixel of the fluoro canvas, to tell whether the picture changed. */
function canvasChecksum(page: Page): Promise<string> {
  return page.getByTestId('fluoro-canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext('2d')!;
    context.drawImage(canvas, 0, 0);
    const { data } = context.getImageData(0, 0, copy.width, copy.height);
    let a = 1;
    let b = 0;
    for (let i = 0; i < data.length; i++) {
      a = (a + data[i]!) % 65521;
      b = (b + a) % 65521;
    }
    return `${b.toString(16)}-${a.toString(16)}`;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await waitForVolume(page);
  // Pose 0°/0°: one image, mark the entry on the midline, advance 30 mm with the real controls.
  await takeImage(page);
  expect(await markEntryAtPixel(page, { x: 256, y: 256 })).toBe('ok');
  await advanceWithControls(page, 30);
  // Oblique 20° through the store, then a new image.
  await setPose(page, { oblique: 20 });
  await takeImage(page);
});

test('the new image holds the needle tip and the tip pixel is darker than with no needle', async ({ page }) => {
  const tip = (await readNeedle(page))!.tip;
  const imageTip = await lastImageTip(page);
  expect(imageTip).not.toBeNull();
  expect(Math.hypot(imageTip!.x - tip.x, imageTip!.y - tip.y, imageTip!.z - tip.z)).toBeLessThanOrEqual(0.01);

  const pixel = createProjection(OBLIQUE_20).project(tip);
  const [withNeedle] = await readCanvas(page, [pixel]);

  // The same pose with no needle: Withdraw fully, then a new image.
  await press(page, 'needle-withdraw-all');
  await expect.poll(() => readNeedle(page)).toBeNull();
  await takeImage(page);
  expect(await lastImageTip(page)).toBeNull();
  const [without] = await readCanvas(page, [pixel]);
  expect(withNeedle!, `tip pixel (${pixel.x.toFixed(1)}, ${pixel.y.toFixed(1)}): ${withNeedle} with, ${without} without`).toBeLessThan(without!);
});

test('advancing 5 mm more without a new image leaves the picture unchanged', async ({ page }) => {
  const before = await canvasChecksum(page);
  const tipInImage = await lastImageTip(page);
  await advanceWithControls(page, 5);
  expect(await canvasChecksum(page)).toBe(before);
  expect(await lastImageTip(page)).toEqual(tipInImage);
});
