// Touch gestures for the view3d zone's screen tests (not a spec file).
// Playwright has no built-in multi-touch, so these send raw touch events
// through a Chromium DevTools (CDP) session: Input.dispatchTouchEvent with
// touchStart / touchMove / touchEnd and one or two touch points.
import type { Page } from '@playwright/test';

interface Point {
  x: number;
  y: number;
}

const STEPS = 8;

async function touchSession(page: Page) {
  return page.context().newCDPSession(page);
}

/** One-finger drag from `from` to `to` (page coordinates, CSS px). */
export async function oneFingerDrag(page: Page, from: Point, to: Point): Promise<void> {
  const cdp = await touchSession(page);
  const at = (t: number): Point => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= STEPS; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...at(i / STEPS), id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/**
 * Two-finger pinch around `centre`: the fingers start `fromGap` px apart
 * (side by side) and end `toGap` px apart. toGap > fromGap spreads them.
 */
export async function pinch(page: Page, centre: Point, fromGap: number, toGap: number): Promise<void> {
  const cdp = await touchSession(page);
  const fingers = (gap: number) => [
    { x: centre.x - gap / 2, y: centre.y, id: 1 },
    { x: centre.x + gap / 2, y: centre.y, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(fromGap) });
  for (let i = 1; i <= STEPS; i++) {
    const gap = fromGap + ((toGap - fromGap) * i) / STEPS;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(gap) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
