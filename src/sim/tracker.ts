// Tissue tracker (F6.2, F6.3): follows the needle tip between updates and turns
// tissue crossings into TissueEvents. Plain TypeScript, no browser code.

import { SIDES, TISSUE, type LevelCode, type Side } from '../core/labels';
import type { Landmarks, NeedleState, TissueEvent, TissueEventType, Vec3, Volume } from '../core/types';
import { assertStandardLayout, labelAt } from './tissue';

/** Distance (mm) between samples along the tip's path, so thin layers are not jumped over. */
export const SAMPLE_STEP_MM = 0.25;

/** A tip this close (mm) to a nerve-root voxel centre touches the nerve (F6.3). */
export const NERVE_CONTACT_MM = 1;

export interface TissueTracker {
  /**
   * Compares the previous tip with the new one and returns the events that
   * happened in between. Landmarks (optional) name the level and side of a
   * nerve contact.
   */
  update(needle: NeedleState, volume: Volume, time: number, landmarks?: Landmarks | null): TissueEvent[];
  /** Forgets the previous tip (the next update starts afresh). */
  reset(): void;
}

/**
 * Events for entering a tissue (F6.3): emitted once each time a sample enters
 * one of these tissues from a different one. Artery and vein share the message
 * 'Intravascular' so the learner is not told which kind of vessel it is
 * (owner decision 2026-11-13).
 */
const ENTRY_EVENTS: ReadonlyMap<number, { type: TissueEventType; message: string }> = new Map([
  [TISSUE.thecalSac, { type: 'duralPuncture', message: 'Dural puncture' }],
  [TISSUE.spinalCord, { type: 'cordContact', message: 'Spinal cord contact' }],
  [TISSUE.artery, { type: 'intravascular', message: 'Intravascular' }],
  [TISSUE.vein, { type: 'intravascular', message: 'Intravascular' }],
]);

interface Sample {
  point: Vec3;
  label: number;
  /** Within NERVE_CONTACT_MM of a nerve-root voxel centre. */
  nearNerve: boolean;
}

/** True when some nerve-root voxel centre is within NERVE_CONTACT_MM of the point. */
export function isNearNerve(volume: Volume, point: Vec3): boolean {
  assertStandardLayout(volume);
  const { size, spacing, origin, labels } = volume;
  const r = NERVE_CONTACT_MM;
  const range = (p: number, o: number, s: number, n: number): [number, number] => [
    Math.max(0, Math.ceil((p - r - o) / s)),
    Math.min(n - 1, Math.floor((p + r - o) / s)),
  ];
  const [i0, i1] = range(point.x, origin.x, spacing.x, size.x);
  const [j0, j1] = range(point.y, origin.y, spacing.y, size.y);
  const [k0, k1] = range(point.z, origin.z, spacing.z, size.z);
  for (let k = k0; k <= k1; k += 1) {
    const dz = origin.z + k * spacing.z - point.z;
    for (let j = j0; j <= j1; j += 1) {
      const dy = origin.y + j * spacing.y - point.y;
      for (let i = i0; i <= i1; i += 1) {
        const dx = origin.x + i * spacing.x - point.x;
        if (dx * dx + dy * dy + dz * dz > r * r) continue;
        if (labels[i + size.x * (j + size.y * k)] === TISSUE.nerveRoot) return true;
      }
    }
  }
  return false;
}

/**
 * The level and side of the foramen centre nearest to the point (a foramen is
 * listed under the level above it), or null when there are no foramina.
 */
export function nearestForamen(
  landmarks: Landmarks | null | undefined,
  point: Vec3,
): { level: LevelCode; side: Side } | null {
  let best: { level: LevelCode; side: Side } | null = null;
  let bestDistance = Infinity;
  for (const level of landmarks?.levels ?? []) {
    for (const side of SIDES) {
      const centre = level.foramenCentre?.[side];
      if (!centre) continue;
      const distance = Math.hypot(centre.x - point.x, centre.y - point.y, centre.z - point.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { level: level.level, side };
      }
    }
  }
  return best;
}

function nerveContactEvent(time: number, point: Vec3, landmarks: Landmarks | null | undefined): TissueEvent {
  const tip = { ...point };
  const foramen = nearestForamen(landmarks, point);
  if (!foramen) return { type: 'nerveContact', time, tip, message: 'Paresthesia' };
  return {
    type: 'nerveContact',
    time,
    tip,
    message: `Paresthesia — ${foramen.side} ${foramen.level}`,
    level: foramen.level,
    side: foramen.side,
  };
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
    update(needle, volume, time, landmarks) {
      const tip = needle.tip;
      const points = previous ? samplePath(previous.point, tip) : [{ ...tip }];
      const events: TissueEvent[] = [];
      let last = previous;
      for (const point of points) {
        const sample: Sample = { point, label: labelAt(volume, point), nearNerve: isNearNerve(volume, point) };
        if (
          last &&
          last.label === TISSUE.ligamentumFlavum &&
          sample.label === TISSUE.epiduralSpace
        ) {
          events.push({ type: 'lossOfResistance', time, tip: { ...point }, message: 'Loss of resistance' });
        }
        const entry = ENTRY_EVENTS.get(sample.label);
        if (last && entry && last.label !== sample.label) {
          events.push({ type: entry.type, time, tip: { ...point }, message: entry.message });
        }
        if (last && sample.nearNerve && !last.nearNerve) {
          events.push(nerveContactEvent(time, point, landmarks));
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
