// F7.1: the GPU needle (drrGpu.ts) matches the CPU reference (renderDrrCpu with
// the same needle and pose, no noise) around the needle's projected middle.
import { expect, test } from '@playwright/test';
import { createProjection } from '../../../src/core/geometry';
import { createPhantom } from '../../../src/core/phantom';
import type { CArmPose, Vec3 } from '../../../src/core/types';
import { renderDrrCpu, type DrrImage } from '../../../src/render/drrCpu';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, setPose, takeImage } from '../../fixtures/simPage';
import { MAX_MEAN_DIFFERENCE, putNeedle, readWholeCanvas, setRenderSettings, straightTestNeedle } from './renderPage';

const phantom = createPhantom();
const BOX_HALF = 10; // a 21×21 px box

interface Case {
  name: string;
  pose: CArmPose;
  hub: Vec3;
  tip: Vec3;
}

const middleOf = (c: Case): Vec3 => ({
  x: (c.hub.x + c.tip.x) / 2,
  y: (c.hub.y + c.tip.y) / 2,
  z: (c.hub.z + c.tip.z) / 2,
});

const CASES: Case[] = [
  {
    name: 'a needle across the beam in soft tissue at pose 0°/0°',
    pose: { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 },
    hub: { x: -10, y: 30, z: 32 },
    tip: { x: 10, y: 30, z: 32 },
  },
  {
    name: 'a slanted needle in soft tissue at oblique +25°, tilt −10°',
    pose: { oblique: 25, tilt: -10, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 },
    hub: { x: 30, y: 30, z: -5 },
    tip: { x: 26, y: 8, z: 8 },
  },
];

/** The needle in the air above the back, outside the phantom's box (which ends at y = 47). */
const IN_AIR: Case = {
  name: 'a needle in the air above the back (y = 55 mm)',
  pose: { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 },
  hub: { x: -10, y: 55, z: 10 },
  tip: { x: 10, y: 55, z: 10 },
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await getSimState(page);
  await acceptDisclaimer(page);
  await setRenderSettings(page, { noiseLevel: 0 });
});

/** Take the GPU image of the case; return it with the CPU references (with and without the needle). */
async function imagesOf(page: import('@playwright/test').Page, c: Case) {
  const needle = straightTestNeedle(c.hub, c.tip);
  await setPose(page, c.pose);
  await putNeedle(page, needle);
  await takeImage(page);
  const gpu = await readWholeCanvas(page);
  const cpu = renderDrrCpu(phantom, c.pose, { needle: needle.shaft });
  const cpuWithout = renderDrrCpu(phantom, c.pose);
  const q = createProjection(c.pose).project(middleOf(c));
  return { gpu, cpu, cpuWithout, centre: { x: Math.floor(q.x), y: Math.floor(q.y) } };
}

/** Mean absolute difference (grey levels) between the canvas and the CPU image in the 21×21 box. */
function boxDifference(gpu: { width: number; data: Uint8Array }, cpu: DrrImage, centre: { x: number; y: number }) {
  let sum = 0;
  let count = 0;
  for (let y = centre.y - BOX_HALF; y <= centre.y + BOX_HALF; y++) {
    for (let x = centre.x - BOX_HALF; x <= centre.x + BOX_HALF; x++) {
      sum += Math.abs(gpu.data[x + gpu.width * y]! - cpu.data[x + cpu.width * y]! * 255);
      count++;
    }
  }
  return sum / count;
}

/** The darkest grey (0–255) within 1 px of the centre: the needle's own pixel. */
function needleGrey(read: (x: number, y: number) => number, centre: { x: number; y: number }): number {
  let darkest = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) darkest = Math.min(darkest, read(centre.x + dx, centre.y + dy));
  return darkest;
}

/** The mean grey of the box's four corners (10 px from the centre on both axes): the surroundings. */
function surroundGrey(read: (x: number, y: number) => number, centre: { x: number; y: number }): number {
  const d = BOX_HALF;
  return (read(centre.x - d, centre.y - d) + read(centre.x + d, centre.y - d) + read(centre.x - d, centre.y + d) + read(centre.x + d, centre.y + d)) / 4;
}

for (const c of CASES) {
  test(`${c.name}: the GPU image matches the CPU reference around the needle`, async ({ page }) => {
    const { gpu, cpu, centre } = await imagesOf(page, c);
    const mean = boxDifference(gpu, cpu, centre);
    expect(mean, `mean difference ${mean.toFixed(3)} grey levels`).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);

    const readGpu = (x: number, y: number): number => gpu.data[x + gpu.width * y]!;
    const readCpu = (x: number, y: number): number => cpu.data[x + cpu.width * y]! * 255;
    expect(needleGrey(readGpu, centre), 'GPU: needle darker than its surroundings').toBeLessThan(surroundGrey(readGpu, centre) - 20);
    expect(needleGrey(readCpu, centre), 'CPU: needle darker than its surroundings').toBeLessThan(surroundGrey(readCpu, centre) - 20);
  });
}

test(`${IN_AIR.name}: it darkens the GPU image too, matching the CPU reference`, async ({ page }) => {
  const { gpu, cpu, cpuWithout, centre } = await imagesOf(page, IN_AIR);
  const mean = boxDifference(gpu, cpu, centre);
  expect(mean, `mean difference ${mean.toFixed(3)} grey levels`).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE);

  const readGpu = (x: number, y: number): number => gpu.data[x + gpu.width * y]!;
  const readWithout = (x: number, y: number): number => cpuWithout.data[x + cpuWithout.width * y]! * 255;
  expect(needleGrey(readGpu, centre), 'GPU: darker than the image with no needle').toBeLessThan(needleGrey(readWithout, centre) - 20);
  expect(needleGrey(readGpu, centre), 'GPU: needle darker than its surroundings').toBeLessThan(surroundGrey(readGpu, centre) - 20);
});
