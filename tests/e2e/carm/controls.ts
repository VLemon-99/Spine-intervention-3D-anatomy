// C-arm zone screen-test helpers (not a spec file). Drag a slider handle with
// the mouse (desktop set-up) or with a finger (tablet set-up), and hold
// several fingers at once (pedal + slider).
// Playwright has no touch drag, so the tablet path sends raw touch events
// through a Chrome DevTools Protocol session (Input.dispatchTouchEvent).
// touchStart and touchMove list every finger on the screen; touchEnd lists
// only the finger(s) being lifted.
import { test, type CDPSession, type Locator, type Page } from '@playwright/test';

export interface Point {
  x: number;
  y: number;
}

/** A touch screen with several fingers, each with its own id. */
export interface TouchScreen {
  down(id: number, at: Point): Promise<void>;
  move(id: number, to: Point): Promise<void>;
  up(id: number): Promise<void>;
  /** Lift every finger and close the session. */
  close(): Promise<void>;
}

export async function touchScreen(page: Page): Promise<TouchScreen> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  const fingers = new Map<number, Point>();
  const points = () =>
    [...fingers].map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 1, radiusY: 1, force: 1 }));
  return {
    async down(id, at) {
      fingers.set(id, at);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points() });
    },
    async move(id, to) {
      fingers.set(id, to);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points() });
    },
    async up(id) {
      const lifted = points().filter((p) => p.id === id);
      fingers.delete(id);
      // touchEnd lists the finger(s) being lifted; the others stay down.
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: lifted });
    },
    async close() {
      if (fingers.size > 0) {
        fingers.clear();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      await cdp.detach();
    },
  };
}

/** The centre of an element on screen. */
export async function centreOf(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element is not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
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

const STEPS = 10;

/**
 * Drag the slider's handle to a fraction of its track (0 = min end, 1 = max end).
 * Fractions below 0 or above 1 drag past the end (the value stops at the limit).
 * Mouse on desktop, one finger on the tablet. To drag with a second finger
 * while another one is down (e.g. holding the pedal), pass that touch screen
 * and a finger id.
 */
export async function dragSlider(
  page: Page,
  testId: string,
  toFraction: number,
  finger?: { screen: TouchScreen; id: number },
): Promise<void> {
  const { handle, xAt } = await sliderGeometry(page, testId);
  const target = { x: xAt(toFraction), y: handle.y };
  if (finger || test.info().project.use.hasTouch) {
    const screen = finger?.screen ?? (await touchScreen(page));
    const id = finger?.id ?? 1;
    await screen.down(id, handle);
    for (let i = 1; i <= STEPS; i++) {
      await screen.move(id, { x: handle.x + ((target.x - handle.x) * i) / STEPS, y: handle.y });
    }
    await screen.up(id);
    if (!finger) await screen.close();
  } else {
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: STEPS });
    await page.mouse.up();
  }
}
