// Shared screen-test helpers for the test hook and the C-arm pose.
import { test, type Page } from '@playwright/test';
import type { CArmPose } from '../../src/core/types';

type HookState = { shotCount: number; pose: CArmPose; lastImagePose: CArmPose | null };

/** Wait until window.__sim is installed, then return getState(). */
export async function getSimState(page: Page): Promise<HookState> {
  await page.waitForFunction(() => 'getState' in ((window as { __sim?: object }).__sim ?? {}));
  return page.evaluate(() => (window as unknown as { __sim: { getState(): HookState } }).__sim.getState());
}

/**
 * Set the C-arm pose before the C-arm controls exist (F3), through the app's
 * own store module as served by the dev server (the same module instance the
 * app uses). Test-only; changes go through the store's own set().
 */
export async function setPose(page: Page, pose: Partial<CArmPose>): Promise<void> {
  await page.evaluate(async (patch) => {
    const storeModule = '/src/core/store.ts';
    const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../src/core/store');
    store.set({ pose: { ...store.get().pose, ...patch } });
  }, pose);
}

/** Take one image: spacebar on desktop, tap on Shot on the tablet. Waits until the shot is counted. */
export async function takeImage(page: Page): Promise<void> {
  const before = (await getSimState(page)).shotCount;
  if (test.info().project.use.hasTouch) {
    await page.getByTestId('shot-button').tap();
  } else {
    await page.keyboard.press('Space');
  }
  await page.waitForFunction(
    (n) => (window as unknown as { __sim: { getState(): HookState } }).__sim.getState().shotCount > n,
    before,
  );
}
