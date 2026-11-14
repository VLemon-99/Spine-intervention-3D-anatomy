// Aspiration (F6.4): what pulling back on the syringe draws, by the tissue at
// the tip. In an artery, blood comes back only with a seeded probability,
// because a negative aspiration does not rule out arterial placement.
// Plain TypeScript, no browser code.

import type { TissueKey } from '../core/labels';
import type { RandomFn } from '../core/random';
import { tissues } from './data';

export type AspirateResult = 'CSF' | 'blood' | 'nothing';

/**
 * The aspiration result for the tissue at the tip. `random` is only used in an
 * artery; `probability` (default from tissues.json) is the chance of blood there.
 */
export function aspirate(
  tissueKey: TissueKey,
  random: RandomFn,
  probability: number = tissues.arterialAspirationProbability,
): AspirateResult {
  switch (tissueKey) {
    case 'thecalSac':
      return 'CSF';
    case 'vein':
      return 'blood';
    case 'artery':
      return random() < probability ? 'blood' : 'nothing';
    default:
      return 'nothing';
  }
}
