// Tissue tracker (F6.2): follows the needle tip between updates and turns
// tissue crossings into TissueEvents. Plain TypeScript, no browser code.

import { TISSUE } from '../core/labels';
import type { NeedleState, TissueEvent, Vec3, Volume } from '../core/types';
import { labelAt } from './tissue';

/** Distance (mm) between samples along the tip's path, so thin layers are not jumped over. */
export const SAMPLE_STEP_MM = 0.25;

export interface TissueTracker {
  /** Compares the previous tip with the new one and returns the events that happened in between. */
  update(needle: NeedleState, volume: Volume, time: number): TissueEvent[];
  /** Forgets the previous tip (the next update starts afresh). */
  reset(): void;
}

interface Sample {
  point: Vec3;
  label: number;
}

/** Points along the segment from a to b (a excluded, b included), at most SAMPLE_STEP_MM apart. */
function samplePath(a: Vec3, b: Vec3): Vec3[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / SAMPLE_STEP_MM));
  const points: Vec3[] = [];
  for (let i = 1; i <= n; i += 1) {
    const t = i / n;
    points.push(i === n ? { ...b } : { x: a.x + dx * t, y: a.y + dy * t, z: a.z + dz * t });
  }
  return points;
}

export function createTissueTracker(): TissueTracker {
  let previous: Sample | null = null;

  return {
    update(needle, volume, time) {
      const tip = needle.tip;
      const points = previous ? samplePath(previous.point, tip) : [{ ...tip }];
      const events: TissueEvent[] = [];
      let last = previous;
      for (const point of points) {
        const sample: Sample = { point, label: labelAt(volume, point) };
        if (
          last &&
          last.label === TISSUE.ligamentumFlavum &&
          sample.label === TISSUE.epiduralSpace
        ) {
          events.push({ type: 'lossOfResistance', time, tip: { ...point }, message: 'Loss of resistance' });
        }
        last = sample;
      }
      previous = last;
      return events;
    },
    reset() {
      previous = null;
    },
  };
}
