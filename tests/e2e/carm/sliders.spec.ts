// F3-S2: a slider with a number readout for each of the five pose values (F3.2).
// Runs in both set-ups: mouse drag on desktop, touch drag on the tablet.
import { expect, test, type Page } from '@playwright/test';
import { POSE_LIMITS } from '../../../src/carm/limits';
import type { CArmPose } from '../../../src/core/types';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose } from '../../fixtures/simPage';
import { dragSlider } from './controls';

const SLIDERS: { key: keyof CArmPose; id: string; unit: string; ends: [string, string] | null }[] = [
  { key: 'oblique', id: 'oblique', unit: '°', ends: ['L', 'R'] },
  { key: 'tilt', id: 'tilt', unit: '°', ends: ['CAUD', 'CRAN'] },
  { key: 'tableLeftRight', id: 'table-left-right', unit: ' mm', ends: null },
  { key: 'tableHeadFoot', id: 'table-head-foot', unit: ' mm', ends: null },
  { key: 'tableHeight', id: 'table-height', unit: ' mm', ends: null },
];

const pose = async (page: Page): Promise<CArmPose> => (await getSimState(page)).pose;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
});

for (const s of SLIDERS) {
  test(`dragging the ${s.id} slider changes the pose, and the readout shows the same number`, async ({ page }) => {
    await dragSlider(page, `slider-${s.id}`, 0.8);
    await expect.poll(async () => (await pose(page))[s.key]).toBeGreaterThan(0);
    const value = (await pose(page))[s.key];
    await expect(page.getByTestId(`readout-${s.id}`)).toHaveText(`${value}${s.unit}`);
    // The other four values are untouched.
    for (const other of SLIDERS) if (other !== s) expect((await pose(page))[other.key]).toBe(0);
  });

  test(`dragging the ${s.id} slider to each end gives exactly the limit`, async ({ page }) => {
    const { min, max } = POSE_LIMITS[s.key];
    await dragSlider(page, `slider-${s.id}`, 1.3);
    await expect.poll(async () => (await pose(page))[s.key]).toBe(max);
    await expect(page.getByTestId(`readout-${s.id}`)).toHaveText(`${max}${s.unit}`);
    await dragSlider(page, `slider-${s.id}`, -0.3);
    await expect.poll(async () => (await pose(page))[s.key]).toBe(min);
    await expect(page.getByTestId(`readout-${s.id}`)).toHaveText(`${min}${s.unit}`);
  });
}

test('changing the pose in the store moves the sliders and readouts', async ({ page }) => {
  await setPose(page, { oblique: 25, tilt: -10, tableLeftRight: 15, tableHeadFoot: -120, tableHeight: 40 });
  const expected: Record<string, number> = {
    oblique: 25,
    tilt: -10,
    'table-left-right': 15,
    'table-head-foot': -120,
    'table-height': 40,
  };
  for (const s of SLIDERS) {
    await expect(page.getByTestId(`slider-${s.id}`)).toHaveValue(String(expected[s.id]));
    await expect(page.getByTestId(`readout-${s.id}`)).toHaveText(`${expected[s.id]}${s.unit}`);
  }
  await expect(page.getByTestId('readout-oblique')).toHaveText('25°');
  await expect(page.getByTestId('readout-tilt')).toHaveText('-10°');
  await expect(page.getByTestId('readout-table-left-right')).toHaveText('15 mm');
});

test('dragging a slider does not take an image', async ({ page }) => {
  for (const s of SLIDERS) await dragSlider(page, `slider-${s.id}`, 0.3);
  await expect.poll(async () => (await pose(page)).tableHeight).not.toBe(0);
  await page.waitForTimeout(200);
  const state = await getSimState(page);
  expect(state.shotCount).toBe(0);
  expect(state.lastImagePose).toBeNull();
});

test('all five sliders and the Shot button are visible without scrolling the page', async ({ page }) => {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('no viewport');
  const ids = [...SLIDERS.map((s) => `slider-${s.id}`), 'shot-button'];
  for (const id of ids) {
    await expect(page.getByTestId(id)).toBeVisible();
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    if (!box) continue;
    expect(box.x, id).toBeGreaterThanOrEqual(0);
    expect(box.y, id).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, id).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, id).toBeLessThanOrEqual(viewport.height);
    // Not cut off by the panel either (the panel hides overflow).
    const panel = await page.getByTestId('carm-panel').boundingBox();
    if (!panel) throw new Error('no panel');
    expect(box.y + box.height, id).toBeLessThanOrEqual(panel.y + panel.height);
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('the slider ends are labelled with their meaning', async ({ page }) => {
  for (const s of SLIDERS) {
    const minLabel = page.getByTestId(`slider-${s.id}-min-label`);
    const maxLabel = page.getByTestId(`slider-${s.id}-max-label`);
    await expect(minLabel).toBeVisible();
    await expect(maxLabel).toBeVisible();
    await expect(minLabel).not.toHaveText('');
    await expect(maxLabel).not.toHaveText('');
    if (s.ends) {
      await expect(minLabel).toHaveText(s.ends[0]);
      await expect(maxLabel).toHaveText(s.ends[1]);
    }
    // The labels sit on either side of the slider.
    const slider = await page.getByTestId(`slider-${s.id}`).boundingBox();
    const minBox = await minLabel.boundingBox();
    const maxBox = await maxLabel.boundingBox();
    if (!slider || !minBox || !maxBox) throw new Error('missing box');
    expect(minBox.x + minBox.width).toBeLessThanOrEqual(slider.x + 1);
    expect(maxBox.x).toBeGreaterThanOrEqual(slider.x + slider.width - 1);
  }
});

test("each slider's touch area is at least 44 px wide and 44 px tall", async ({ page }) => {
  for (const s of SLIDERS) {
    const box = await page.getByTestId(`slider-${s.id}`).boundingBox();
    expect(box, s.id).not.toBeNull();
    if (!box) continue;
    expect(box.width, s.id).toBeGreaterThanOrEqual(44);
    expect(box.height, s.id).toBeGreaterThanOrEqual(44);
  }
});
