import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isBone, TISSUE } from '../../src/core/labels';
import { createPhantomLandmarks } from '../../src/core/phantom';
import { modelSoftTissue } from '../../tools/anatomy/softTissue';
import { expectMidlineOrder } from './softTissueChecks';
import { createStrippedPhantom } from './strippedPhantom';

describe('soft-tissue modeller: epidural space and ligamentum flavum', () => {
  const stripped = createStrippedPhantom();
  const modelled = modelSoftTissue(stripped, createPhantomLandmarks());

  it('the stripped phantom has no ligamentum flavum or epidural space to begin with', () => {
    expect(stripped.labels.includes(TISSUE.ligamentumFlavum)).toBe(false);
    expect(stripped.labels.includes(TISSUE.epiduralSpace)).toBe(false);
  });

  it('restores the midline order skin → muscle → ligamentum flavum → epidural space → thecal sac', () => {
    expectMidlineOrder(modelled);
  });

  it('changes no bone voxel and leaves the intensity volume unchanged', () => {
    for (let v = 0; v < stripped.labels.length; v++) {
      if (isBone(stripped.labels[v]) || isBone(modelled.labels[v])) expect(modelled.labels[v]).toBe(stripped.labels[v]);
    }
    expect(modelled.intensity).toEqual(stripped.intensity);
  });

  it('puts epidural space inside the canal only, close to the phantom’s own', () => {
    // Epidural voxels stay within the phantom's canal box |x| ≤ 9, −2 ≤ y ≤ 15, |z| ≤ 30.
    for (let v = 0; v < modelled.labels.length; v++) {
      if (modelled.labels[v] !== TISSUE.epiduralSpace) continue;
      const x = modelled.origin.x + (v % 95);
      const y = modelled.origin.y + (Math.floor(v / 95) % 95);
      const z = modelled.origin.z + Math.floor(v / (95 * 95));
      expect(Math.abs(x) <= 9 && y >= -2 && y <= 15 && Math.abs(z) <= 30, `${x},${y},${z}`).toBe(true);
    }
  });

  it('keeps reviewedByOwner false in soft-tissue-params.json', () => {
    const params = JSON.parse(readFileSync(new URL('../../tools/anatomy/soft-tissue-params.json', import.meta.url), 'utf8'));
    expect(params.reviewedByOwner).toBe(false);
  });

  it('gives the same result when run twice as when run once', () => {
    const twice = modelSoftTissue(modelled, createPhantomLandmarks());
    expect(Array.from(twice.labels)).toEqual(Array.from(modelled.labels));
  });
});
