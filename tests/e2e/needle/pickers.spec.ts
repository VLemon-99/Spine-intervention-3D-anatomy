// F5-S3: needle and pre-bend pickers (F5.1) and the 'needle' debug getter.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';

type NeedleDebug = { needleId: string; preBend: number; locked: boolean } | null;

const readNeedle = (page: Page): Promise<NeedleDebug> =>
  page.evaluate(() => (window as unknown as { __sim: { needle(): NeedleDebug } }).__sim.needle());

/**
 * Places an uninserted needle at the back skin under the image centre at pose
 * 0°/0°, through the app's own modules as served by the dev server (the
 * setPose trick), so the needle getter has a needle to report.
 */
async function placeNeedle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const mods = ['/src/core/store.ts', '/src/core/geometry.ts', '/src/needle/entry.ts', '/src/needle/session.ts'];
    const [{ store }, { createProjection }, { skinEntry }, { needleSession }] = (await Promise.all(
      mods.map((m) => import(/* @vite-ignore */ m)),
    )) as [
      typeof import('../../../src/core/store'),
      typeof import('../../../src/core/geometry'),
      typeof import('../../../src/needle/entry'),
      typeof import('../../../src/needle/session'),
    ];
    const volume = store.get().volume;
    if (!volume) throw new Error('no volume loaded');
    const ray = createProjection({ oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 }).unproject({
      x: 256,
      y: 256,
    });
    const entry = skinEntry(volume, ray);
    if (!entry) throw new Error('no skin entry');
    needleSession.markEntry(entry, ray.direction);
  });
}

async function pick(select: Locator, value: string): Promise<void> {
  if (test.info().project.use.hasTouch) await select.tap();
  await select.selectOption(value);
}

const CATALOGUE_IDS = [
  'quincke-22g-89',
  'quincke-22g-127',
  'quincke-25g-89',
  'quincke-25g-127',
  'tuohy-20g-89',
  'rf-curved-20g-100',
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await page.waitForFunction(() => (window as unknown as { __sim: { getState(): { volume: unknown } } }).__sim.getState().volume !== null);
});

test('the needle getter is null before any needle is placed', async ({ page }) => {
  expect(await readNeedle(page)).toBeNull();
});

test('the needle picker lists all six catalogue needles and picking one changes needleId', async ({ page }) => {
  const select = page.getByTestId('needle-panel').getByTestId('needle-select');
  await expect(select).toBeVisible();
  const values = await select.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(values).toEqual(CATALOGUE_IDS);
  await placeNeedle(page);
  await pick(select, 'tuohy-20g-89');
  expect((await readNeedle(page))?.needleId).toBe('tuohy-20g-89');
  await pick(select, 'quincke-25g-127');
  expect((await readNeedle(page))?.needleId).toBe('quincke-25g-127');
});

test('the pre-bend picker offers 0–30° in 5° steps and is disabled for the curved-tip cannula', async ({ page }) => {
  const preBend = page.getByTestId('needle-panel').getByTestId('prebend-select');
  const values = await preBend.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(values).toEqual(['0', '5', '10', '15', '20', '25', '30']);
  await placeNeedle(page);
  await pick(preBend, '15');
  expect((await readNeedle(page))?.preBend).toBe(15);

  await pick(page.getByTestId('needle-select'), 'rf-curved-20g-100');
  await expect(preBend).toBeDisabled();
  await pick(page.getByTestId('needle-select'), 'quincke-22g-89');
  await expect(preBend).toBeEnabled();
});

test.describe('tablet sizes', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'tablet set-up only');
  test('both pickers are at least 44×44 px', async ({ page }) => {
    for (const id of ['needle-select', 'prebend-select']) {
      const box = await page.getByTestId(id).boundingBox();
      if (!box) throw new Error(`no box for ${id}`);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
