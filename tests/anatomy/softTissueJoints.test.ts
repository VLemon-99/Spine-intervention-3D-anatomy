import { describe, expect, it } from 'vitest';
import { isBone, TISSUE } from '../../src/core/labels';
import { createPhantomLandmarks } from '../../src/core/phantom';
import type { Volume } from '../../src/core/types';
import { loadSoftTissueParams, modelSoftTissue } from '../../tools/anatomy/softTissue';
import { createPelvisFixture, PELVIS_TRUTH } from './pelvisFixture';
import { createStrippedPhantom } from './strippedPhantom';

const params = loadSoftTissueParams();

function coords(vol: Volume, v: number) {
  const i = v % vol.size.x;
  const j = Math.floor(v / vol.size.x) % vol.size.y;
  const k = Math.floor(v / (vol.size.x * vol.size.y));
  return { i, j, k, x: vol.origin.x + i, y: vol.origin.y + j, z: vol.origin.z + k };
}

/** True if, along some axis or diagonal, opposite walks from v reach bone of two different levels within the width. */
function betweenTwoBones(before: Volume, v: number): boolean {
  const { i, j, k } = coords(before, v);
  const { x: nx, y: ny, z: nz } = before.size;
  for (let dk = -1; dk <= 1; dk++)
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0 && dk === 0) continue;
        const stepMm = Math.hypot(di, dj, dk);
        const walk = (sign: number) => {
          for (let n = 1; n * stepMm <= params.jointSpace.maxWidthMm + 1e-9 + stepMm; n++) {
            const [a, b, c] = [i + sign * n * di, j + sign * n * dj, k + sign * n * dk];
            if (a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz) return null;
            const w = a + nx * (b + ny * c);
            if (isBone(before.labels[w])) return { level: before.levels![w], n };
          }
          return null;
        };
        const p = walk(1);
        const q = walk(-1);
        if (p && q && p.level !== q.level && (p.n + q.n - 1) * stepMm <= params.jointSpace.maxWidthMm + 1e-9) return true;
      }
  return false;
}

describe('soft-tissue modeller: facet and SI joint spaces', () => {
  const stripped = createStrippedPhantom();
  const modelled = modelSoftTissue(stripped, createPhantomLandmarks());
  const joints = [...modelled.labels.keys()].filter((v) => modelled.labels[v] === TISSUE.jointSpace);

  it('adds joint space on both sides between the L4 and L5 articular pillars', () => {
    expect(stripped.labels.includes(TISSUE.jointSpace)).toBe(false);
    const inPillarGap = (side: number) =>
      joints.some((v) => {
        const p = coords(modelled, v);
        return Math.sign(p.x) === side && Math.abs(p.x) >= 12 && Math.abs(p.x) <= 18 && p.y >= 14 && p.y <= 22 && p.z === 0;
      });
    expect(inPillarGap(1)).toBe(true);
    expect(inPillarGap(-1)).toBe(true);
  });

  it('puts every joint-space voxel between two different bones within the set width', () => {
    expect(joints.length).toBeGreaterThan(0);
    for (const v of joints) expect(betweenTwoBones(stripped, v), JSON.stringify(coords(modelled, v))).toBe(true);
  });

  it('never turns the disc space between the two bodies into joint space', () => {
    for (const v of joints) {
      const p = coords(modelled, v);
      expect(Math.abs(p.x) <= 12 && p.y >= -22 && p.y <= -2 && Math.abs(p.z) <= 3).toBe(false);
    }
    for (let v = 0; v < stripped.labels.length; v++) {
      if (stripped.labels[v] === TISSUE.disc) expect(modelled.labels[v]).toBe(TISSUE.disc);
    }
  });

  it('on the pelvis fixture adds SI joint space between sacrum and ilium on both sides, and no other joint than L5–S1', () => {
    const pelvis = createPelvisFixture();
    const out = modelSoftTissue(pelvis);
    const { siGap } = PELVIS_TRUTH;
    const sides = new Set<number>();
    for (let v = 0; v < out.labels.length; v++) {
      if (out.labels[v] !== TISSUE.jointSpace) continue;
      const p = coords(out, v);
      // In the gap between ala and ilium; at its edges a diagonal gap may reach up to 2 mm past the box.
      const edge = 2;
      const inSi =
        Math.abs(p.x) >= siGap.absX[0] &&
        Math.abs(p.x) <= siGap.absX[1] &&
        p.y >= siGap.y[0] - edge &&
        p.y <= siGap.y[1] + edge &&
        p.z >= siGap.z[0] - edge &&
        p.z <= siGap.z[1] + edge;
      const inFacet = p.z === PELVIS_TRUTH.l5s1FacetGapZ && Math.abs(p.x) >= 12 && Math.abs(p.x) <= 18 && p.y >= 14 && p.y <= 22;
      expect(inSi || inFacet, JSON.stringify(p)).toBe(true);
      if (inSi) sides.add(Math.sign(p.x));
    }
    expect([...sides].sort()).toEqual([-1, 1]);
  });

  it('changes no bone voxel', () => {
    for (let v = 0; v < stripped.labels.length; v++) {
      if (isBone(stripped.labels[v]) || isBone(modelled.labels[v])) expect(modelled.labels[v]).toBe(stripped.labels[v]);
    }
  });
});
