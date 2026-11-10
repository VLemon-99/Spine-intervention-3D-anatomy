import { describe, expect, it } from 'vitest';
import { LEVEL_IDS, TISSUE } from '../../src/core/labels';
import type {
  AttemptRecord,
  CArmPose,
  Landmarks,
  Mode,
  NeedleState,
  TissueEvent,
  Volume,
} from '../../src/core/types';

// These examples must pass the type check (npm run typecheck); the runtime
// assertions only make sure the file runs.

const volume: Volume = {
  region: 'phantom',
  size: { x: 2, y: 2, z: 2 },
  spacing: { x: 1, y: 1, z: 1 },
  origin: { x: -0.5, y: -0.5, z: -0.5 },
  orientation: [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ],
  intensity: new Uint8Array(8),
  labels: new Uint8Array(8).fill(TISSUE.muscle),
  levels: new Uint8Array(8).fill(LEVEL_IDS.L4),
};

const landmarks: Landmarks = {
  region: 'phantom',
  levels: [
    {
      level: 'L4',
      bodyCentre: { x: 0, y: 0, z: 10 },
      pedicleCentre: { left: { x: 8, y: 12, z: 12 }, right: { x: -8, y: 12, z: 12 } },
      superiorEndplate: { centre: { x: 0, y: 0, z: 22 }, normal: { x: 0, y: 0, z: 1 } },
      inferiorEndplate: { centre: { x: 0, y: 0, z: -2 }, normal: { x: 0, y: 0, z: -1 } },
      superiorArticularProcessTip: { left: { x: 10, y: 25, z: 26 }, right: { x: -10, y: 25, z: 26 } },
      foramenCentre: { left: { x: 12, y: 14, z: -6 }, right: { x: -12, y: 14, z: -6 } },
    },
    {
      level: 'L5',
      bodyCentre: { x: 0, y: 0, z: -20 },
      pedicleCentre: { left: { x: 8, y: 12, z: -18 }, right: { x: -8, y: 12, z: -18 } },
      superiorEndplate: { centre: { x: 0, y: 0, z: -8 }, normal: { x: 0, y: 0, z: 1 } },
      inferiorEndplate: { centre: { x: 0, y: 0, z: -32 }, normal: { x: 0, y: 0, z: -1 } },
      superiorArticularProcessTip: { left: { x: 10, y: 25, z: -4 }, right: { x: -10, y: 25, z: -4 } },
    },
  ],
};

const mode: Mode = 'practice';

const pose: CArmPose = { oblique: 25, tilt: -10, tableLeftRight: 0, tableHeadFoot: 50, tableHeight: -20 };

const needle: NeedleState = {
  needleId: 'quincke-22g-89mm',
  preBend: 0,
  entryPoint: { x: 30, y: 60, z: 0 },
  hubAngles: { pitch: 5, yaw: -3 },
  bevelAngle: 0,
  insertedDepth: 10,
  shaft: [
    { x: 30, y: 70, z: 0 },
    { x: 30, y: 50, z: 0 },
  ],
  tip: { x: 30, y: 50, z: 0 },
};

const nerveEvent: TissueEvent = {
  type: 'nerveContact',
  time: 12.5,
  tip: { x: 12, y: 14, z: -6 },
  message: 'Paresthesia — left L4',
  level: 'L4',
  side: 'left',
};

const injectionEvent: TissueEvent = {
  type: 'injection',
  time: 30,
  tip: { x: 0, y: 20, z: 0 },
  message: 'Injected 0.5 mL',
  volumeMl: 0.5,
  compartment: 'epidural',
};

const procedureAttempt: AttemptRecord = {
  kind: 'procedure',
  procedureId: 'phantom-demo',
  mode: 'exam',
  date: '2026-11-09T07:00:00Z',
  totalScore: 92,
  scoreParts: { views: 20, accuracy: 30, contrast: 20, radiation: 12, safety: 10 },
  unsafe: false,
  shots: 14,
  fluoroTimeSeconds: 6.3,
};

const quizAttempt: AttemptRecord = {
  kind: 'quiz',
  mode: 'quiz',
  date: '2026-11-09T07:10:00Z',
  totalScore: 80,
  scoreParts: { correct: 8 },
  unsafe: false,
};

// The type check must reject values outside the allowed lists.
// @ts-expect-error 'tutorial' is not one of the four modes
const badMode: Mode = 'tutorial';
const badEvent: TissueEvent = {
  // @ts-expect-error 'needleBreak' is not one of the seven event types
  type: 'needleBreak',
  time: 0,
  tip: { x: 0, y: 0, z: 0 },
  message: '',
};
// @ts-expect-error quiz attempts have no shot count
const badQuiz: AttemptRecord = { kind: 'quiz', mode: 'quiz', date: '', totalScore: 0, scoreParts: {}, unsafe: false, shots: 1 };

describe('shared types', () => {
  it('builds one valid example of each type', () => {
    expect(volume.labels.length).toBe(volume.size.x * volume.size.y * volume.size.z);
    expect(landmarks.levels[0]?.foramenCentre?.left).toBeDefined();
    expect(mode).toBe('practice');
    expect(pose.oblique).toBe(25);
    expect(needle.shaft.at(-1)).toEqual(needle.tip);
    expect([nerveEvent.type, injectionEvent.type]).toEqual(['nerveContact', 'injection']);
    expect(procedureAttempt.kind === 'procedure' && procedureAttempt.shots).toBe(14);
    expect('shots' in quizAttempt).toBe(false);
    expect([badMode, badEvent.type, badQuiz.kind]).toHaveLength(3);
  });
});
