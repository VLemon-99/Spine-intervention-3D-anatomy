// Shared types that cross zones. After F0 these change only in an interactive
// session with the owner, so keep them to what docs/SPEC.md needs.
//
// Conventions (docs/ARCHITECTURE.md → Conventions):
// - Coordinates are patient-based, in millimetres:
//     +x = patient's left, +y = toward the back (posterior), +z = toward the head.
//   The patient lies prone. The C-arm isocentre is the origin of the
//   table-relative frame.
// - Angles are in degrees in every public type and function.
// - Times are in seconds.

import type { LevelCode, Side } from './labels';

/** A point or direction in patient coordinates (mm). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A value for each side of the body ('left' = patient's left = +x). */
export interface Sided<T> {
  left: T;
  right: T;
}

/**
 * A 3D anatomy volume (F1.1, F1.3, F1.6).
 * Voxel (i, j, k) is stored at index i + size.x * (j + size.y * k).
 */
export interface Volume {
  /** Region name, e.g. 'lumbosacral' or 'phantom'. */
  region: string;
  /** Number of voxels along each voxel axis. */
  size: { x: number; y: number; z: number };
  /** Voxel spacing along each voxel axis, in mm (all positive). */
  spacing: Vec3;
  /** Patient position (mm) of the centre of voxel (0, 0, 0). */
  origin: Vec3;
  /**
   * Unit direction, in patient coordinates, of the voxel i, j and k axes
   * (in that order). Identity means i → +x, j → +y, k → +z.
   */
  orientation: [Vec3, Vec3, Vec3];
  /** 8-bit intensity per voxel (denser = higher). */
  intensity: Uint8Array;
  /** 8-bit tissue label id per voxel (see TISSUE in labels.ts; 0 = air). */
  labels: Uint8Array;
  /** Optional 8-bit vertebral level id per voxel (see LEVEL_IDS; 0 = no level). */
  levels?: Uint8Array;
}

/** An endplate: its centre and its tilt direction (unit normal, pointing away from the body). */
export interface Endplate {
  centre: Vec3;
  normal: Vec3;
}

/** Landmarks of one vertebral level (F1.5, F10.1, F11.2). All points in mm, patient coordinates. */
export interface LevelLandmarks {
  level: LevelCode;
  bodyCentre: Vec3;
  pedicleCentre: Sided<Vec3>;
  superiorEndplate: Endplate;
  inferiorEndplate: Endplate;
  superiorArticularProcessTip: Sided<Vec3>;
  /**
   * Foramen centres. A foramen is listed under the level ABOVE it, because in
   * the lumbar spine that level's nerve root exits there (the L4–L5 foramen is
   * listed under L4). This is how a nerve-contact event knows its level (F6.3).
   */
  foramenCentre?: Partial<Sided<Vec3>>;
}

/** Landmarks of a whole region, one entry per vertebral level. */
export interface Landmarks {
  region: string;
  levels: LevelLandmarks[];
}

/** App mode (F6.1, F8.5, F10.4, F12.2). */
export type Mode = 'practice' | 'exam' | 'quiz' | 'freeplay';

/**
 * C-arm and table position (F3.1).
 * - oblique: degrees, −90…+90. Positive = right: the detector (above the prone
 *   patient's back at 0°) swings toward the patient's right (−x).
 * - tilt: degrees, −40…+40. Positive = cranial: the detector tilts toward the
 *   head (+z) and the source toward the feet.
 * - Table offsets (mm) move the patient relative to the isocentre:
 *   tableLeftRight along x (+ = toward the patient's left), tableHeadFoot along
 *   z (+ = toward the head), tableHeight along y (+ = up, toward the back).
 */
export interface CArmPose {
  oblique: number;
  tilt: number;
  tableLeftRight: number;
  tableHeadFoot: number;
  tableHeight: number;
}

/** The needle's current state (F4, F5). */
export interface NeedleState {
  /** Id of the needle in the catalogue (src/needle/catalogue.json). */
  needleId: string;
  /** Pre-bend of the tip in degrees (0–30). */
  preBend: number;
  /** Skin entry point (the fulcrum), mm. */
  entryPoint: Vec3;
  /** Hub angles in degrees on two axes, relative to the direction at insertion (down the beam). */
  hubAngles: { pitch: number; yaw: number };
  /** Bevel direction in degrees (clock-face angle of the hub notch; 0 = 12 o'clock). */
  bevelAngle: number;
  /** Inserted length below the skin, mm. */
  insertedDepth: number;
  /** Points along the shaft from hub to tip, mm. */
  shaft: Vec3[];
  /** Tip position, mm (same as the last shaft point). */
  tip: Vec3;
}

/** Tissue event types (F6.2, F6.3, F9.6). */
export type TissueEventType =
  | 'lossOfResistance'
  | 'boneContact'
  | 'duralPuncture'
  | 'nerveContact'
  | 'intravascular'
  | 'cordContact'
  | 'injection';

/** Where injected contrast went (F9.2, F9.3). */
export type ContrastCompartment =
  | 'epidural'
  | 'intrathecal'
  | 'intraArticular'
  | 'softTissue'
  | 'intravascular';

/** Something that happened at the needle tip (F6.3, F9.6). */
export interface TissueEvent {
  type: TissueEventType;
  /** Simulation time in seconds. */
  time: number;
  /** Tip position when it happened, mm. */
  tip: Vec3;
  /** Text shown to the learner, e.g. "Paresthesia — left L5". */
  message: string;
  /** Vertebral level (nerve contact). */
  level?: LevelCode;
  /** Side (nerve contact). */
  side?: Side;
  /** Injected volume in mL (injection). */
  volumeMl?: number;
  /** Compartment the contrast went into (injection). */
  compartment?: ContrastCompartment;
}

interface AttemptRecordBase {
  mode: Mode;
  /** When the attempt finished, as an ISO 8601 date-time string. */
  date: string;
  /** Total score, 0–100. */
  totalScore: number;
  /** Points per score part, e.g. { views: 20, accuracy: 30 }. */
  scoreParts: Record<string, number>;
  /** True if a critical forbidden event happened (F10.3). */
  unsafe: boolean;
}

/** A finished procedure attempt (F10.5). */
export interface ProcedureAttemptRecord extends AttemptRecordBase {
  kind: 'procedure';
  procedureId: string;
  shots?: number;
  fluoroTimeSeconds?: number;
}

/** A finished quiz session (F11.4). */
export interface QuizAttemptRecord extends AttemptRecordBase {
  kind: 'quiz';
  procedureId?: never;
  shots?: never;
  fluoroTimeSeconds?: never;
}

/** One entry in the learner's history (F10.5, F11.4). */
export type AttemptRecord = ProcedureAttemptRecord | QuizAttemptRecord;
