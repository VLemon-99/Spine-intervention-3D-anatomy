// Pose limits (docs/SPEC.md F3.1) and the one way controls change the pose.
// Plain TypeScript, no browser code. Every C-arm control (sliders, keys,
// pedal) changes the pose through changePose(), so the store never holds a
// value outside its range.
import type { Store } from '../core/store';
import type { CArmPose } from '../core/types';

export interface Range {
  min: number;
  max: number;
}

/**
 * Allowed range of each pose value. Angles in degrees, table moves in mm.
 * oblique: negative = left, positive = right, ±90 = lateral.
 * tilt: negative = caudal, positive = cranial.
 */
export const POSE_LIMITS: Readonly<Record<keyof CArmPose, Readonly<Range>>> = Object.freeze({
  oblique: Object.freeze({ min: -90, max: 90 }),
  tilt: Object.freeze({ min: -40, max: 40 }),
  tableLeftRight: Object.freeze({ min: -200, max: 200 }),
  tableHeadFoot: Object.freeze({ min: -400, max: 400 }),
  tableHeight: Object.freeze({ min: -150, max: 150 }),
});

const clampValue = (value: number, { min, max }: Range): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0;

/** A new pose with every value inside its range; a non-finite value becomes 0. */
export function clampPose(pose: CArmPose): CArmPose {
  return {
    oblique: clampValue(pose.oblique, POSE_LIMITS.oblique),
    tilt: clampValue(pose.tilt, POSE_LIMITS.tilt),
    tableLeftRight: clampValue(pose.tableLeftRight, POSE_LIMITS.tableLeftRight),
    tableHeadFoot: clampValue(pose.tableHeadFoot, POSE_LIMITS.tableHeadFoot),
    tableHeight: clampValue(pose.tableHeight, POSE_LIMITS.tableHeight),
  };
}

/** Change some pose values in the store; the result is clamped and a new object. */
export function changePose(store: Store, patch: Partial<CArmPose>): void {
  store.set({ pose: clampPose({ ...store.get().pose, ...patch }) });
}
