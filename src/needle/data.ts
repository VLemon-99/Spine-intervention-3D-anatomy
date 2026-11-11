// Needle catalogue and tuning numbers (F4.1), with hand-written validators.
// Both JSON files are drafts (reviewedByOwner: false); only the owner marks
// them reviewed. Plain TypeScript, no browser code.

import catalogueJson from './catalogue.json';
import paramsJson from './params.json';
import { TISSUE_LABELS, type TissueKey } from '../core/labels';

export const TIP_TYPES = ['quincke', 'tuohy', 'curved'] as const;
export type TipType = (typeof TIP_TYPES)[number];

export interface NeedleSpec {
  id: string;
  name: string;
  /** Gauge number (a smaller number is a thicker needle). */
  gauge: number;
  lengthMm: number;
  tipType: TipType;
  /** Relative bending stiffness (positive; a thicker needle is stiffer). */
  stiffness: number;
  /** Built-in tip curve in degrees (curved-tip needles only). */
  tipCurveDeg?: number;
}

export interface NeedleCatalogue {
  reviewedByOwner: boolean;
  needles: NeedleSpec[];
}

export interface NeedleParams {
  reviewedByOwner: boolean;
  /** The model's step length in mm (at most 0.5). */
  stepMm: number;
  /** Non-negative stiffness per tissue key; air is 0. */
  tissueStiffness: Record<TissueKey, number>;
  /**
   * Bevel drift per tip type: how many degrees per mm the direction of travel
   * turns away from the bevel face in tissue of stiffness 1 (non-negative).
   */
  driftDegPerMm: Record<TipType, number>;
}

const MAX_STEP_MM = 0.5;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function fail(file: string, problems: string[]): never {
  throw new Error(`${file} is not valid:\n- ${problems.join('\n- ')}`);
}

/** Checks the catalogue's shape and returns it typed; throws with every problem found. */
export function validateCatalogue(data: unknown): NeedleCatalogue {
  const problems: string[] = [];
  if (!isObject(data)) fail('catalogue.json', ['the file must be an object']);
  if (typeof data.reviewedByOwner !== 'boolean') problems.push('reviewedByOwner must be true or false');
  if (!Array.isArray(data.needles) || data.needles.length === 0) {
    fail('catalogue.json', [...problems, 'needles must be a non-empty list']);
  }
  const seen = new Set<string>();
  data.needles.forEach((entry: unknown, index: number) => {
    const where = `needles[${index}]`;
    if (!isObject(entry)) {
      problems.push(`${where} must be an object`);
      return;
    }
    if (typeof entry.id !== 'string' || entry.id === '') {
      problems.push(`${where}: id must be a non-empty text`);
    } else if (seen.has(entry.id)) {
      problems.push(`${where}: duplicate id "${entry.id}"`);
    } else {
      seen.add(entry.id);
    }
    if (typeof entry.name !== 'string' || entry.name === '') problems.push(`${where}: name must be a non-empty text`);
    if (!isFiniteNumber(entry.gauge) || entry.gauge <= 0) problems.push(`${where}: gauge must be a positive number`);
    if (!isFiniteNumber(entry.lengthMm) || entry.lengthMm <= 0) problems.push(`${where}: lengthMm must be a positive number`);
    if (!isFiniteNumber(entry.stiffness) || entry.stiffness <= 0) problems.push(`${where}: stiffness must be a positive number`);
    if (!TIP_TYPES.includes(entry.tipType as TipType)) {
      problems.push(`${where}: tipType must be one of ${TIP_TYPES.join(', ')} (got ${JSON.stringify(entry.tipType)})`);
    }
    if (entry.tipType === 'curved') {
      if (!isFiniteNumber(entry.tipCurveDeg) || entry.tipCurveDeg < 0) {
        problems.push(`${where}: a curved-tip needle needs tipCurveDeg (a number of degrees, 0 or more)`);
      }
    } else if (entry.tipCurveDeg !== undefined && !isFiniteNumber(entry.tipCurveDeg)) {
      problems.push(`${where}: tipCurveDeg must be a number`);
    }
  });
  if (problems.length > 0) fail('catalogue.json', problems);
  return data as unknown as NeedleCatalogue;
}

/** Checks the tuning numbers and returns them typed; throws with every problem found. */
export function validateParams(data: unknown): NeedleParams {
  const problems: string[] = [];
  if (!isObject(data)) fail('params.json', ['the file must be an object']);
  if (typeof data.reviewedByOwner !== 'boolean') problems.push('reviewedByOwner must be true or false');
  if (!isFiniteNumber(data.stepMm) || data.stepMm <= 0 || data.stepMm > MAX_STEP_MM) {
    problems.push(`stepMm must be a number above 0 and at most ${MAX_STEP_MM}`);
  }
  if (!isObject(data.tissueStiffness)) {
    problems.push('tissueStiffness must be an object with one number per tissue');
  } else {
    const stiffness = data.tissueStiffness;
    for (const { key } of TISSUE_LABELS) {
      const value = stiffness[key];
      if (!isFiniteNumber(value) || value < 0) {
        problems.push(`tissueStiffness.${key} must be a number, 0 or more`);
      }
    }
    if (isFiniteNumber(stiffness.air) && stiffness.air !== 0) {
      problems.push('tissueStiffness.air must be 0 (nothing drifts in air)');
    }
    const known = new Set<string>(TISSUE_LABELS.map((label) => label.key));
    for (const key of Object.keys(stiffness)) {
      if (!known.has(key)) problems.push(`tissueStiffness.${key} is not a tissue in src/core/labels.ts`);
    }
  }
  if (!isObject(data.driftDegPerMm)) {
    problems.push('driftDegPerMm must be an object with one number per tip type');
  } else {
    for (const tipType of TIP_TYPES) {
      const value = data.driftDegPerMm[tipType];
      if (!isFiniteNumber(value) || value < 0) problems.push(`driftDegPerMm.${tipType} must be a number, 0 or more`);
    }
  }
  if (problems.length > 0) fail('params.json', problems);
  return data as unknown as NeedleParams;
}

/** The committed catalogue, checked when this module loads. */
export const catalogue: NeedleCatalogue = validateCatalogue(catalogueJson);

/** The committed tuning numbers, checked when this module loads. */
export const params: NeedleParams = validateParams(paramsJson);

/** The catalogue entry for an id; throws for an unknown id. */
export function needleSpec(id: string): NeedleSpec {
  const spec = catalogue.needles.find((n) => n.id === id);
  if (!spec) throw new Error(`Unknown needle id "${id}"`);
  return spec;
}
