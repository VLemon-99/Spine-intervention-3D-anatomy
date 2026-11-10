// Screen-test helpers of the render zone (not a spec file).
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { CArmPose } from '../../../src/core/types';
import type { RenderSettings, RenderSettingsPatch } from '../../../src/render/settings';

/** What window.__sim.render() returns. */
export interface RenderInfo {
  settings: RenderSettings;
  /** The image on screen: how it was taken. null before the first image. */
  lastImage: { pose: CArmPose; settings: RenderSettings; noiseSeed: number } | null;
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
