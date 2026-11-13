// Central store for the state that crosses zones, plus a small typed event bus.
// Plain TypeScript, no browser code. The 3D view only reads the store.

import type {
  AttemptRecord,
  CArmPose,
  ImageKind,
  Landmarks,
  Mode,
  NeedleState,
  ProcedureEntry,
  RegionEntry,
  TissueEvent,
  Volume,
} from './types';

export interface SimState {
  /** Current C-arm and table position. */
  pose: CArmPose;
  /** Number of single shots taken in this case. */
  shotCount: number;
  /** Continuous fluoro time in this case, seconds. */
  fluoroTimeSeconds: number;
  /** Pose of the image on screen, or null before the first image. */
  lastImagePose: CArmPose | null;
  /**
   * How the image on screen was taken, or null before the first image. Set by
   * the C-arm zone together with lastImagePose, before it emits 'exposure'.
   */
  lastImageKind: ImageKind | null;
  mode: Mode;
  /** Loaded anatomy (its region name is volume.region), or null before loading. */
  volume: Volume | null;
  /** Landmarks of the loaded region, or null before loading. */
  landmarks: Landmarks | null;
  /** The needle, or null when there is no needle. */
  needle: NeedleState | null;
  /**
   * Extra (contrast) absorption per voxel on the same grid as the volume
   * (same size and index order), or null when there is no contrast.
   */
  contrast: Uint8Array | null;
  /**
   * Anatomy regions the learner can switch to, filled by the anatomy zone
   * from the manifest. Empty until then (and on a build without real regions).
   */
  regions: RegionEntry[];
  /**
   * Procedures the learner can pick in Practice and Exam, filled by the
   * procedures zone (F10). Empty until then.
   */
  procedures: ProcedureEntry[];
}

export type StateListener = (state: Readonly<SimState>) => void;

export interface Store {
  /** The current state. Treat it as read-only; change it only with set(). */
  get(): Readonly<SimState>;
  /** Change some fields. Subscribers are called once if anything changed. */
  set(patch: Partial<SimState>): void;
  /** Call listener after every change. Returns a function that unsubscribes. */
  subscribe(listener: StateListener): () => void;
}

export function initialState(): SimState {
  return {
    pose: { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 },
    shotCount: 0,
    fluoroTimeSeconds: 0,
    lastImagePose: null,
    lastImageKind: null,
    mode: 'freeplay',
    volume: null,
    landmarks: null,
    needle: null,
    contrast: null,
    regions: [],
    procedures: [],
  };
}

export function createStore(): Store {
  let state = initialState();
  const listeners = new Set<StateListener>();
  return {
    get: () => state,
    set(patch) {
      const keys = Object.keys(patch) as (keyof SimState)[];
      if (keys.every((key) => Object.is(state[key], patch[key]))) return;
      state = { ...state, ...patch };
      for (const listener of [...listeners]) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Bus events and their payloads. */
export interface BusEvents {
  /** An image is taken (single shot or a continuous-fluoro frame). */
  exposure: undefined;
  /** A new case starts; counters reset (F3.6). */
  caseStart: undefined;
  /** Something happened at the needle tip (F6.3, F9.6). */
  tissueEvent: TissueEvent;
  /**
   * The learner picked a region in the region picker (payload: its name).
   * The anatomy zone loads it and puts the volume and landmarks in the store.
   */
  regionRequest: string;
  /**
   * The learner picked a procedure in the procedure picker (payload: its id).
   * The procedures zone starts the case (briefing, caseStart).
   */
  procedureRequest: string;
  /**
   * An attempt has finished (a procedure, F10.5, or a quiz session, F11.4).
   * The app shell saves the record in the learner's history (F12.4).
   */
  attemptFinished: AttemptRecord;
  /**
   * The learner clicked or tapped the fluoro image (owner decision 2026-11-13).
   * Emitted by the render zone; the needle zone's Mark entry tool uses it (F5.2).
   */
  imageTap: ImageTap;
}

/**
 * A tapped point of the image on screen, as the pixel of the image AS TAKEN:
 * the render zone has already undone the display flips/rotation and the
 * magnification, so createProjection(store.lastImagePose).unproject(tap) is
 * the ray that made that pixel (src/core/geometry.ts pixel convention).
 */
export interface ImageTap {
  x: number;
  y: number;
}

export type BusEventName = keyof BusEvents;
type Listener<K extends BusEventName> = BusEvents[K] extends undefined
  ? () => void
  : (payload: BusEvents[K]) => void;
type EmitArgs<K extends BusEventName> = BusEvents[K] extends undefined ? [] : [payload: BusEvents[K]];

export interface EventBus {
  emit<K extends BusEventName>(name: K, ...args: EmitArgs<K>): void;
  on<K extends BusEventName>(name: K, listener: Listener<K>): void;
  off<K extends BusEventName>(name: K, listener: Listener<K>): void;
}

export function createEventBus(): EventBus {
  const listeners = new Map<BusEventName, Set<(...args: unknown[]) => void>>();
  return {
    emit(name, ...args) {
      for (const listener of [...(listeners.get(name) ?? [])]) listener(...args);
    },
    on(name, listener) {
      let set = listeners.get(name);
      if (!set) listeners.set(name, (set = new Set()));
      set.add(listener as (...args: unknown[]) => void);
    },
    off(name, listener) {
      listeners.get(name)?.delete(listener as (...args: unknown[]) => void);
    },
  };
}

/** The app's shared store and bus. Unit tests create their own with createStore()/createEventBus(). */
export const store = createStore();
export const bus = createEventBus();
