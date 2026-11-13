// Needle-zone screen-test helpers (zone helpers are not shared). They reach the
// app's own needle session through the dev server's module, the same trick as
// setPose in tests/fixtures/simPage.ts.
import type { Page } from '@playwright/test';
import type { Vec3 } from '../../../src/core/types';

export interface NeedleDebug {
  needleId: string;
  preBend: number;
  locked: boolean;
  entryPoint: Vec3;
  hubAngles: { pitch: number; yaw: number };
  bevelAngle: number;
  insertedDepth: number;
  tip: Vec3;
}

const SESSION_MODULE = '/src/needle/session.ts';

/** window.__sim.needle(): the needle, or null when there is none. */
export function readNeedle(page: Page): Promise<NeedleDebug | null> {
  return page.evaluate(() => (window as unknown as { __sim: { needle(): NeedleDebug | null } }).__sim.needle());
}

/** Wait until the app has a volume loaded (the phantom in tests). */
export async function waitForVolume(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __sim?: { getState(): { volume: unknown } } }).__sim?.getState().volume != null,
  );
}

/** Calls needleSession.markEntryAtPixel(pixel) in the app. Returns the session's result. */
export function markEntryAtPixel(page: Page, pixel: { x: number; y: number }): Promise<string> {
  return page.evaluate(
    async ({ mod, pixel }) => {
      const { needleSession } = (await import(/* @vite-ignore */ mod)) as typeof import('../../../src/needle/session');
      return needleSession.markEntryAtPixel(pixel);
    },
    { mod: SESSION_MODULE, pixel },
  );
}

/** Calls needleSession.advance(mm) in the app (for tests that are not about the advance controls). */
export function advanceNeedle(page: Page, mm: number): Promise<string> {
  return page.evaluate(
    async ({ mod, mm }) => {
      const { needleSession } = (await import(/* @vite-ignore */ mod)) as typeof import('../../../src/needle/session');
      return needleSession.advance(mm);
    },
    { mod: SESSION_MODULE, mm },
  );
}

/** Calls needleSession.rotateBevel(deg) in the app (for tests that are not about the bevel controls). */
export function rotateBevel(page: Page, deg: number): Promise<string> {
  return page.evaluate(
    async ({ mod, deg }) => {
      const { needleSession } = (await import(/* @vite-ignore */ mod)) as typeof import('../../../src/needle/session');
      return needleSession.rotateBevel(deg);
    },
    { mod: SESSION_MODULE, deg },
  );
}

/** Calls needleSession.setHubAngles(pitch, yaw) in the app (for tests that are not about the steering controls). */
export function setHubAngles(page: Page, pitch: number, yaw: number): Promise<string> {
  return page.evaluate(
    async ({ mod, pitch, yaw }) => {
      const { needleSession } = (await import(/* @vite-ignore */ mod)) as typeof import('../../../src/needle/session');
      return needleSession.setHubAngles(pitch, yaw);
    },
    { mod: SESSION_MODULE, pitch, yaw },
  );
}
