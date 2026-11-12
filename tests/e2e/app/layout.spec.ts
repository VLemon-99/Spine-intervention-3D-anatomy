import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';

// F12.3: landscape keeps all four panels (and the top bar) on screen without
// scrolling; portrait stacks them in one column, fluoro panel first.
const PANELS = ['fluoro-panel', 'carm-panel', 'needle-panel', 'view3d-panel'];

type Box = { x: number; y: number; width: number; height: number };

async function boxes(page: Page): Promise<Box[]> {
  const result: Box[] = [];
  for (const panel of PANELS) {
    const box = await page.getByTestId(panel).boundingBox();
    expect(box, `${panel} has no box`).not.toBeNull();
    if (box) result.push(box);
  }
  return result;
}

test("at the set-up's own landscape size, the four panels are inside the viewport and the page cannot scroll", async ({
  page,
}) => {
  await page.goto('/');
  await acceptDisclaimer(page);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;
  for (const [i, box] of (await boxes(page)).entries()) {
    expect(box.x, `${PANELS[i]} left`).toBeGreaterThanOrEqual(0);
    expect(box.y, `${PANELS[i]} top`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${PANELS[i]} right`).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, `${PANELS[i]} bottom`).toBeLessThanOrEqual(viewport.height);
  }
  await expect(page.getByTestId('home-button')).toBeInViewport();
  const scroll = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  expect(scroll).toEqual({ width: viewport.width, height: viewport.height });
});

test.describe('portrait 768×1024', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await acceptDisclaimer(page);
  });

  test('the panels share a left edge, do not overlap, and are in the order fluoro, C-arm, needle, 3D view', async ({
    page,
  }) => {
    const list = await boxes(page);
    for (const box of list) expect(Math.abs(box.x - list[0].x)).toBeLessThanOrEqual(1);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].y, `${PANELS[i]} below ${PANELS[i - 1]}`).toBeGreaterThanOrEqual(
        list[i - 1].y + list[i - 1].height - 0.5,
      );
    }
  });

  test('the fluoro panel is the first panel, starts in the top quarter, and is about as tall as it is wide', async ({
    page,
  }) => {
    const [fluoro, ...rest] = await boxes(page);
    for (const box of rest) expect(fluoro.y).toBeLessThan(box.y);
    expect(fluoro.y).toBeLessThan(1024 / 4);
    expect(fluoro.height / fluoro.width).toBeGreaterThan(0.8);
    expect(fluoro.height / fluoro.width).toBeLessThan(1.25);
    // The page is allowed to scroll in portrait, but never sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(768);
  });
});
