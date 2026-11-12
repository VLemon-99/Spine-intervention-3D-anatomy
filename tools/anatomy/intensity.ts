// CT number (Hounsfield units, HU) → 8-bit intensity stored in region files (SPEC F1.2).
//
// A straight line over a window: the window's lower end gives 0, its upper end 255,
// values in between are rounded, values outside are clamped. The mapping never
// decreases, so a denser voxel never gets a lower value.
//
// Default window: −1000 HU (air) to +2000 HU (dense cortical bone).
// The converter may be given another window; makeHuWindow checks it.

export interface HuWindow {
  /** HU value that maps to 0. */
  lower: number;
  /** HU value that maps to 255. Must be above `lower`. */
  upper: number;
}

export const DEFAULT_HU_WINDOW: Readonly<HuWindow> = Object.freeze({ lower: -1000, upper: 2000 });

/** Builds a checked window; throws a clear error if it is unusable. */
export function makeHuWindow(lower: number, upper: number): HuWindow {
  checkWindow({ lower, upper });
  return { lower, upper };
}

function checkWindow(w: HuWindow): void {
  if (!Number.isFinite(w.lower) || !Number.isFinite(w.upper)) {
    throw new Error(`HU window must have finite ends (got lower ${w.lower}, upper ${w.upper})`);
  }
  if (!(w.lower < w.upper)) {
    throw new Error(`HU window lower end must be below its upper end (got lower ${w.lower}, upper ${w.upper})`);
  }
}

/** One HU value → 0…255. NaN counts as air (0). */
export function huToIntensity(hu: number, window: HuWindow = DEFAULT_HU_WINDOW): number {
  checkWindow(window);
  return mapChecked(hu, window.lower, window.upper);
}

/** A whole volume of HU values → 8-bit intensities (same order). */
export function huVolumeToIntensity(hu: ArrayLike<number>, window: HuWindow = DEFAULT_HU_WINDOW): Uint8Array {
  checkWindow(window);
  const out = new Uint8Array(hu.length);
  for (let n = 0; n < hu.length; n++) out[n] = mapChecked(hu[n], window.lower, window.upper);
  return out;
}

function mapChecked(hu: number, lower: number, upper: number): number {
  if (Number.isNaN(hu) || hu <= lower) return 0;
  if (hu >= upper) return 255;
  return Math.round(((hu - lower) / (upper - lower)) * 255);
}
