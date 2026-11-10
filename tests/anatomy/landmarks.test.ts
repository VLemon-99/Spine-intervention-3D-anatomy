import { describe, expect, it } from 'vitest';
import { isBone, LEVEL_IDS, TISSUE } from '../../src/core/labels';
import { createPhantom, createPhantomLandmarks } from '../../src/core/phantom';
import type { Vec3, Volume } from '../../src/core/types';
import { computeLandmarks, computeRegionLandmarks, findBodyLandmarks, findLevelParts } from '../../tools/anatomy/landmarks';
import { createPelvisFixture, PELVIS_TRUTH } from './pelvisFixture';

const phantom = createPhantom();
const truth = createPhantomLandmarks();
const found = findBodyLandmarks(phantom);

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const angleDeg = (a: Vec3, b: Vec3) =>
  (Math.acos(Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z)))) * 180) /
  Math.PI;

const voxelAt = (vol: Volume, p: Vec3) => {
  const i = Math.round((p.x - vol.origin.x) / vol.spacing.x);
  const j = Math.round((p.y - vol.origin.y) / vol.spacing.y);
  const k = Math.round((p.z - vol.origin.z) / vol.spacing.z);
  return i + vol.size.x * (j + vol.size.y * k);
};

describe('findBodyLandmarks', () => {
  it('finds L4 and L5 on the phantom, head to foot', () => {
    expect(found.map((l) => l.level)).toEqual(['L4', 'L5']);
  });

  it('puts the L4 and L5 body centres within 3 mm of the phantom’s', () => {
    for (const level of ['L4', 'L5'] as const) {
      const got = found.find((l) => l.level === level)!;
      const want = truth.levels.find((l) => l.level === level)!;
      expect(dist(got.bodyCentre, want.bodyCentre), level).toBeLessThanOrEqual(3);
    }
  });

  it('puts each endplate centre within 3 mm and its direction within 10° of the phantom’s', () => {
    for (const level of ['L4', 'L5'] as const) {
      const got = found.find((l) => l.level === level)!;
      const want = truth.levels.find((l) => l.level === level)!;
      for (const plate of ['superiorEndplate', 'inferiorEndplate'] as const) {
        expect(dist(got[plate].centre, want[plate].centre), `${level} ${plate}`).toBeLessThanOrEqual(3);
        expect(angleDeg(got[plate].normal, want[plate].normal), `${level} ${plate}`).toBeLessThanOrEqual(10);
        expect(Math.hypot(got[plate].normal.x, got[plate].normal.y, got[plate].normal.z)).toBeCloseTo(1, 9);
      }
    }
  });

  it('has bone of the right level at every computed body centre', () => {
    for (const l of found) {
      const v = voxelAt(phantom, l.bodyCentre);
      expect(isBone(phantom.labels[v]), l.level).toBe(true);
      expect(phantom.levels![v], l.level).toBe(LEVEL_IDS[l.level]);
    }
  });

  it('follows a tilted endplate', () => {
    // A 30-voxel-wide box whose top face is sloped: top k = 20 + round(0.2 × j) → about 11° toward +y.
    const n = 40;
    const vol: Volume = {
      ...phantom,
      size: { x: n, y: n, z: n },
      origin: { x: 0, y: 0, z: 0 },
      labels: new Uint8Array(n ** 3),
      levels: new Uint8Array(n ** 3),
      intensity: new Uint8Array(n ** 3),
    };
    for (let k = 5; k < n; k++)
      for (let j = 5; j < 35; j++)
        for (let i = 5; i < 35; i++) {
          if (k > 20 + Math.round(0.2 * j)) continue;
          const v = i + n * (j + n * k);
          vol.labels[v] = TISSUE.cancellousBone;
          vol.levels![v] = LEVEL_IDS.T8;
        }
    const [t8] = findBodyLandmarks(vol);
    expect(t8.level).toBe('T8');
    const want = { x: 0, y: -0.2, z: 1 };
    expect(angleDeg(t8.superiorEndplate.normal, want)).toBeLessThanOrEqual(3);
    expect(t8.inferiorEndplate.normal.z).toBeCloseTo(-1, 6);
  });

  it('gives an empty list for a volume with no levels, and skips C1, C2, sacrum and ilium without error', () => {
    expect(findBodyLandmarks({ ...phantom, levels: new Uint8Array(phantom.labels.length) })).toEqual([]);
    expect(findBodyLandmarks({ ...phantom, levels: undefined })).toEqual([]);
    for (const skipped of ['C1', 'C2', 'sacrum', 'ilium'] as const) {
      const levels = phantom.levels!.map((l) => (l === LEVEL_IDS.L4 ? LEVEL_IDS[skipped] : l));
      const result = findBodyLandmarks({ ...phantom, levels });
      expect(result.map((l) => l.level), skipped).toEqual(['L5']);
    }
  });
});

