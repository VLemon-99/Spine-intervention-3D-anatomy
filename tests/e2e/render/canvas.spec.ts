import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { readCanvas } from '../../fixtures/readCanvas';

const CORNERS_AND_CENTRE = [
  { x: 0, y: 0 },
  { x: 511, y: 0 },
  { x: 0, y: 511 },
  { x: 511, y: 511 },
  { x: 256, y: 256 },
];

async function takeImage(page: Page): Promise<void> {
  const before = await page.evaluate(
    () => (window as unknown as { __sim: { getState(): { shotCount: number } } }).__sim.getState().shotCount,
  );
  if (test.info().project.use.hasTouch) {
    await page.getByTestId('shot-button').tap();
  } else {
    await page.keyboard.press('Space');
  }
  await page.waitForFunction(
    (n) => (window as unknown as { __sim: { getState(): { shotCount: number } } }).__sim.getState().shotCount > n,
    before,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => 'getState' in ((window as { __sim?: object }).__sim ?? {}));
  await acceptDisclaimer(page);
});

test('the fluoro panel contains a canvas with a 512×512 drawing size', async ({ page }) => {
  const canvas = page.getByTestId('fluoro-panel').getByTestId('fluoro-canvas');
  await expect(canvas).toBeVisible();
  const size = await canvas.evaluate((c) => [(c as HTMLCanvasElement).width, (c as HTMLCanvasElement).height]);
  expect(size).toEqual([512, 512]);
});

test('readCanvas returns grey values 0–255 at the corners and centre', async ({ page }) => {
  const blank = await readCanvas(page, CORNERS_AND_CENTRE);
  await takeImage(page);
  const image = await readCanvas(page, CORNERS_AND_CENTRE);
  for (const values of [blank, image]) {
    expect(values).toHaveLength(CORNERS_AND_CENTRE.length);
    for (const v of values) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  }
});

test('the pixels after taking an image differ from the blank screen before it', async ({ page }) => {
  const blank = await readCanvas(page, CORNERS_AND_CENTRE);
  await takeImage(page);
  await expect.poll(() => readCanvas(page, CORNERS_AND_CENTRE)).not.toEqual(blank);
});
