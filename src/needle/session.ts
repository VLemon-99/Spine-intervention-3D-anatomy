// One needle session (F5.1, F5.3, F5.4): the learner's chosen needle and
// pre-bend, the entry point, and the F4 model once an entry is marked. It
// enforces the handling rules: needle and pre-bend are locked while the needle
// is inserted, and the hub stays within ±45° of the start. Plain TypeScript,
// no browser code.

import type { NeedleState, Vec3, Volume } from '../core/types';
import { catalogue } from './data';
import {
  advance as advanceModel,
  createNeedle,
  rotateBevel as rotateModelBevel,
  setHubAngles as setModelHubAngles,
  toNeedleState as modelToState,
  withdraw as withdrawModel,
  type NeedleModel,
} from './model';

/** What a session call did. */
export type SessionResult = 'ok' | 'locked' | 'rejected' | 'ignored' | 'noNeedle';

/** Largest hub angle on each axis, degrees from the start (F5.4). */
export const MAX_HUB_ANGLE_DEG = 45;
/** Pre-bend choices step by this many degrees (F5.1). */
export const PRE_BEND_STEP_DEG = 5;
/** Largest pre-bend choice, degrees (F5.1). */
export const MAX_PRE_BEND_CHOICE_DEG = 30;

export interface NeedleSession {
  readonly needleId: string;
  readonly preBend: number;
  /** True while the needle is inserted (depth above 0). */
  readonly locked: boolean;
  /** The F4 model, or null before an entry is marked. */
  readonly model: NeedleModel | null;
  /** The volume the needle moves through (null: advancing does nothing). */
  volume: Volume | null;
  chooseNeedle(id: string): SessionResult;
  choosePreBend(deg: number): SessionResult;
  /** Places the needle's tip at `point`, pointing against `beamDirection` (source → detector). */
  markEntry(point: Vec3, beamDirection: Vec3): SessionResult;
  setHubAngles(pitch: number, yaw: number): SessionResult;
  nudgeHub(dPitch: number, dYaw: number): SessionResult;
  advance(mm: number): SessionResult;
  withdraw(mm: number): SessionResult;
  rotateBevel(deg: number): SessionResult;
  /** Removes the needle; choosing and marking work again. */
  withdrawFully(): SessionResult;
  /** The shared NeedleState, or null when there is no needle. */
  toNeedleState(): NeedleState | null;
  /** Calls listener after every change. Returns a function that unsubscribes. */
  subscribe(listener: () => void): () => void;
}

const clampHub = (v: number): number =>
  Math.min(MAX_HUB_ANGLE_DEG, Math.max(-MAX_HUB_ANGLE_DEG, Number.isFinite(v) ? v : 0));

/** A new session. Starts with the first catalogue needle, no pre-bend and no needle placed. */
export function createNeedleSession(volume: Volume | null = null): NeedleSession {
  let needleId = catalogue.needles[0].id;
  let preBend = 0;
  let model: NeedleModel | null = null;
  let entry: { point: Vec3; direction: Vec3 } | null = null;
  const listeners = new Set<() => void>();
  /** Tells listeners about a change and passes the result on. */
  const changed = (result: SessionResult): SessionResult => {
    if (result === 'ok') for (const listener of [...listeners]) listener();
    return result;
  };

  const isLocked = () => model !== null && model.depth > 0;
  const isCurved = (id: string) => catalogue.needles.find((n) => n.id === id)?.tipType === 'curved';
  /** Re-creates an uninserted needle at the same entry after a choice changes. */
  const rebuild = () => {
    if (entry) {
      model = createNeedle({
        needleId,
        preBend,
        entryPoint: entry.point,
        direction: { x: -entry.direction.x, y: -entry.direction.y, z: -entry.direction.z },
      });
    }
  };

  const session: NeedleSession = {
    get needleId() {
      return needleId;
    },
    get preBend() {
      return preBend;
    },
    get locked() {
      return isLocked();
    },
    get model() {
      return model;
    },
    volume,
    chooseNeedle(id) {
      if (isLocked()) return 'locked';
      if (!catalogue.needles.some((n) => n.id === id)) return 'rejected';
      needleId = id;
      rebuild();
      return changed('ok');
    },
    choosePreBend(deg) {
      if (isLocked()) return 'locked';
      if (
        !Number.isFinite(deg) ||
        deg < 0 ||
        deg > MAX_PRE_BEND_CHOICE_DEG ||
        deg % PRE_BEND_STEP_DEG !== 0
      )
        return 'rejected';
      if (isCurved(needleId)) return 'ignored';
      preBend = deg;
      rebuild();
      return changed('ok');
    },
    markEntry(point, beamDirection) {
      if (isLocked()) return 'locked';
      const len = Math.hypot(beamDirection.x, beamDirection.y, beamDirection.z);
      if (![point.x, point.y, point.z].every(Number.isFinite) || !(len > 0) || !Number.isFinite(len))
        return 'rejected';
      entry = { point: { ...point }, direction: { ...beamDirection } };
      rebuild();
      return changed('ok');
    },
    setHubAngles(pitch, yaw) {
      if (!model) return 'noNeedle';
      model = setModelHubAngles(model, { pitch: clampHub(pitch), yaw: clampHub(yaw) });
      return changed('ok');
    },
    nudgeHub(dPitch, dYaw) {
      if (!model) return 'noNeedle';
      const { pitch, yaw } = model.hubAngles;
      return session.setHubAngles(pitch + (Number.isFinite(dPitch) ? dPitch : 0), yaw + (Number.isFinite(dYaw) ? dYaw : 0));
    },
    advance(mm) {
      if (!model) return 'noNeedle';
      if (!session.volume) return 'rejected';
      model = advanceModel(model, mm, session.volume).state;
      return changed('ok');
    },
    withdraw(mm) {
      if (!model) return 'noNeedle';
      model = withdrawModel(model, mm);
      return changed('ok');
    },
    rotateBevel(deg) {
      if (!model) return 'noNeedle';
      model = rotateModelBevel(model, deg);
      return changed('ok');
    },
    withdrawFully() {
      if (!model && !entry) return 'ok';
      model = null;
      entry = null;
      return changed('ok');
    },
    toNeedleState() {
      return model ? modelToState(model) : null;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return session;
}

/** The app's one needle session (F5-S3). Unit tests create their own with createNeedleSession(). */
export const needleSession = createNeedleSession();

