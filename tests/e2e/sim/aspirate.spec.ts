// F6.4: the Aspirate button in the sim section shows what comes back.
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';
import { getSim, needleWithTip, press, putNeedle } from './simZone';

const THECAL_SAC_TIP = { x: 0, y: 11, z: 0 };
const VEIN_TIP = { x: -9, y: -28, z: 0 };
const MUSCLE_TIP = { x: 0, y: 30, z: 0 };

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await getSim(page);
});

test('tip in the thecal sac gives CSF; in the vein Blood; in muscle Nothing', async ({ page }) => {
  const result = page.getByTestId('aspirate-result');
  for (const [tip, key, text] of [
    [THECAL_SAC_TIP, 'thecalSac', 'CSF'],
    [VEIN_TIP, 'vein', 'Blood'],
    [MUSCLE_TIP, 'muscle', 'Nothing'],
  ] as const) {
    await putNeedle(page, needleWithTip(tip));
    await expect.poll(async () => (await getSim(page)).tipTissue).toBe(key);
    await press(page, 'aspirate');
    await expect(result).toBeVisible();
    await expect(result).toHaveText(text);
  }
});

test('in Free play with no caseStart ever emitted, Aspirate in the vein still gives Blood and the seed is a number', async ({
  page,
}) => {
  const sim = await getSim(page);
  expect(typeof sim.seed).toBe('number');
  expect(Number.isFinite(sim.seed)).toBe(true);
  await putNeedle(page, needleWithTip(VEIN_TIP));
  await press(page, 'aspirate');
  await expect(page.getByTestId('aspirate-result')).toHaveText('Blood');
});

test('the Aspirate button is disabled with no needle', async ({ page }) => {
  await expect(page.getByTestId('aspirate')).toBeVisible();
  await expect(page.getByTestId('aspirate')).toBeDisabled();
  await putNeedle(page, needleWithTip(MUSCLE_TIP));
  await expect(page.getByTestId('aspirate')).toBeEnabled();
  await putNeedle(page, null);
  await expect(page.getByTestId('aspirate')).toBeDisabled();
});

test.describe('tablet', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'tablet set-up only');

  test('the Aspirate button is at least 44×44 px and inside the viewport', async ({ page }) => {
    const box = await page.getByTestId('aspirate').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('aspirate')).toBeInViewport();
  });
});

test('the page still does not scroll with the Aspirate row', async ({ page }) => {
  await putNeedle(page, needleWithTip(VEIN_TIP));
  await press(page, 'aspirate');
  const viewport = page.viewportSize()!;
  const scroll = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  expect(scroll).toEqual(viewport);
  const panel = (await page.getByTestId('needle-panel').boundingBox())!;
  const button = (await page.getByTestId('aspirate').boundingBox())!;
  expect(button.y + button.height).toBeLessThanOrEqual(panel.y + panel.height + 0.5);
});
