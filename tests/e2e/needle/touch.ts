// Touch gestures for the needle zone's screen tests (not a spec file; zone
// helpers are not shared). Playwright has no built-in multi-touch, so these
// send raw touch events through a Chromium DevTools (CDP) session:
// Input.dispatchTouchEvent with one or two touch points.
import type { Page } from '@playwright/test';

export interface Point {
  x: number;
  y: number;
}

const STEPS = 10;

/** One-finger drag from `from` to `to` (page coordinates, CSS px). */
export async function oneFingerDrag(page: Page, from: Point, to: Point): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const at = (t: number): Point => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= STEPS; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...at(i / STEPS), id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/**
 * Two-finger twist around `centre`: the fingers sit `radius` px either side of
 * it (side by side) and turn together by `degrees`. Positive = clockwise as
 * seen on the screen.
 */
export async function twist(page: Page, centre: Point, radius: number, degrees: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const fingers = (deg: number) => {
    const r = (deg * Math.PI) / 180;
    // Screen y grows downward, so a growing angle turns clockwise on screen.
    const dx = Math.cos(r) * radius;
    const dy = Math.sin(r) * radius;
    return [
      { x: centre.x - dx, y: centre.y - dy, id: 1 },
      { x: centre.x + dx, y: centre.y + dy, id: 2 },
    ];
  };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(0) });
  for (let i = 1; i <= STEPS; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers((degrees * i) / STEPS) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
