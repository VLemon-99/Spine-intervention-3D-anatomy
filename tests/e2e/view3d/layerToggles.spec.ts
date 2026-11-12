// F8.4: the on-screen toggles that show or hide each layer.
import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState } from '../../fixtures/simPage';
import { expectOnScreen, getView3d, press, sceneObject } from './view3dPage';

const LAYERS = ['nerves', 'vessels', 'thecal', 'soft'] as const;
const START: Record<(typeof LAYERS)[number], boolean> = { nerves: true, vessels: true, thecal: true, soft: false };

async function layerVisibility(page: import('@playwright/test').Page): Promise<Record<string, boolean>> {
  const info = await getView3d(page);
  return Object.fromEntries(LAYERS.map((id) => [id, sceneObject(info, `layer-${id}`)!.visible]));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

test('the layer toggles are hidden while the 3D view is off', async ({ page }) => {
  for (const id of LAYERS) await expect(page.getByTestId(`layer-toggle-${id}`)).toBeHidden();
  await press(page, 'view3d-toggle');
  for (const id of LAYERS) await expect(page.getByTestId(`layer-toggle-${id}`)).toBeVisible();
});

test('each toggle flips only its own layer and its own aria-pressed; twice returns to the start', async ({ page }) => {
  await press(page, 'view3d-toggle');
  for (const id of LAYERS) {
    await expect(page.getByTestId(`layer-toggle-${id}`)).toHaveAttribute('aria-pressed', String(START[id]));
  }
  expect(await layerVisibility(page)).toEqual(START);

  for (const id of LAYERS) {
    await press(page, `layer-toggle-${id}`);
    const flipped = { ...START, [id]: !START[id] };
    expect(await layerVisibility(page), `after pressing ${id}`).toEqual(flipped);
    for (const other of LAYERS) {
      await expect(page.getByTestId(`layer-toggle-${other}`)).toHaveAttribute('aria-pressed', String(flipped[other]));
    }

    await press(page, `layer-toggle-${id}`);
    expect(await layerVisibility(page), `after pressing ${id} twice`).toEqual(START);
    await expect(page.getByTestId(`layer-toggle-${id}`)).toHaveAttribute('aria-pressed', String(START[id]));
  }
});

test('the four layer toggles and the 3D view toggle are at least 44×44 px and visible without scrolling', async ({
  page,
}) => {
  await press(page, 'view3d-toggle');
  const panel = page.getByTestId('view3d-panel');
  for (const testId of ['view3d-toggle', ...LAYERS.map((id) => `layer-toggle-${id}`)]) {
    const box = await expectOnScreen(page, panel.getByTestId(testId));
    expect(box.width, testId).toBeGreaterThanOrEqual(44);
    expect(box.height, testId).toBeGreaterThanOrEqual(44);
  }
  // The canvas keeps a usable size below the buttons.
  const canvas = await expectOnScreen(page, panel.getByTestId('view3d-canvas'));
  expect(canvas.height).toBeGreaterThanOrEqual(150);
});
