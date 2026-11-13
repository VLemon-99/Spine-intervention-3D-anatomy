// F5-S8: Advance / Withdraw buttons that step on a press and move while held (F5.5).
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { markEntryAtPixel, readNeedle, waitForVolume } from './needlePage';

const isTablet = () => test.info().project.use.hasTouch === true;

async function depth(page: Page): Promise<number> {
  const n = await readNeedle(page);
  if (!n) throw new Error('no needle');
  return n.insertedDepth;
}

/** Click on desktop, tap on the tablet. */
async function press(page: Page, testId: string): Promise<void> {
  const button = page.getByTestId(testId);
  if (isTablet()) await button.tap();
  else await button.click();
}

/** Hold a button for `ms`: the mouse on desktop, one finger (CDP touch) on the tablet. */
async function hold(page: Page, testId: string, ms: number): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`no box for ${testId}`);
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (isTablet()) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at, id: 1 }] });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await waitForVolume(page);
  await takeImage(page);
  expect(await markEntryAtPixel(page, { x: 256, y: 256 })).toBe('ok');
});

test('one press of Advance adds 1 mm, one press of Withdraw takes 1 mm away', async ({ page }) => {
  await press(page, 'needle-advance');
  expect(await depth(page)).toBeCloseTo(1, 6);
  await press(page, 'needle-advance');
  expect(await depth(page)).toBeCloseTo(2, 6);
  await press(page, 'needle-withdraw');
  expect(await depth(page)).toBeCloseTo(1, 6);
});

test('holding Advance for 1 s adds 4–7 mm and the depth stops changing after release', async ({ page }) => {
  await hold(page, 'needle-advance', 1000);
  const after = await depth(page);
  expect(after).toBeGreaterThanOrEqual(4);
  expect(after).toBeLessThanOrEqual(7);
  await page.waitForTimeout(400);
  expect(await depth(page)).toBe(after);
});

test.describe('tablet sizes', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'tablet set-up only');
  test('Advance and Withdraw are at least 44×44 px', async ({ page }) => {
    for (const id of ['needle-advance', 'needle-withdraw']) {
      const box = await page.getByTestId(id).boundingBox();
      if (!box) throw new Error(`no box for ${id}`);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
