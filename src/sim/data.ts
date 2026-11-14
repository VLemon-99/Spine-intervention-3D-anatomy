// Tissue resistance numbers (F6.2) and the arterial aspiration chance (F6.4),
// with a hand-written validator. tissues.json is a draft (reviewedByOwner:
// false); only the owner marks it reviewed. Plain TypeScript, no browser code.

import tissuesJson from './tissues.json';
import { TISSUE_LABELS, type TissueKey } from '../core/labels';

export interface TissueData {
  reviewedByOwner: boolean;
  /** Chance (0–1) that aspirating with the tip in an artery draws blood. */
  arterialAspirationProbability: number;
  /** Resistance at the tip, 0 (none) to 1 (hardest), for every tissue key. */
  resistance: Record<TissueKey, number>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnitNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Checks tissues.json's shape and returns it typed; throws with every problem found. */
export function validateTissues(data: unknown): TissueData {
  if (!isObject(data)) throw new Error('tissues.json is not valid:\n- the file must be an object');
  const problems: string[] = [];
  if (typeof data.reviewedByOwner !== 'boolean') problems.push('reviewedByOwner must be true or false');
  if (!isUnitNumber(data.arterialAspirationProbability)) {
    problems.push('arterialAspirationProbability must be a number from 0 to 1');
  }
  if (!isObject(data.resistance)) {
    problems.push('resistance must be an object with one number per tissue');
  } else {
    const resistance = data.resistance;
    for (const { key } of TISSUE_LABELS) {
      if (!isUnitNumber(resistance[key])) problems.push(`resistance.${key} must be a number from 0 to 1`);
    }
    const known = new Set<string>(TISSUE_LABELS.map((label) => label.key));
    for (const key of Object.keys(resistance)) {
      if (!known.has(key)) problems.push(`resistance.${key} is not a tissue in src/core/labels.ts`);
    }
  }
  if (problems.length > 0) throw new Error(`tissues.json is not valid:\n- ${problems.join('\n- ')}`);
  return data as unknown as TissueData;
}

/** The committed tissue numbers, checked when this module loads. */
export const tissues: TissueData = validateTissues(tissuesJson);
