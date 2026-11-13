import { describe, expect, it } from 'vitest';
import { aspirate } from '../../src/sim/aspirate';
import { createRandom } from '../../src/core/random';
import { TISSUE_LABELS, type TissueKey } from '../../src/core/labels';

describe('aspirate (F6.4)', () => {
  it('thecal sac gives CSF; vein gives blood; muscle and epidural space give nothing', () => {
    const random = createRandom(1);
    expect(aspirate('thecalSac', random)).toBe('CSF');
    expect(aspirate('vein', random)).toBe('blood');
    expect(aspirate('muscle', random)).toBe('nothing');
    expect(aspirate('epiduralSpace', random)).toBe('nothing');
  });

  it('every tissue other than thecal sac, vein and artery gives nothing', () => {
    const random = createRandom(2);
    const others = TISSUE_LABELS.map((l) => l.key).filter(
      (k): k is TissueKey => !['thecalSac', 'vein', 'artery'].includes(k),
    );
    for (const key of others) expect(aspirate(key, random), key).toBe('nothing');
  });

  it('in an artery with a fixed seed, 1000 aspirations give blood 45–55% of the time', () => {
    const random = createRandom(12345);
    let blood = 0;
    for (let i = 0; i < 1000; i += 1) {
      const result = aspirate('artery', random);
      expect(['blood', 'nothing']).toContain(result);
      if (result === 'blood') blood += 1;
    }
    expect(blood).toBeGreaterThanOrEqual(450);
    expect(blood).toBeLessThanOrEqual(550);
  });

  it('the same seed gives the same sequence of results', () => {
    const sequence = (seed: number) => {
      const random = createRandom(seed);
      return Array.from({ length: 50 }, () => aspirate('artery', random));
    };
    expect(sequence(7)).toEqual(sequence(7));
    expect(sequence(7)).toContain('blood');
    expect(sequence(7)).toContain('nothing');
  });

  it('probability 0 never gives blood in an artery; probability 1 always does', () => {
    const random = createRandom(99);
    for (let i = 0; i < 200; i += 1) {
      expect(aspirate('artery', random, 0)).toBe('nothing');
      expect(aspirate('artery', random, 1)).toBe('blood');
    }
  });

  it('a vein gives blood whatever the probability', () => {
    expect(aspirate('vein', createRandom(3), 0)).toBe('blood');
  });
});
