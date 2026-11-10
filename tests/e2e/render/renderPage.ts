// Screen-test helpers of the render zone (not a spec file).
import type { Page } from '@playwright/test';
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
