// Screen-test helpers of the view3d zone (not a spec file).
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { NeedleState, Vec3 } from '../../../src/core/types';

/** What window.__sim.view3d() returns. */
export interface View3dInfo {
  shown: boolean;
  toggleEnabled: boolean;
  objects: { name: string; visible: boolean; triangles: number }[];
  camera: { position: Vec3; target: Vec3 };
  /** C-arm parts read from the scene objects. */
  carm: { source: Vec3; detectorCentre: Vec3; detectorCorners: Vec3[] };
  /** Hub and tip of the needle object in the scene, or null when no needle is shown. */
  needle: { hub: Vec3; tip: Vec3 } | null;
}

type View3dHook = { __sim: { view3d(): View3dInfo } };

/** Wait until window.__sim.view3d exists, then return what it reports. */
export async function getView3d(page: Page): Promise<View3dInfo> {
  await page.waitForFunction(
    () => typeof (window as { __sim?: { view3d?: unknown } }).__sim?.view3d === 'function',
  );
  return page.evaluate(() => (window as unknown as View3dHook).__sim.view3d());
}

/** The scene object with this name, or undefined. */
export function sceneObject(info: View3dInfo, name: string): View3dInfo['objects'][number] | undefined {
  return info.objects.find((o) => o.name === name);
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
 * Check that a control is fully inside the window without scrolling the page,
 * and return its on-screen box.
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

/**
 * Count the pixels of the 3D canvas whose colour differs from its top-left
 * corner pixel (the background colour) by more than a few levels.
 */
export async function countNonBackgroundPixels(page: Page): Promise<number> {
  return page.getByTestId('view3d-canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext('2d');
    if (!context || copy.width === 0 || copy.height === 0) return 0;
    context.drawImage(canvas, 0, 0);
    const { data } = context.getImageData(0, 0, copy.width, copy.height);
    const [r, g, b] = [data[0]!, data[1]!, data[2]!];
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i]! - r) + Math.abs(data[i + 1]! - g) + Math.abs(data[i + 2]! - b) > 12) count++;
    }
    return count;
  });
}

/**
 * Put a small test volume in the store: an n×n×n grid of air (1 mm voxels,
 * centred on the isocentre) with the given voxels set to cortical bone —
 * through the app's own store module as served by the dev server (the same
 * trick as setPose in tests/fixtures/simPage.ts). Test-only.
 */
export async function putTestVolume(page: Page, n: number, boneVoxels: [number, number, number][]): Promise<void> {
  await page.evaluate(
    async ({ n, boneVoxels }) => {
      const storeModule = '/src/core/store.ts';
      const labelsModule = '/src/core/labels.ts';
      const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
      const { TISSUE } = (await import(/* @vite-ignore */ labelsModule)) as typeof import('../../../src/core/labels');
      const labels = new Uint8Array(n * n * n);
      for (const [i, j, k] of boneVoxels) labels[i + n * (j + n * k)] = TISSUE.corticalBone;
      const half = (n - 1) / 2;
      store.set({
        volume: {
          region: 'view3d-test',
          size: { x: n, y: n, z: n },
          spacing: { x: 1, y: 1, z: 1 },
          origin: { x: -half, y: -half, z: -half },
          orientation: [
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            { x: 0, y: 0, z: 1 },
          ],
          intensity: new Uint8Array(n * n * n),
          labels,
        },
      });
    },
    { n, boneVoxels },
  );
}

/** A hand-made needle for tests: hub at the first shaft point, tip at the last. */
export function testNeedle(shaft: Vec3[]): NeedleState {
  return {
    needleId: 'test-needle',
    preBend: 0,
    entryPoint: { ...shaft[0]! },
    hubAngles: { pitch: 0, yaw: 0 },
    bevelAngle: 0,
    insertedDepth: 0,
    shaft: shaft.map((p) => ({ ...p })),
    tip: { ...shaft[shaft.length - 1]! },
  };
}

/**
 * Put a needle (or null for none) in the store through the app's own store
 * module as served by the dev server (the same trick as setPose). Test-only.
 */
export async function putNeedle(page: Page, needle: NeedleState | null): Promise<void> {
  await page.evaluate(async (n) => {
    const storeModule = '/src/core/store.ts';
    const { store } = (await import(/* @vite-ignore */ storeModule)) as typeof import('../../../src/core/store');
    store.set({ needle: n });
  }, needle);
}

/** Distance from the camera to its target, mm. */
export function cameraDistance(info: View3dInfo): number {
  const { position: p, target: t } = info.camera;
  return Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z);
}

/**
 * Make the page taller than the window, so it COULD scroll: a test that the
 * page does not scroll during a gesture then really checks something.
 */
export async function makePageScrollable(page: Page): Promise<void> {
  await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.dataset.testid = 'scroll-spacer';
    spacer.style.height = '3000px';
    document.body.append(spacer);
    document.body.style.height = 'auto';
    document.documentElement.style.height = 'auto';
  });
}

/** The page's scroll position and zoom (visual viewport scale). */
export async function pageScrollAndZoom(page: Page): Promise<{ x: number; y: number; scale: number }> {
  return page.evaluate(() => ({ x: window.scrollX, y: window.scrollY, scale: window.visualViewport?.scale ?? 1 }));
}
