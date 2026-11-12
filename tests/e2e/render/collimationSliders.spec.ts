// F2.5: the four collimation sliders in the fluoro panel (inside the
// fold-out group opened with the Collimation button).
import { expect, test, type Page } from '@playwright/test';
import { isCollimated } from '../../../src/render/pipeline';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { expectOnScreen, getRenderInfo, press, readWholeCanvas, setRenderSettings } from './renderPage';

const EDGES = ['left', 'right', 'top', 'bottom'] as const;

/** Click (desktop) or tap (tablet) on the slider's track, `fraction` of the way along it. */
async function pressTrack(page: Page, testId: string, fraction: number): Promise<void> {
  const slider = page.getByTestId(testId);
  const box = (await slider.boundingBox())!;
  const position = { x: box.width * fraction, y: box.height / 2 };
  if (test.info().project.use.hasTouch) {
    await slider.tap({ position });
  } else {
    await slider.click({ position });
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await press(page, 'collimation-toggle');
});

test('the Collimation button opens and closes the group of sliders', async ({ page }) => {
  const toggle = page.getByTestId('collimation-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  for (const edge of EDGES) await expect(page.getByTestId(`collimation-${edge}`)).toBeVisible();
  await press(page, 'collimation-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  for (const edge of EDGES) await expect(page.getByTestId(`collimation-${edge}`)).toBeHidden();
  const box = await expectOnScreen(page, toggle);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('each slider is a 0–50 range in steps of 1 and starts at 0%', async ({ page }) => {
  for (const edge of EDGES) {
    const slider = page.getByTestId(`collimation-${edge}`);
    expect(
      await slider.evaluate((e) => {
        const input = e as HTMLInputElement;
        return [input.tagName, input.type, input.min, input.max, input.step, input.value];
      }),
    ).toEqual(['INPUT', 'range', '0', '50', '1', '0']);
    await expect(page.getByTestId(`collimation-${edge}-readout`)).toHaveText('0%');
  }
});

test('pressing on a slider track changes its value, its readout and the setting — for all four', async ({ page }) => {
  const fractions = { left: 0.75, right: 0.3, top: 0.6, bottom: 0.9 };
  const chosen: Record<string, number> = {};
  for (const edge of EDGES) {
    await pressTrack(page, `collimation-${edge}`, fractions[edge]);
    const value = Number(await page.getByTestId(`collimation-${edge}`).inputValue());
    expect(value, `${edge} slider`).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(50);
    expect(Number.isInteger(value)).toBe(true);
    await expect(page.getByTestId(`collimation-${edge}-readout`)).toHaveText(`${value}%`);
    expect((await getRenderInfo(page)).settings.collimation[edge]).toBe(value);
    chosen[edge] = value;
  }
  // The four sliders are independent: each kept its own value.
  expect((await getRenderInfo(page)).settings.collimation).toEqual(chosen);
  // A press further along the track gives a larger value.
  expect(chosen.bottom!).toBeGreaterThan(chosen.right!);
  // Moving a slider never takes an image.
  expect((await getSimState(page)).shotCount).toBe(0);
});

test('the sliders follow the settings when they change elsewhere', async ({ page }) => {
  await setRenderSettings(page, { collimation: { left: 12, right: 34, top: 5, bottom: 50 } });
  const expected = { left: 12, right: 34, top: 5, bottom: 50 };
  for (const edge of EDGES) {
    await expect(page.getByTestId(`collimation-${edge}`)).toHaveValue(String(expected[edge]));
    await expect(page.getByTestId(`collimation-${edge}-readout`)).toHaveText(`${expected[edge]}%`);
  }
});

test('after setting the left slider and taking an image, the covered columns have one single grey value', async ({
  page,
}) => {
  await setRenderSettings(page, { noiseLevel: 0 });
  await takeImage(page);
  const open = await readWholeCanvas(page);

  await pressTrack(page, 'collimation-left', 0.7);
  const left = (await getRenderInfo(page)).settings.collimation.left;
  expect(left).toBeGreaterThan(10);
  await takeImage(page);

  const canvas = await readWholeCanvas(page);
  const shutters = { left, right: 0, top: 0, bottom: 0 };
  let min = 255;
  let max = 0;
  let covered = 0;
  let openChanged = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = x + canvas.width * y;
      if (isCollimated(x, y, shutters)) {
        covered += 1;
        min = Math.min(min, canvas.data[i]!);
        max = Math.max(max, canvas.data[i]!);
      } else if (canvas.data[i] !== open.data[i]) {
        openChanged += 1;
      }
    }
  }
  expect(covered).toBe(Math.ceil((left / 100) * 512) * 512);
  expect(max - min).toBe(0);
  expect(openChanged).toBe(0);
  // The covered columns really changed: they were light (air) before.
  expect(open.data[0]).toBe(255);
  expect(canvas.data[0]).not.toBe(255);
});

test('with the group open, the sliders and the canvas are visible without scrolling; each slider is at least 44×44 px', async ({
  page,
}) => {
  const panel = page.getByTestId('fluoro-panel');
  const canvas = panel.getByTestId('fluoro-canvas');
  const canvasBox = await expectOnScreen(page, canvas);
  expect(canvasBox.width).toBeGreaterThanOrEqual(200);
  expect(canvasBox.height).toBeGreaterThanOrEqual(200);
  const c = (await canvas.boundingBox())!;
  for (const edge of EDGES) {
    const slider = panel.getByTestId(`collimation-${edge}`);
    const box = await expectOnScreen(page, slider);
    expect(box.width, `${edge} slider width`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${edge} slider height`).toBeGreaterThanOrEqual(44);
    await expectOnScreen(page, panel.getByTestId(`collimation-${edge}-readout`));
    const b = (await slider.boundingBox())!;
    const overlap = b.x < c.x + c.width && c.x < b.x + b.width && b.y < c.y + c.height && c.y < b.y + b.height;
    expect(overlap, `${edge} slider lies on the picture`).toBe(false);
  }
  // The sliders do not lie on top of each other.
  const boxes = await Promise.all(EDGES.map(async (e) => (await panel.getByTestId(`collimation-${e}`).boundingBox())!));
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const p = boxes[a]!;
      const q = boxes[b]!;
      const overlap = p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
      expect(overlap, `${EDGES[a]} and ${EDGES[b]} overlap`).toBe(false);
    }
  }
});
