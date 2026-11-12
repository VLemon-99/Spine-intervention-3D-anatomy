// Shared checks for the soft-tissue modeller tests.
import { expect } from 'vitest';
import { TISSUE } from '../../src/core/labels';
import { PHANTOM_TEST_POINTS } from '../../src/core/phantom';
import type { Vec3, Volume } from '../../src/core/types';

export const labelAt = (vol: Volume, p: Vec3) => {
  const i = Math.round((p.x - vol.origin.x) / vol.spacing.x);
  const j = Math.round((p.y - vol.origin.y) / vol.spacing.y);
  const k = Math.round((p.z - vol.origin.z) / vol.spacing.z);
  return vol.labels[i + vol.size.x * (j + vol.size.y * k)];
};

/** The F0.4 check: back to front along the midline, first appearances in this order. */
export function expectMidlineOrder(vol: Volume): void {
  const { start, end } = PHANTOM_TEST_POINTS.midlineLine;
  const firstSeen: number[] = [];
  const steps = Math.ceil(Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) / 0.25);
  for (let n = 0; n <= steps; n++) {
    const t = n / steps;
    const label = labelAt(vol, { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y), z: start.z + t * (end.z - start.z) });
    if (!firstSeen.includes(label)) firstSeen.push(label);
  }
  const wanted = [TISSUE.skinFat, TISSUE.muscle, TISSUE.ligamentumFlavum, TISSUE.epiduralSpace, TISSUE.thecalSac];
  const order = wanted.map((id) => firstSeen.indexOf(id));
  for (const position of order) expect(position).toBeGreaterThanOrEqual(0);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
}
