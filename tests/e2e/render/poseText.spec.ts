// F2.9: the pose of the image on screen, as text lying over the fluoro image.
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import { press, setRenderSettings } from './renderPage';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test("the label is empty before the first image and reads 'AP · TILT 0°' after an image at the default pose", async ({
  page,
}) => {
  const label = page.getByTestId('fluoro-panel').getByTestId('pose-readout');
  await expect(label).toBeAttached();
  await expect(label).toHaveText('');
  await takeImage(page);
  await expect(label).toHaveText('AP · TILT 0°');
});

test('the label shows the pose of the image on screen: it changes only when an image is taken', async ({ page }) => {
  const label = page.getByTestId('pose-readout');
  await takeImage(page);
  await expect(label).toHaveText('AP · TILT 0°');

  await setPose(page, { oblique: 25, tilt: 10 });
  expect((await getSimState(page)).pose.oblique).toBe(25);
  await expect(label).toHaveText('AP · TILT 0°');

  await takeImage(page);
  await expect(label).toHaveText('OBL R 25° · CRAN 10°');

  // Left oblique and caudal tilt; the table position is not shown.
  await setPose(page, { oblique: -30, tilt: -15, tableLeftRight: 20 });
  await expect(label).toHaveText('OBL R 25° · CRAN 10°');
  await takeImage(page);
  await expect(label).toHaveText('OBL L 30° · CAUD 15°');
});

test('the label lies inside the canvas on screen, and the canvas drawing size is 512×512', async ({ page }) => {
  const canvas = page.getByTestId('fluoro-canvas');
  const label = page.getByTestId('pose-readout');
  expect(await canvas.evaluate((c) => [(c as HTMLCanvasElement).width, (c as HTMLCanvasElement).height])).toEqual([
    512, 512,
  ]);
  await setPose(page, { oblique: -30, tilt: -15 });
  await takeImage(page);
  await expect(label).toHaveText('OBL L 30° · CAUD 15°');
  await expect(label).toBeVisible();

  const inside = async (): Promise<void> => {
    const c = (await canvas.boundingBox())!;
    const l = (await label.boundingBox())!;
    expect(l.width).toBeGreaterThan(20);
    expect(l.height).toBeGreaterThan(8);
    expect(l.x).toBeGreaterThanOrEqual(c.x);
    expect(l.y).toBeGreaterThanOrEqual(c.y);
    expect(l.x + l.width).toBeLessThanOrEqual(c.x + c.width);
    expect(l.y + l.height).toBeLessThanOrEqual(c.y + c.height);
    // Top-left part of the picture.
    expect(l.x + l.width / 2).toBeLessThan(c.x + c.width / 2);
    expect(l.y + l.height / 2).toBeLessThan(c.y + c.height / 4);
  };
  await inside();
  // Still inside when the controls change size (collimation sliders folded out).
  await press(page, 'collimation-toggle');
  await inside();
});

test('the label is not flipped or rotated with the picture', async ({ page }) => {
  const label = page.getByTestId('pose-readout');
  await takeImage(page);
  const before = await label.boundingBox();
  await setRenderSettings(page, { flipHorizontal: true, flipVertical: true, rotation: 90, invert: true });
  await expect(label).toHaveText('AP · TILT 0°');
  expect(await label.boundingBox()).toEqual(before);
});

test('the label does not block the image: the point at its centre belongs to the canvas', async ({ page }) => {
  await takeImage(page);
  const label = page.getByTestId('pose-readout');
  await expect(label).toHaveText('AP · TILT 0°');
  const box = (await label.boundingBox())!;
  const hit = await page.evaluate(
    ([x, y]) => (document.elementFromPoint(x!, y!) as HTMLElement | null)?.dataset.testid ?? null,
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(hit).toBe('fluoro-canvas');
});
