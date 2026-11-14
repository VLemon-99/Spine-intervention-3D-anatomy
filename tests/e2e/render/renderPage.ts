// Screen-test helpers of the render zone (not a spec file).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createRandom } from '../../../src/core/random';
import type { CArmPose, ImageKind, NeedleState, Vec3 } from '../../../src/core/types';
import type { RenderSettings, RenderSettingsPatch } from '../../../src/render/settings';

/** What window.__sim.render() returns. */
export interface RenderInfo {
  settings: RenderSettings;
  /** The image on screen: how it was taken. null before the first image. */
  lastImage: {
    pose: CArmPose;
    settings: RenderSettings;
    noiseSeed: number;
    /** 'shot', 'fluoro', or null if the store did not say. */
    kind: ImageKind | null;
    /** The noise level the image was actually taken with. */
    noiseLevel: number;
    /** The needle tip copied at the exposure, or null if there was no needle. */
    needleTip: Vec3 | null;
  } | null;
}

type RenderHook = { __sim: { render(): RenderInfo } };

/**
 * Change the render settings through the app's own settings module as served
 * by the dev server (the same module instance the app uses; the same trick as
 * setPose in tests/fixtures/simPage.ts). Test-only; the change goes through
 * the settings store's own set(), so it is validated like any other change.
 */
export async function setRenderSettings(page: Page, patch: RenderSettingsPatch): Promise<void> {
  await page.evaluate(async (p) => {
    const settingsModule = '/src/render/settings.ts';
    const { renderSettings } = (await import(
      /* @vite-ignore */ settingsModule
    )) as typeof import('../../../src/render/settings');
    renderSettings.set(p);
  }, patch);
}

/** Wait until window.__sim.render exists, then return what it reports. */
export async function getRenderInfo(page: Page): Promise<RenderInfo> {
  await page.waitForFunction(
    () => typeof (window as { __sim?: { render?: unknown } }).__sim?.render === 'function',
  );
  return page.evaluate(() => (window as unknown as RenderHook).__sim.render());
}

/**
 * Grey values (0–255) of ALL pixels of the fluoro canvas: pixel (x, y) is at
 * index x + width × y, y counted from the top (as in renderDrrCpu). The grey
 * value is the mean of the red, green and blue channels.
 */
export async function readWholeCanvas(page: Page): Promise<{ width: number; height: number; data: Uint8Array }> {
  const result = await page.getByTestId('fluoro-canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext('2d');
    if (!context) throw new Error('no 2D context for reading pixels');
    context.drawImage(canvas, 0, 0);
    const { data } = context.getImageData(0, 0, copy.width, copy.height);
    // One character per pixel keeps the hand-over to the test process small.
    let grey = '';
    for (let i = 0; i < data.length; i += 4) {
      grey += String.fromCharCode(Math.round(((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 3));
    }
    return { width: copy.width, height: copy.height, grey };
  });
  const data = Uint8Array.from(result.grey, (character) => character.charCodeAt(0));
  return { width: result.width, height: result.height, data };
}

/** Press a control the way the set-up's user would: a click on desktop, a tap on the tablet. */
export async function press(page: Page, testId: string): Promise<void> {
  const control = page.getByTestId(testId);
  if (test.info().project.use.hasTouch) {
    await control.tap();
  } else {
    await control.click();
  }
}

/**
 * Check that a control is fully inside the window without scrolling the page
 * (the page itself is not scrolled), and return its on-screen box.
 */
export async function expectOnScreen(page: Page, locator: Locator): Promise<{ width: number; height: number }> {
  await expect(locator).toBeVisible();
  expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error('no box or viewport');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  return { width: box.width, height: box.height };
}

/** 3% of the grey range (0–255): the most the canvas may differ from the CPU reference on average (F2.2). */
export const MAX_MEAN_DIFFERENCE = 0.03 * 255;

/**
 * Mean absolute difference, in grey levels, between the canvas and a CPU
 * reference image (values 0…1 are compared as value × 255).
 */
export function meanDifference(canvas: { data: Uint8Array }, reference: { data: Float32Array }): number {
  expect(canvas.data.length).toBe(reference.data.length);
  let sum = 0;
  for (let i = 0; i < canvas.data.length; i++) sum += Math.abs(canvas.data[i]! - reference.data[i]! * 255);
  return sum / canvas.data.length;
}

/** True if two canvas readings are identical pixel for pixel. */
export function samePixels(a: { data: Uint8Array }, b: { data: Uint8Array }): boolean {
  return Buffer.from(a.data).equals(Buffer.from(b.data));
}

/**
 * Put a contrast (extra absorption) array in the store — or null for none —
 * through the app's own store module as served by the dev server (as setPose
 * does). Test-only; it does not take an image.
 */
export async function setContrast(page: Page, contrast: Uint8Array | null): Promise<void> {
  // One character per voxel keeps the hand-over to the page small.
  const packed = contrast ? Buffer.from(contrast).toString('latin1') : null;
  await page.evaluate(async (text) => {
    const storeModule = '/src/core/store.ts';
    const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    store.set({ contrast: text === null ? null : Uint8Array.from(text, (character) => character.charCodeAt(0)) });
  }, packed);
}

/**
 * Make one continuous-fluoro frame of the current pose, the way the C-arm
 * zone does it (F3): set lastImagePose and lastImageKind 'fluoro' in the
 * store, then emit 'exposure' — through the app's own store module as served
 * by the dev server. Test-only; it does not count as a shot.
 */
export async function takeFluoroFrame(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const storeModule = '/src/core/store.ts';
    const { store, bus } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    store.set({ lastImagePose: { ...store.get().pose }, lastImageKind: 'fluoro' });
    bus.emit('exposure');
  });
}

