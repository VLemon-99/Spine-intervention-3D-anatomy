// F3-S5: shot count and fluoro time in the C-arm panel, reset on a new case (F3.6, F3.3).
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';

type CarmDebug = { fluoroTimeSeconds: number; fluoroOn: boolean };

const carm = (page: Page): Promise<CarmDebug> =>
  page.evaluate(() => (window as unknown as { __sim: { carm(): CarmDebug } }).__sim.carm());

/** Emit 'caseStart' through the app's own bus, as served by the dev server (same trick as setPose). */
async function emitCaseStart(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const storeModule = '/src/core/store.ts';
    const { bus } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    bus.emit('caseStart');
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test("the counters show '0' and '0.0 s' at the start; after two images the shot count shows '2'", async ({ page }) => {
  await expect(page.getByTestId('shot-count')).toHaveText('0');
  await expect(page.getByTestId('fluoro-time')).toHaveText('0.0 s');
  await takeImage(page);
  await takeImage(page);
  await expect(page.getByTestId('shot-count')).toHaveText('2');
  await expect(page.getByTestId('fluoro-time')).toHaveText('0.0 s');
});

test("after a 'caseStart' event both counters show zero again", async ({ page }) => {
  await takeImage(page);
  await takeImage(page);
  await expect(page.getByTestId('shot-count')).toHaveText('2');
  // Fluoro is not built yet (F3-S7), so put some fluoro time in the store directly.
  await page.evaluate(async () => {
    const storeModule = '/src/core/store.ts';
    const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    store.set({ fluoroTimeSeconds: 2.5 });
  });
  await expect(page.getByTestId('fluoro-time')).toHaveText('2.5 s');
  await emitCaseStart(page);
  await expect(page.getByTestId('shot-count')).toHaveText('0');
  await expect(page.getByTestId('fluoro-time')).toHaveText('0.0 s');
  expect((await getSimState(page)).shotCount).toBe(0);
  expect((await carm(page)).fluoroTimeSeconds).toBe(0);
});

test('window.__sim.carm() returns fluoroTimeSeconds 0 and fluoroOn false', async ({ page }) => {
  expect(await carm(page)).toEqual({ fluoroTimeSeconds: 0, fluoroOn: false });
});

test('both counters are visible without scrolling the page', async ({ page }) => {
  const viewport = page.viewportSize();
  const panel = await page.getByTestId('carm-panel').boundingBox();
  if (!viewport || !panel) throw new Error('no viewport or panel');
  for (const id of ['shot-count', 'fluoro-time']) {
    await expect(page.getByTestId(id)).toBeVisible();
    const box = await page.getByTestId(id).boundingBox();
    if (!box) throw new Error(`no box for ${id}`);
    expect(box.x, id).toBeGreaterThanOrEqual(panel.x);
    expect(box.y, id).toBeGreaterThanOrEqual(panel.y);
    expect(box.x + box.width, id).toBeLessThanOrEqual(Math.min(viewport.width, panel.x + panel.width));
    expect(box.y + box.height, id).toBeLessThanOrEqual(Math.min(viewport.height, panel.y + panel.height));
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
