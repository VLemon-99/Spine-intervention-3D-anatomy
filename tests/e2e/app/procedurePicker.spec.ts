import { expect, test, type Page } from '@playwright/test';
import type { Mode, ProcedureEntry } from '../../../src/core/types';

// F12.2 / F10.2: the picker lists store.procedures; picking one emits exactly
// one 'procedureRequest' with its id and opens the simulator screen, keeping
// the mode chosen on the home screen. Made-up procedures only.
const PROCEDURES: ProcedureEntry[] = [
  { id: 'test-procedure-one', title: 'Test procedure one' },
  { id: 'test-procedure-two', title: 'Test procedure two' },
];

/** Click on desktop, tap on the tablet. */
async function press(page: Page, testid: string, nth = 0): Promise<void> {
  const button = page.getByTestId(testid).nth(nth);
  if (test.info().project.use.hasTouch) {
    await button.tap();
  } else {
    await button.click();
  }
}

/** Fill store.procedures and record every 'procedureRequest' on window.__requests. */
async function setUp(page: Page): Promise<void> {
  await page.evaluate(async (procedures) => {
    const storeModule = '/src/core/store.ts';
    const { store, bus } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    const w = window as unknown as { __requests: string[] };
    w.__requests = [];
    bus.on('procedureRequest', (id) => w.__requests.push(id));
    store.set({ procedures });
  }, PROCEDURES);
}

const requests = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __requests: string[] }).__requests);

async function getMode(page: Page): Promise<Mode> {
  return page.evaluate(async () => {
    const storeModule = '/src/core/store.ts';
    const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    return store.get().mode;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await press(page, 'disclaimer-accept');
  await expect(page.getByTestId('home-screen')).toBeVisible();
});

test('after two procedures are put in store.procedures, the Practice picker lists both and no empty-list text', async ({
  page,
}) => {
  await setUp(page);
  await press(page, 'home-practice');
  const entries = page.getByTestId('procedure-entry');
  await expect(entries).toHaveText(PROCEDURES.map((p) => p.title));
  await expect(page.getByTestId('procedure-picker-empty')).toBeHidden();
});

test('the picker follows changes to store.procedures while it is open', async ({ page }) => {
  await press(page, 'home-practice');
  await expect(page.getByTestId('procedure-picker-empty')).toBeVisible();
  await setUp(page);
  await expect(page.getByTestId('procedure-entry')).toHaveCount(2);
  await expect(page.getByTestId('procedure-picker-empty')).toBeHidden();
});

for (const [choice, mode] of [
  ['home-practice', 'practice'],
  ['home-exam', 'exam'],
] as const) {
  test(`picking one (from ${mode}) emits exactly one procedureRequest with its id, shows the simulator, mode stays '${mode}'`, async ({
    page,
  }) => {
    await setUp(page);
    await press(page, choice);
    await press(page, 'procedure-entry', 1);
    await expect(page.getByTestId('fluoro-panel')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-screen', 'sim');
    expect(await requests(page)).toEqual(['test-procedure-two']);
    expect(await getMode(page)).toBe(mode);
  });
}

test('each entry is at least 44 px tall', async ({ page }) => {
  await setUp(page);
  await press(page, 'home-practice');
  const entries = await page.getByTestId('procedure-entry').all();
  expect(entries).toHaveLength(2);
  for (const entry of entries) {
    const box = await entry.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});
