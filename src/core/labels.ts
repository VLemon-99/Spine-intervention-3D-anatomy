// Shared tissue labels and vertebral level codes.
//
// Every anatomy volume stores, for each voxel, an 8-bit tissue label id
// (0 = air) and optionally an 8-bit vertebral level id (0 = no level).
// These numbers are written into data files, so never renumber an existing
// entry — only add new ones.

/** Tissue label ids (8-bit). Air is 0. */
export const TISSUE = {
  air: 0,
  skinFat: 1,
  muscle: 2,
  corticalBone: 3,
  cancellousBone: 4,
  disc: 5,
  ligamentumFlavum: 6,
  epiduralSpace: 7,
  thecalSac: 8,
  spinalCord: 9,
  nerveRoot: 10,
  artery: 11,
  vein: 12,
  jointSpace: 13,
} as const;

export type TissueKey = keyof typeof TISSUE;
export type TissueId = (typeof TISSUE)[TissueKey];

export interface TissueLabel {
  /** 8-bit label id stored in the volume. */
  id: TissueId;
  /** Short id used in code and data files. */
  key: TissueKey;
  /** Name shown to the learner. */
  name: string;
}

/** Every tissue label with its display name, in id order. */
export const TISSUE_LABELS: readonly TissueLabel[] = [
  { id: TISSUE.air, key: 'air', name: 'Air' },
  { id: TISSUE.skinFat, key: 'skinFat', name: 'Skin and fat' },
  { id: TISSUE.muscle, key: 'muscle', name: 'Muscle' },
  { id: TISSUE.corticalBone, key: 'corticalBone', name: 'Cortical bone' },
  { id: TISSUE.cancellousBone, key: 'cancellousBone', name: 'Cancellous bone' },
  { id: TISSUE.disc, key: 'disc', name: 'Intervertebral disc' },
  { id: TISSUE.ligamentumFlavum, key: 'ligamentumFlavum', name: 'Ligamentum flavum' },
  { id: TISSUE.epiduralSpace, key: 'epiduralSpace', name: 'Epidural space' },
  { id: TISSUE.thecalSac, key: 'thecalSac', name: 'Thecal sac' },
  { id: TISSUE.spinalCord, key: 'spinalCord', name: 'Spinal cord' },
  { id: TISSUE.nerveRoot, key: 'nerveRoot', name: 'Nerve root' },
  { id: TISSUE.artery, key: 'artery', name: 'Artery' },
  { id: TISSUE.vein, key: 'vein', name: 'Vein' },
  { id: TISSUE.jointSpace, key: 'jointSpace', name: 'Joint space' },
];

/** True for cortical and cancellous bone only. */
export function isBone(label: number): boolean {
  return label === TISSUE.corticalBone || label === TISSUE.cancellousBone;
}

/** Vertebral level codes, from head to sacrum, then the ilium (for SI joints). */
export const LEVEL_CODES = [
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7',
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12',
  'L1', 'L2', 'L3', 'L4', 'L5',
  'sacrum', 'ilium',
] as const;

export type LevelCode = (typeof LEVEL_CODES)[number];

/** Level id stored in the level volume for voxels that belong to no level. */
export const NO_LEVEL = 0;

/** 8-bit level ids: C1 = 1 … L5 = 24, sacrum = 25, ilium = 26. */
export const LEVEL_IDS: Readonly<Record<LevelCode, number>> = Object.fromEntries(
  LEVEL_CODES.map((code, index) => [code, index + 1]),
) as Record<LevelCode, number>;

/** The level code for a level id, or undefined for 0 (no level) or an unknown id. */
export function levelCodeFromId(id: number): LevelCode | undefined {
  return Number.isInteger(id) && id >= 1 ? LEVEL_CODES[id - 1] : undefined;
}

/** Body sides. 'left' is the patient's left, which is +x in patient coordinates. */
export const SIDES = ['left', 'right'] as const;
export type Side = (typeof SIDES)[number];