describe('findLevelParts: pedicles and foramina', () => {
  const parts = findLevelParts(phantom);
  const get = (level: string) => parts.find((l) => l.level === level)!;

  it('puts the L4 and L5 pedicle centres, left and right, within 3 mm of the phantom’s', () => {
    for (const level of ['L4', 'L5'] as const) {
      const want = truth.levels.find((l) => l.level === level)!;
      for (const side of ['left', 'right'] as const) {
        expect(dist(get(level).pedicleCentre[side], want.pedicleCentre[side]), `${level} ${side}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('gives L4 a left and right foramen centre within 4 mm of the phantom’s, and L5 (lowest, no sacrum) none', () => {
    const want = truth.levels.find((l) => l.level === 'L4')!.foramenCentre!;
    for (const side of ['left', 'right'] as const) {
      expect(dist(get('L4').foramenCentre![side]!, want[side]!), side).toBeLessThanOrEqual(4);
    }
    expect(get('L5').foramenCentre).toBeUndefined();
  });

  it('gives left landmarks a larger x than right ones', () => {
    for (const l of parts) {
      expect(l.pedicleCentre.left.x).toBeGreaterThan(l.pedicleCentre.right.x);
      if (l.foramenCentre) expect(l.foramenCentre.left!.x).toBeGreaterThan(l.foramenCentre.right!.x);
    }
  });

  it('never puts a foramen centre in a bone voxel', () => {
    for (const l of parts)
      for (const p of Object.values(l.foramenCentre ?? {})) expect(isBone(phantom.labels[voxelAt(phantom, p!)])).toBe(false);
  });

  it('on the pelvis fixture gives L5 an L5–S1 foramen on each side, between L5’s pedicle and the sacrum top', () => {
    const pelvis = createPelvisFixture();
    const l5 = findLevelParts(pelvis).find((l) => l.level === 'L5')!;
    expect(l5).toBeDefined();
    for (const side of ['left', 'right'] as const) {
      const f = l5.foramenCentre?.[side];
      expect(f, side).toBeDefined();
      expect(f!.z).toBeLessThan(l5.pedicleCentre[side].z);
      expect(f!.z).toBeGreaterThan(PELVIS_TRUTH.sacrumTopBesideCanalZ);
      expect(dist(f!, PELVIS_TRUTH.l5.foramenCentre[side])).toBeLessThanOrEqual(4);
      expect(isBone(pelvis.labels[voxelAt(pelvis, f!)])).toBe(false);
      expect(dist(l5.pedicleCentre[side], PELVIS_TRUTH.l5.pedicleCentre[side])).toBeLessThanOrEqual(3);
    }
  });
});

describe('superior articular process tips and the whole Landmarks object', () => {
  const landmarks = computeLandmarks(phantom);

  it('puts the L4 and L5 superior articular process tips within 3 mm of the phantom’s', () => {
    for (const level of ['L4', 'L5'] as const) {
      const got = landmarks.levels.find((l) => l.level === level)!;
      const want = truth.levels.find((l) => l.level === level)!;
      for (const side of ['left', 'right'] as const) {
        expect(
          dist(got.superiorArticularProcessTip[side], want.superiorArticularProcessTip[side]),
          `${level} ${side}`,
        ).toBeLessThanOrEqual(3);
      }
    }
  });

  it('keeps every tip in or within 1.5 mm of a bone voxel of its own level', () => {
    for (const vol of [phantom, createPelvisFixture()]) {
      for (const l of computeLandmarks(vol).levels) {
        for (const side of ['left', 'right'] as const) {
          const p = l.superiorArticularProcessTip[side];
          let nearest = Infinity;
          for (let v = 0; v < vol.labels.length; v++) {
            if (vol.levels![v] !== LEVEL_IDS[l.level] || !isBone(vol.labels[v])) continue;
            const i = v % vol.size.x;
            const j = Math.floor(v / vol.size.x) % vol.size.y;
            const k = Math.floor(v / (vol.size.x * vol.size.y));
            const q = { x: vol.origin.x + i, y: vol.origin.y + j, z: vol.origin.z + k };
            nearest = Math.min(nearest, dist(p, q));
          }
          expect(nearest, `${vol.region} ${l.level} ${side}`).toBeLessThanOrEqual(1.5);
        }
      }
    }
  });

  it('gives the complete Landmarks object: region name, L4 then L5, and every required field', () => {
    expect(landmarks.region).toBe('phantom');
    expect(landmarks.levels.map((l) => l.level)).toEqual(['L4', 'L5']);
    const isVec = (p: unknown) =>
      typeof p === 'object' && p !== null && ['x', 'y', 'z'].every((a) => Number.isFinite((p as Record<string, number>)[a]));
    for (const l of landmarks.levels) {
      expect(isVec(l.bodyCentre)).toBe(true);
      expect(isVec(l.pedicleCentre.left) && isVec(l.pedicleCentre.right)).toBe(true);
      for (const plate of [l.superiorEndplate, l.inferiorEndplate]) expect(isVec(plate.centre) && isVec(plate.normal)).toBe(true);
      expect(isVec(l.superiorArticularProcessTip.left) && isVec(l.superiorArticularProcessTip.right)).toBe(true);
    }
    expect(landmarks.levels[0].foramenCentre).toBeDefined();
    expect(landmarks.levels[1].foramenCentre).toBeUndefined();
  });
});

describe('sacrum and iliac crest landmarks', () => {
  const pelvis = createPelvisFixture();
  const { landmarks, notes } = computeRegionLandmarks(pelvis);

  it('finds the S1 superior endplate within 3 mm and 10° of the fixture’s, pointing up as a unit vector', () => {
    const plate = landmarks.sacrum!.superiorEndplate;
    expect(dist(plate.centre, PELVIS_TRUTH.sacrum.superiorEndplate.centre)).toBeLessThanOrEqual(3);
    expect(angleDeg(plate.normal, PELVIS_TRUTH.sacrum.superiorEndplate.normal)).toBeLessThanOrEqual(10);
    expect(Math.hypot(plate.normal.x, plate.normal.y, plate.normal.z)).toBeCloseTo(1, 9);
    expect(plate.normal.z).toBeGreaterThan(0);
  });

  it('finds the S1 superior articular process tips within 3 mm, on or within 1.5 mm of sacrum bone', () => {
    for (const side of ['left', 'right'] as const) {
      const tip = landmarks.sacrum!.superiorArticularProcessTip[side];
      expect(dist(tip, PELVIS_TRUTH.sacrum.superiorArticularProcessTip[side]), side).toBeLessThanOrEqual(3);
      let nearest = Infinity;
      for (let v = 0; v < pelvis.labels.length; v++) {
        if (pelvis.levels![v] !== LEVEL_IDS.sacrum || !isBone(pelvis.labels[v])) continue;
        const q = {
          x: pelvis.origin.x + (v % pelvis.size.x),
          y: pelvis.origin.y + (Math.floor(v / pelvis.size.x) % pelvis.size.y),
          z: pelvis.origin.z + Math.floor(v / (pelvis.size.x * pelvis.size.y)),
        };
        nearest = Math.min(nearest, dist(tip, q));
      }
      expect(nearest, side).toBeLessThanOrEqual(1.5);
    }
  });

  it('finds the iliac crest points within 3 mm of the highest hip-bone points, left with the larger x', () => {
    for (const side of ['left', 'right'] as const) {
      expect(dist(landmarks.iliacCrest![side], PELVIS_TRUTH.iliacCrest[side]), side).toBeLessThanOrEqual(3);
    }
    expect(landmarks.iliacCrest!.left.x).toBeGreaterThan(landmarks.iliacCrest!.right.x);
    expect(notes).toEqual([]);
  });

  it('gives the phantom (no sacrum, no hip bones) neither a sacrum nor an iliacCrest field', () => {
    const result = computeRegionLandmarks(phantom);
    expect('sacrum' in result.landmarks).toBe(false);
    expect('iliacCrest' in result.landmarks).toBe(false);
    expect(result.notes).toEqual([]);
    expect('sacrum' in computeLandmarks(phantom)).toBe(false);
  });

  it('leaves the iliac crests out, and says so, when a hip bone touches the top edge of the volume', () => {
    const cut = computeRegionLandmarks(createPelvisFixture({ topZ: 18 }));
    expect('iliacCrest' in cut.landmarks).toBe(false);
    expect(cut.notes.join('\n')).toMatch(/left hip bone reaches the top edge.*cut off/);
    expect(cut.landmarks.sacrum).toBeDefined();
  });
});
