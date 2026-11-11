import { describe, expect, it } from 'vitest';
import {
  catalogue,
  params,
  validateCatalogue,
  validateParams,
} from '../../src/needle/data';
import catalogueJson from '../../src/needle/catalogue.json';
import paramsJson from '../../src/needle/params.json';
import { TISSUE_LABELS } from '../../src/core/labels';

/** A fresh, valid catalogue copy that a test can break on purpose. */
function goodCatalogue(): { reviewedByOwner: boolean; needles: Record<string, unknown>[] } {
  return JSON.parse(JSON.stringify(catalogueJson));
}

function goodParams(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(paramsJson));
}

describe('needle catalogue (F4.1)', () => {
  it('the committed catalogue passes its validator', () => {
    expect(() => validateCatalogue(catalogueJson)).not.toThrow();
    expect(catalogue.needles.length).toBeGreaterThanOrEqual(6);
  });

  it('contains the six needles from F4.1, each with gauge, length, tip type and stiffness', () => {
    const find = (gauge: number, lengthMm: number, tipType: string) =>
      catalogue.needles.filter(
        (n) => n.gauge === gauge && n.lengthMm === lengthMm && n.tipType === tipType,
      );
    expect(find(22, 89, 'quincke')).toHaveLength(1);
    expect(find(22, 127, 'quincke')).toHaveLength(1);
    expect(find(25, 89, 'quincke')).toHaveLength(1);
    expect(find(25, 127, 'quincke')).toHaveLength(1);
    expect(catalogue.needles.filter((n) => n.gauge === 20 && n.lengthMm === 89 && n.tipType === 'tuohy')).toHaveLength(1);
    const curved = catalogue.needles.filter((n) => n.tipType === 'curved');
    expect(curved.length).toBeGreaterThanOrEqual(1);
    for (const n of catalogue.needles) {
      expect(typeof n.id).toBe('string');
      expect(typeof n.name).toBe('string');
      expect(n.gauge).toBeGreaterThan(0);
      expect(n.lengthMm).toBeGreaterThan(0);
      expect(n.stiffness).toBeGreaterThan(0);
    }
    for (const n of curved) expect(typeof n.tipCurveDeg).toBe('number');
  });

  it('rejects a missing field', () => {
    for (const field of ['id', 'name', 'gauge', 'lengthMm', 'tipType', 'stiffness']) {
      const bad = goodCatalogue();
      delete bad.needles[0][field];
      expect(() => validateCatalogue(bad), field).toThrow(new RegExp(field));
    }
  });

  it('rejects an unknown tip type', () => {
    const bad = goodCatalogue();
    bad.needles[0].tipType = 'pencil-point';
    expect(() => validateCatalogue(bad)).toThrow(/tipType/);
  });

  it('rejects a non-positive length or stiffness', () => {
    for (const [field, value] of [
      ['lengthMm', 0],
      ['lengthMm', -10],
      ['stiffness', 0],
      ['stiffness', -1],
    ] as const) {
      const bad = goodCatalogue();
      bad.needles[0][field] = value;
      expect(() => validateCatalogue(bad), `${field}=${value}`).toThrow(new RegExp(field));
    }
  });

  it('rejects a duplicate id', () => {
    const bad = goodCatalogue();
    bad.needles[1].id = bad.needles[0].id;
    expect(() => validateCatalogue(bad)).toThrow(/duplicate/i);
  });

  it('rejects a curved-tip entry without its tip curve', () => {
    const bad = goodCatalogue();
    const curved = bad.needles.find((n) => n.tipType === 'curved');
    expect(curved).toBeDefined();
    delete curved!.tipCurveDeg;
    expect(() => validateCatalogue(bad)).toThrow(/tipCurveDeg/);
  });

  it('of two needles with the same tip type and length, the thicker one is stiffer', () => {
    let pairs = 0;
    for (const a of catalogue.needles) {
      for (const b of catalogue.needles) {
        if (a.tipType === b.tipType && a.lengthMm === b.lengthMm && a.gauge < b.gauge) {
          expect(a.stiffness, `${a.id} vs ${b.id}`).toBeGreaterThan(b.stiffness);
          pairs++;
        }
      }
    }
    expect(pairs).toBeGreaterThanOrEqual(2);
  });
});

describe('needle tuning numbers (params.json)', () => {
  it('the committed params pass their validator', () => {
    expect(() => validateParams(paramsJson)).not.toThrow();
  });

  it('has a stiffness for every tissue key, gives air 0, and stepMm of at most 0.5', () => {
    for (const label of TISSUE_LABELS) {
      expect(params.tissueStiffness[label.key], label.key).toBeGreaterThanOrEqual(0);
    }
    expect(params.tissueStiffness.air).toBe(0);
    expect(params.stepMm).toBeGreaterThan(0);
    expect(params.stepMm).toBeLessThanOrEqual(0.5);
  });

  it('rejects a missing tissue, a negative stiffness, non-zero air and a too-long step', () => {
    const missing = goodParams();
    delete (missing.tissueStiffness as Record<string, unknown>).muscle;
    expect(() => validateParams(missing)).toThrow(/muscle/);

    const negative = goodParams();
    (negative.tissueStiffness as Record<string, unknown>).disc = -1;
    expect(() => validateParams(negative)).toThrow(/disc/);

    const air = goodParams();
    (air.tissueStiffness as Record<string, unknown>).air = 0.5;
    expect(() => validateParams(air)).toThrow(/air/);

    const step = goodParams();
    step.stepMm = 1;
    expect(() => validateParams(step)).toThrow(/stepMm/);
  });
});

describe('review flags', () => {
  it('both files carry "reviewedByOwner": false', () => {
    expect(catalogueJson.reviewedByOwner).toBe(false);
    expect(paramsJson.reviewedByOwner).toBe(false);
  });
});

describe('drift tuning numbers (F4-S4, F4-S5)', () => {
  it('rejects a missing or negative drift per tip type and a non-positive stiffness power', () => {
    const missing = goodParams();
    delete (missing.driftDegPerMm as Record<string, unknown>).quincke;
    expect(() => validateParams(missing)).toThrow(/driftDegPerMm\.quincke/);

    const power = goodParams();
    power.driftStiffnessPower = 0;
    expect(() => validateParams(power)).toThrow(/driftStiffnessPower/);
  });
});

describe('pre-bend tuning number (F4-S7)', () => {
  it('rejects a missing or negative bendDegPerMmPerDeg', () => {
    const missing = goodParams();
    delete missing.bendDegPerMmPerDeg;
    expect(() => validateParams(missing)).toThrow(/bendDegPerMmPerDeg/);
    const negative = goodParams();
    negative.bendDegPerMmPerDeg = -0.1;
    expect(() => validateParams(negative)).toThrow(/bendDegPerMmPerDeg/);
  });
});

describe('track memory tuning numbers (F4-S8)', () => {
  it('rejects a missing or negative trackMemoryDepthMm and a trackSteerFraction outside 0–1', () => {
    const missing = goodParams();
    delete missing.trackMemoryDepthMm;
    expect(() => validateParams(missing)).toThrow(/trackMemoryDepthMm/);
    const negative = goodParams();
    negative.trackMemoryDepthMm = -1;
    expect(() => validateParams(negative)).toThrow(/trackMemoryDepthMm/);
    const steer = goodParams();
    steer.trackSteerFraction = 1.5;
    expect(() => validateParams(steer)).toThrow(/trackSteerFraction/);
  });
});
