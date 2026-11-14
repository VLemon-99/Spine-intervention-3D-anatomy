// F5-S14: end to end with the real needle controls (F5) and the real sim zone
// (F6): advancing from the back skin down the midline gives loss of
// resistance in the epidural space (F6.2, F6.5), and with a needle inserted
// and events in the log all four panels still fit without scrolling (F12.3).
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { markEntryAtPixel, readNeedle, waitForVolume } from './needlePage';

interface SimDebug {
  tipTissue: string | null;
  events: { message: string }[];
}

const readSim = (page: Page): Promise<SimDebug> =>
  page.evaluate(() => (window as unknown as { __sim: { sim(): SimDebug } }).__sim.sim());

/** One 1 mm advance with the real controls: W on desktop, the Advance button on the tablet. */
async function advanceOneMm(page: Page): Promise<void> {
  if (test.info().project.use.hasTouch) await page.getByTestId('needle-advance').tap();
  else await page.keyboard.press('w');
}

/** Marks the entry under the image centre (the midline at 0°/0°) and advances until the tip is past y = 14. */
async function advanceToEpidural(page: Page): Promise<void> {
  await takeImage(page);
  expect(await markEntryAtPixel(page, { x: 256, y: 256 })).toBe('ok');
  const entry = (await readNeedle(page))!.entryPoint;
  expect(Math.abs(entry.x)).toBeLessThan(0.5);
  expect(Math.abs(entry.z)).toBeLessThan(0.5);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < 40; i++) {
    const before = (await readNeedle(page))!.insertedDepth;
    await advanceOneMm(page);
    await expect.poll(async () => (await readNeedle(page))!.insertedDepth).toBeGreaterThan(before + 0.5);
    if ((await readNeedle(page))!.tip.y < 14) return;
  }
  throw new Error('the tip never got past y = 14');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await waitForVolume(page);
});

test('advancing down the midline past y = 14 shows "Loss of resistance" with the tip in the epidural space', async ({ page }) => {
  await advanceToEpidural(page);
  const sim = await readSim(page);
  expect(sim.tipTissue).toBe('epiduralSpace');
  expect(sim.events.map((e) => e.message)).toContain('Loss of resistance');
  const log = page.getByTestId('needle-panel').getByTestId('event-log');
  await expect(log).toContainText('Loss of resistance');
});

test('with a needle inserted and events in the log, all four panels are visible and the page does not scroll', async ({ page }) => {
  await advanceToEpidural(page);
  await expect(page.getByTestId('event-log-row').first()).toBeVisible();
  const viewport = page.viewportSize()!;
  for (const id of ['fluoro-panel', 'carm-panel', 'needle-panel', 'view3d-panel']) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.x, `${id} left`).toBeGreaterThanOrEqual(0);
    expect(box.y, `${id} top`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${id} right`).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, `${id} bottom`).toBeLessThanOrEqual(viewport.height);
  }
  const scroll = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  expect(scroll).toEqual(viewport);
  // Everything in the needle panel stays inside it (the panel hides overflow).
  const panel = (await page.getByTestId('needle-panel').boundingBox())!;
  for (const id of ['needle-steer', 'needle-readouts', 'event-log']) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.y + box.height, `${id} bottom`).toBeLessThanOrEqual(panel.y + panel.height + 0.5);
  }
});
