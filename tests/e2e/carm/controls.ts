// C-arm zone screen-test helpers (not a spec file). Drag a slider handle with
// the mouse (desktop set-up) or with one finger (tablet set-up).
// Playwright has no touch drag, so the tablet path sends raw touch events
// through a Chrome DevTools Protocol session (Input.dispatchTouchEvent).
import { test, type Page } from '@playwright/test';

interface Point {
  x: number;
  y: number;
}

/** Where the handle of a range input sits now, and the x of a value fraction (0 = min end, 1 = max end). */
async function sliderGeometry(page: Page, testId: string): Promise<{ handle: Point; xAt: (f: number) => number }> {
  const slider = page.getByTestId(testId);
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  if (!box) throw new Error(`slider ${testId} is not visible`);
  const { value, min, max } = await slider.evaluate((el: HTMLInputElement) => ({
    value: Number(el.value),
    min: Number(el.min),
    max: Number(el.max),
  }));
  // Chromium's default handle is about 16 px wide; the track runs between its
  // centres at the two ends. Small errors do not matter: pressing on the track
  // next to the handle moves the handle there and the drag carries on.
  const thumb = 16;
  const xAt = (f: number): number => box.x + thumb / 2 + f * (box.width - thumb);
  const y = box.y + box.height / 2;
  return { handle: { x: xAt((value - min) / (max - min)), y }, xAt };
}

/**
 * Drag the slider's handle to a fraction of its track (0 = min end, 1 = max end).
 * Fractions below 0 or above 1 drag past the end (the value stops at the limit).
 */
export async function dragSlider(page: Page, testId: string, toFraction: number): Promise<void> {
  const { handle, xAt } = await sliderGeometry(page, testId);
  const target = { x: xAt(toFraction), y: handle.y };
  const steps = 10;
  if (test.info().project.use.hasTouch) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (p: Point) => [{ x: p.x, y: p.y, id: 1, radiusX: 1, radiusY: 1, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(handle) });
    for (let i = 1; i <= steps; i++) {
      const p = { x: handle.x + ((target.x - handle.x) * i) / steps, y: handle.y };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(p) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps });
    await page.mouse.up();
  }
}
