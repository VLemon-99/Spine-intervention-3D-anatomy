// Render settings (docs/SPEC.md F2.3–F2.7): how the fluoro image is taken and
// displayed. Plain TypeScript, no browser code.
//
// The steps these settings switch on are listed, in order, at the top of
// pipeline.ts. Taking the image: magnification, noise level, collimation
// (they apply from the next image). Displaying it: invert, flips, rotation
// (they apply straight away).
//
// The settings live in a small store that belongs to the render zone; the
// app uses the one shared instance `renderSettings`.

import { ROTATIONS, type Rotation } from './orientation';
import { MAGNIFICATIONS, defaultNoiseLevel, type Collimation, type Magnification } from './pipeline';

export { ROTATIONS, type Rotation };
export { MAGNIFICATIONS, type Collimation, type Magnification };

export interface RenderSettings {
  /** false = more absorption is darker (bone dark, air light); true swaps this. */
  invert: boolean;
  magnification: Magnification;
  collimation: Collimation;
  /** Amount of X-ray grain, 0 (none) … 1 (maximum). */
  noiseLevel: number;
  /** Flip left-right. */
  flipHorizontal: boolean;
  /** Flip up-down. */
  flipVertical: boolean;
  /** Clockwise rotation in degrees, applied after the flips. */
  rotation: Rotation;
}

/** A change to some settings; shutters can be changed one at a time. */
export type RenderSettingsPatch = Partial<Omit<RenderSettings, 'collimation'>> & {
  collimation?: Partial<Collimation>;
};

export const COLLIMATION_MAX_PERCENT = 50;
const EDGES = ['left', 'right', 'top', 'bottom'] as const;

export function defaultRenderSettings(): RenderSettings {
  return {
    invert: false,
    magnification: 1,
    collimation: { left: 0, right: 0, top: 0, bottom: 0 },
    noiseLevel: defaultNoiseLevel('shot'),
    flipHorizontal: false,
    flipVertical: false,
    rotation: 0,
  };
}

export function cloneSettings(settings: RenderSettings): RenderSettings {
  return { ...settings, collimation: { ...settings.collimation } };
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * The settings after a change, as a new object. Numbers outside their range
 * are clamped. Values that cannot be used — NaN/Infinity, a magnification or
 * rotation that is not one of the allowed options, an on/off value that is not
 * true or false — are ignored, leaving the old value.
 */
export function applySettingsPatch(current: RenderSettings, patch: RenderSettingsPatch): RenderSettings {
  const next = cloneSettings(current);
  const p = patch as { [K in keyof RenderSettings]?: unknown };

  for (const key of ['invert', 'flipHorizontal', 'flipVertical'] as const) {
    const value = p[key];
    if (typeof value === 'boolean') next[key] = value;
  }
  const magnification = MAGNIFICATIONS.find((m) => m === p.magnification);
  if (magnification !== undefined) next.magnification = magnification;
  const rotation = ROTATIONS.find((r) => r === p.rotation);
  if (rotation !== undefined) next.rotation = rotation;
  if (isFiniteNumber(p.noiseLevel)) next.noiseLevel = clamp(p.noiseLevel, 0, 1);
  if (typeof p.collimation === 'object' && p.collimation !== null) {
    const shutters = p.collimation as { [K in keyof Collimation]?: unknown };
    for (const edge of EDGES) {
      const value = shutters[edge];
      if (isFiniteNumber(value)) next.collimation[edge] = clamp(value, 0, COLLIMATION_MAX_PERCENT);
    }
  }
  return next;
}

export function settingsEqual(a: RenderSettings, b: RenderSettings): boolean {
  return (
    a.invert === b.invert &&
    a.magnification === b.magnification &&
    a.noiseLevel === b.noiseLevel &&
    a.flipHorizontal === b.flipHorizontal &&
    a.flipVertical === b.flipVertical &&
    a.rotation === b.rotation &&
    EDGES.every((edge) => a.collimation[edge] === b.collimation[edge])
  );
}

export type SettingsListener = (settings: Readonly<RenderSettings>) => void;

export interface SettingsStore {
  /** The current settings. Treat them as read-only; change them only with set(). */
  get(): Readonly<RenderSettings>;
  /** Change some settings (validated). Subscribers are called once if anything really changed. */
  set(patch: RenderSettingsPatch): void;
  /** Call listener after every real change. Returns a function that unsubscribes. */
  subscribe(listener: SettingsListener): () => void;
}

export function createSettingsStore(): SettingsStore {
  let settings = defaultRenderSettings();
  const listeners = new Set<SettingsListener>();
  return {
    get: () => settings,
    set(patch) {
      const next = applySettingsPatch(settings, patch);
      if (settingsEqual(settings, next)) return;
      settings = next;
      for (const listener of [...listeners]) listener(settings);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app's one settings store. Unit tests create their own with createSettingsStore(). */
export const renderSettings = createSettingsStore();