/** A hand-made straight needle for tests, hub at `hub` and tip at `tip`, as a shaft of `count` points. */
export function straightTestNeedle(hub: Vec3, tip: Vec3, count = 11): NeedleState {
  const shaft = Array.from({ length: count }, (_, i) => {
    const f = i / (count - 1);
    return { x: hub.x + (tip.x - hub.x) * f, y: hub.y + (tip.y - hub.y) * f, z: hub.z + (tip.z - hub.z) * f };
  });
  return {
    needleId: 'test-needle',
    preBend: 0,
    entryPoint: { ...hub },
    hubAngles: { pitch: 0, yaw: 0 },
    bevelAngle: 0,
    insertedDepth: 0,
    shaft,
    tip: { ...tip },
  };
}

/**
 * Put a needle (or null for none) in the store through the app's own store
 * module as served by the dev server (the same trick as setPose). Test-only;
 * it does not take an image.
 */
export async function putNeedle(page: Page, needle: NeedleState | null): Promise<void> {
  await page.evaluate(async (n) => {
    const storeModule = '/src/core/store.ts';
    const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    store.set({ needle: n });
  }, needle);
}

/**
 * Five poses drawn with createRandom(seed): oblique −40…40°, tilt −20…20°,
 * table not moved. The same seed always gives the same poses.
 */
export function seededPoses(seed: number, count = 5): CArmPose[] {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => {
    const oblique = -40 + 80 * random();
    const tilt = -20 + 40 * random();
    return { oblique, tilt, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
  });
}

/** How much darker (grey levels) than the image with no needle a pixel must be to count as a needle pixel. */
export const NEEDLE_PIXEL_MARGIN = 30;

/** The pixels (x, y) at least NEEDLE_PIXEL_MARGIN darker in `withNeedle` than in `without` (two canvas readings). */
export function needlePixels(
  withNeedle: { width: number; data: Uint8Array },
  without: { width: number; data: Uint8Array },
): { x: number; y: number }[] {
  expect(withNeedle.data.length).toBe(without.data.length);
  const pixels: { x: number; y: number }[] = [];
  for (let i = 0; i < withNeedle.data.length; i++) {
    if (without.data[i]! - withNeedle.data[i]! >= NEEDLE_PIXEL_MARGIN) {
      pixels.push({ x: i % withNeedle.width, y: Math.floor(i / withNeedle.width) });
    }
  }
  return pixels;
}

/**
 * The tip pixel found in the image: of the needle pixels, the one whose
 * centre is farthest from the hub's projection `hubPixel`. Its centre
 * (x + 0.5, y + 0.5) is returned, or null if there are no needle pixels.
 */
export function findTipPixel(
  pixels: readonly { x: number; y: number }[],
  hubPixel: { x: number; y: number },
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDistance = -1;
  for (const p of pixels) {
    const distance = Math.hypot(p.x + 0.5 - hubPixel.x, p.y + 0.5 - hubPixel.y);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = { x: p.x + 0.5, y: p.y + 0.5 };
    }
  }
  return best;
}

/**
 * Longest extent (px) of a set of needle pixels: the largest distance between
 * two pixel centres, plus 1 for the pixels' own size (one pixel → 1). 0 for none.
 */
export function longestExtent(pixels: readonly { x: number; y: number }[]): number {
  if (pixels.length === 0) return 0;
  let longest = 0;
  for (let a = 0; a < pixels.length; a++) {
    for (let b = a + 1; b < pixels.length; b++) {
      longest = Math.max(longest, Math.hypot(pixels[a]!.x - pixels[b]!.x, pixels[a]!.y - pixels[b]!.y));
    }
  }
  return longest + 1;
}
