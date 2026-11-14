// F6.1: the sim section in the needle panel shows a resistance bar and, outside
// Exam mode, the name of the tissue at the tip.
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';
import { readFileSync } from 'node:fs';
import { getSim, needleWithTip, putNeedle, setMode } from './simZone';

const tissuesJson = JSON.parse(readFileSync('src/sim/tissues.json', 'utf8')) as {
  resistance: Record<string, number>;
};

const LIGAMENTUM_FLAVUM_TIP = { x: 0, y: 19, z: 0 };

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await getSim(page);
});

test('a needle tip in the ligamentum flavum shows its resistance and the name "Ligamentum flavum"', async ({ page }) => {
  await putNeedle(page, needleWithTip(LIGAMENTUM_FLAVUM_TIP));
  const bar = page.getByTestId('resistance-bar');
  await expect(bar).toHaveAttribute('data-value', String(tissuesJson.resistance.ligamentumFlavum));
  await expect(bar).toBeVisible();
  await expect(page.getByTestId('tip-tissue')).toBeVisible();
  await expect(page.getByTestId('tip-tissue')).toHaveText('Ligamentum flavum');
});

test('the name follows the tip, and Practice mode shows it too', async ({ page }) => {
  await setMode(page, 'practice');
  await putNeedle(page, needleWithTip({ x: 0, y: 14, z: 0 }));
  await expect(page.getByTestId('tip-tissue')).toHaveText('Epidural space');
  await expect(page.getByTestId('resistance-bar')).toHaveAttribute(
    'data-value',
    String(tissuesJson.resistance.epiduralSpace),
  );
});

test('in Exam mode the name is not visible and not in the panel text, but the bar still shows', async ({ page }) => {
  await setMode(page, 'exam');
  await putNeedle(page, needleWithTip(LIGAMENTUM_FLAVUM_TIP));
  const bar = page.getByTestId('resistance-bar');
  await expect(bar).toHaveAttribute('data-value', String(tissuesJson.resistance.ligamentumFlavum));
  await expect(bar).toBeVisible();
  await expect(page.getByTestId('tip-tissue')).toBeHidden();
  await expect(page.getByTestId('needle-panel')).not.toContainText('Ligamentum flavum');
  await expect(page.getByTestId('sim-feedback')).not.toContainText('Ligamentum');

  // Back to Free play: the name comes back.
  await setMode(page, 'freeplay');
  await expect(page.getByTestId('tip-tissue')).toHaveText('Ligamentum flavum');
});

test('with no needle the bar is empty and no name shows', async ({ page }) => {
  const bar = page.getByTestId('resistance-bar');
  await expect(bar).toHaveAttribute('data-value', '');
  await expect(page.getByTestId('tip-tissue')).toBeHidden();

  // A needle, then none again.
  await putNeedle(page, needleWithTip(LIGAMENTUM_FLAVUM_TIP));
  await expect(page.getByTestId('tip-tissue')).toBeVisible();
  await putNeedle(page, null);
  await expect(bar).toHaveAttribute('data-value', '');
  await expect(page.getByTestId('tip-tissue')).toBeHidden();
  await expect(page.getByTestId('sim-feedback')).not.toContainText('Ligamentum');
  const fillWidth = await page
    .getByTestId('resistance-bar-fill')
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(fillWidth).toBe(0);
});

test('the sim section is inside the needle panel and the page does not scroll', async ({ page }) => {
  await putNeedle(page, needleWithTip(LIGAMENTUM_FLAVUM_TIP));
  const inside = page.getByTestId('needle-panel').getByTestId('sim-feedback');
  await expect(inside).toHaveCount(1);
  await expect(inside).toBeVisible();
  await expect(page.getByTestId('resistance-bar')).toBeInViewport();

  // Each set-up's own size: 1280×800 on desktop, 1024×768 on the tablet.
  const viewport = page.viewportSize()!;
  const expected = test.info().project.use.hasTouch ? { width: 1024, height: 768 } : { width: 1280, height: 800 };
  expect(viewport).toEqual(expected);
  const scroll = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  expect(scroll).toEqual(viewport);

  // The whole section fits inside the needle panel.
  const panel = (await page.getByTestId('needle-panel').boundingBox())!;
  const section = (await inside.boundingBox())!;
  expect(section.y + section.height).toBeLessThanOrEqual(panel.y + panel.height + 0.5);
  expect(section.x + section.width).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
});
