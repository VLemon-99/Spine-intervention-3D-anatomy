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
