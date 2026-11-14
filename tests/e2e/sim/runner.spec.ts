// F6.1–F6.3: the sim zone watches the app's store and reports the tissue at the tip.
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';
import { getSim, needleWithTip, putNeedle } from './simZone';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test('with no needle, the sim reports no tissue and no events', async ({ page }) => {
  const sim = await getSim(page);
  expect(sim.tipTissue).toBeNull();
  expect(sim.resistance).toBeNull();
  expect(sim.events).toEqual([]);
});

test('a hand-made needle with its tip in the epidural space makes tipTissue epiduralSpace', async ({ page }) => {
  await getSim(page);
  await putNeedle(page, needleWithTip({ x: 0, y: 14, z: 0 }));
  await expect.poll(async () => (await getSim(page)).tipTissue).toBe('epiduralSpace');
  expect((await getSim(page)).resistance).toBeLessThan(0.2);
});

test('moving the needle from the ligamentum flavum into the epidural space records loss of resistance', async ({ page }) => {
  await getSim(page);
  await putNeedle(page, needleWithTip({ x: 0, y: 19, z: 0 }));
  await putNeedle(page, needleWithTip({ x: 0, y: 14, z: 0 }));
  await expect.poll(async () => (await getSim(page)).events.map((e) => e.type)).toEqual(['lossOfResistance']);
});
