import { describe, expect, it } from 'vitest';
import { tissues, validateTissues } from '../../src/sim/data';
import tissuesJson from '../../src/sim/tissues.json';
import { TISSUE_LABELS } from '../../src/core/labels';

/** A fresh, valid copy that a test can break on purpose. */
function goodTissues(): Record<string, unknown> & { resistance: Record<string, unknown> } {
  return JSON.parse(JSON.stringify(tissuesJson));
}

describe('tissue resistance file (F6.2, F6.4)', () => {
  it('the committed file passes the validator', () => {
    expect(() => validateTissues(tissuesJson)).not.toThrow();
  });

  it('has a resistance between 0 and 1 for every tissue key', () => {
    for (const { key } of TISSUE_LABELS) {
      const value = tissues.resistance[key];
      expect(typeof value, key).toBe('number');
      expect(value, key).toBeGreaterThanOrEqual(0);
      expect(value, key).toBeLessThanOrEqual(1);
    }
  });

  it('is a draft: reviewedByOwner is false and notes say the numbers are drafts', () => {
    expect(tissues.reviewedByOwner).toBe(false);
    expect(typeof tissuesJson.notes).toBe('string');
    expect(tissuesJson.notes.toLowerCase()).toContain('draft');
  });

  it('ligamentum flavum resists more than the epidural space (loss of resistance)', () => {
    expect(tissues.resistance.ligamentumFlavum).toBeGreaterThan(tissues.resistance.epiduralSpace);
  });

  it('bone and ligamentum flavum are high; epidural space and thecal sac are low', () => {
    const r = tissues.resistance;
    for (const high of [r.corticalBone, r.cancellousBone, r.ligamentumFlavum]) {
      expect(high).toBeGreaterThan(0.6);
    }
    for (const low of [r.epiduralSpace, r.thecalSac]) {
      expect(low).toBeLessThan(0.2);
    }
  });

  it('arterialAspirationProbability is 0.5', () => {
    expect(tissues.arterialAspirationProbability).toBe(0.5);
  });

  it('rejects a missing tissue key', () => {
    const data = goodTissues();
    delete data.resistance.epiduralSpace;
    expect(() => validateTissues(data)).toThrow(/epiduralSpace/);
  });

  it('rejects a resistance outside 0–1', () => {
    const above = goodTissues();
    above.resistance.muscle = 1.5;
    expect(() => validateTissues(above)).toThrow(/muscle/);
    const below = goodTissues();
    below.resistance.muscle = -0.1;
    expect(() => validateTissues(below)).toThrow(/muscle/);
    const notNumber = goodTissues();
    notNumber.resistance.muscle = 'high';
    expect(() => validateTissues(notNumber)).toThrow(/muscle/);
  });

  it('rejects a probability outside 0–1', () => {
    const above = goodTissues();
    above.arterialAspirationProbability = 1.2;
    expect(() => validateTissues(above)).toThrow(/arterialAspirationProbability/);
    const below = goodTissues();
    below.arterialAspirationProbability = -0.5;
    expect(() => validateTissues(below)).toThrow(/arterialAspirationProbability/);
    const missing = goodTissues();
    delete missing.arterialAspirationProbability;
    expect(() => validateTissues(missing)).toThrow(/arterialAspirationProbability/);
  });

  it('rejects an unknown tissue key and a non-object', () => {
    const data = goodTissues();
    data.resistance.bogus = 0.5;
    expect(() => validateTissues(data)).toThrow(/bogus/);
    expect(() => validateTissues(null)).toThrow();
    expect(() => validateTissues([])).toThrow();
  });

  it('rejects a reviewedByOwner that is not true or false', () => {
    const data = goodTissues();
    data.reviewedByOwner = 'no';
    expect(() => validateTissues(data)).toThrow(/reviewedByOwner/);
  });
});
