// Screen-test helpers of the sim zone (not a spec file).
import type { Page } from '@playwright/test';
import type { Mode, NeedleState, TissueEvent, Vec3 } from '../../../src/core/types';

/** What window.__sim.sim() returns. */
export interface SimInfo {
  tipTissue: string | null;
  resistance: number | null;
  events: TissueEvent[];
}

type SimHook = { __sim: { sim(): SimInfo } };

/** Wait until window.__sim.sim exists, then return what it reports. */
export async function getSim(page: Page): Promise<SimInfo> {
  await page.waitForFunction(() => typeof (window as { __sim?: { sim?: unknown } }).__sim?.sim === 'function');
  return page.evaluate(() => (window as unknown as SimHook).__sim.sim());
}

/** A straight hand-made needle state with its tip at `tip`, entering from 40 mm behind it (+y). */
export function needleWithTip(tip: Vec3, extra: Partial<NeedleState> = {}): NeedleState {
  const entryPoint = { x: tip.x, y: tip.y + 40, z: tip.z };
  return {
    needleId: 'quincke-22g-89',
    preBend: 0,
    entryPoint,
    hubAngles: { pitch: 0, yaw: 0 },
    bevelAngle: 0,
    insertedDepth: 40,
    shaft: [entryPoint, { ...tip }],
    tip: { ...tip },
    ...extra,
  };
}

/**
 * Put a needle state (or null) in the app's store, through the store module
 * as served by the dev server (the same module instance the app uses).
 */
export async function putNeedle(page: Page, needle: NeedleState | null): Promise<void> {
  await page.evaluate(async (value) => {
    const storeModule = '/src/core/store.ts';
    const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    store.set({ needle: value });
  }, needle);
}

/** Set store.mode through the dev server's store module (test-only). */
export async function setMode(page: Page, mode: Mode): Promise<void> {
  await page.evaluate(async (m) => {
    const storeModule = '/src/core/store.ts';
    const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    store.set({ mode: m });
  }, mode);
}
