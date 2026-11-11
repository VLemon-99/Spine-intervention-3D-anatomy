// Needle physics model (F4). Pure functions: each returns a new model and never
// changes its input, so the same inputs always give the same path (F4.10).
// Plain TypeScript, no browser code.
//
// Hub frame (owner decision 2026-11-11): 12 o'clock ("up") = the patient's
// head (+z) made perpendicular to the insertion direction (+y, the back,
// when the needle points within 10° of the z axis); 3 o'clock ("right") =
// insertion direction × up. For a needle going straight into the prone
// patient's back, 3 o'clock is the patient's right (−x).
//
// The outside part of the needle lies on a straight line through the skin
// entry point (the fulcrum). Its direction, hub → fulcrum, is the insertion
// direction turned by `pitch` degrees toward 12 o'clock and `yaw` degrees
// toward 3 o'clock. The inserted part is the track: the points the tip has
// passed, from the entry point to the tip.

import type { NeedleState, Vec3, Volume } from '../core/types';
import { needleSpec, params } from './data';

export interface HubAngles {
  pitch: number;
  yaw: number;
}

export interface CreateNeedleInput {
  /** Catalogue id (src/needle/catalogue.json). */
  needleId: string;
  /** Skin entry point (the fulcrum), mm. */
  entryPoint: Vec3;
  /** Insertion direction (F5 passes the beam direction); need not be unit length. */
  direction: Vec3;
  /** Pre-bend of the tip in degrees. */
  preBend: number;
}

/** The model's internal state. Treat as read-only; use the functions below to change it. */
export interface NeedleModel {
  readonly needleId: string;
  readonly lengthMm: number;
  readonly preBend: number;
  readonly entryPoint: Vec3;
  /** Unit insertion direction at creation. */
  readonly insertionDir: Vec3;
  /** Unit 12 o'clock direction of the hub frame. */
  readonly up: Vec3;
  /** Unit 3 o'clock direction of the hub frame. */
  readonly right: Vec3;
  readonly hubAngles: HubAngles;
  readonly bevelAngle: number;
  /** Inserted length below the skin, mm (0 … lengthMm). */
  readonly depth: number;
  /** Inserted part: points from the entry point to the tip (always starts with the entry point). */
  readonly track: readonly Vec3[];
  /** Unit direction the tip moves in when advanced. */
  readonly tipDir: Vec3;
}

export interface AdvanceResult {
  state: NeedleModel;
  /** True when the tip is stopped against bone (F4.7). */
  boneContact: boolean;
}

// --- small vector helpers (mm) ---
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
function normalize(a: Vec3): Vec3 {
  const l = length(a);
  if (!(l > 0) || !Number.isFinite(l)) throw new Error('A needle direction must be a non-zero vector');
  return scale(a, 1 / l);
}
const copy = (a: Vec3): Vec3 => ({ x: a.x, y: a.y, z: a.z });
const DEG = Math.PI / 180;
/** A step this short (mm) or shorter counts as no movement. */
const EPS = 1e-9;

/** Rotates v by the rotation that takes unit vector `from` onto unit vector `to` (Rodrigues). */
function rotateBetween(v: Vec3, from: Vec3, to: Vec3): Vec3 {
  const axis = cross(from, to);
  const s = length(axis);
  const c = dot(from, to);
  if (s < 1e-15) return copy(v); // no change (a 180° flip cannot happen: hub angles stay well below 90°)
  const k = scale(axis, 1 / s);
  // v cosθ + (k × v) sinθ + k (k·v)(1 − cosθ)
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

/** Builds the hub frame for an insertion direction (see the top of this file). */
function hubFrame(insertionDir: Vec3): { up: Vec3; right: Vec3 } {
  const head: Vec3 = { x: 0, y: 0, z: 1 };
  const back: Vec3 = { x: 0, y: 1, z: 0 };
  const ref = Math.abs(dot(insertionDir, head)) > Math.cos(10 * DEG) ? back : head;
  const up = normalize(sub(ref, scale(insertionDir, dot(ref, insertionDir))));
  const right = normalize(cross(insertionDir, up));
  return { up, right };
}

/** Unit direction hub → fulcrum for the given hub angles. */
function hubDirection(model: Pick<NeedleModel, 'insertionDir' | 'up' | 'right'>, angles: HubAngles): Vec3 {
  const p = angles.pitch * DEG;
  const y = angles.yaw * DEG;
  return normalize(
    add(
      add(scale(model.insertionDir, Math.cos(p) * Math.cos(y)), scale(model.up, Math.sin(p))),
      scale(model.right, Math.cos(p) * Math.sin(y)),
    ),
  );
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A new needle whose tip sits at the entry point (depth 0), pointing along `direction`. */
export function createNeedle(input: CreateNeedleInput): NeedleModel {
  const spec = needleSpec(input.needleId);
  const insertionDir = normalize(input.direction);
  const { up, right } = hubFrame(insertionDir);
  return {
    needleId: spec.id,
    lengthMm: spec.lengthMm,
    preBend: finiteOr(input.preBend, 0),
    entryPoint: copy(input.entryPoint),
    insertionDir,
    up,
    right,
    hubAngles: { pitch: 0, yaw: 0 },
    bevelAngle: 0,
    depth: 0,
    track: [copy(input.entryPoint)],
    tipDir: insertionDir,
  };
}

/**
 * Sets the hub angles (degrees, relative to the insertion direction). The whole
 * needle pivots rigidly about the entry point, so the tip moves to the opposite
 * side of the hub (F4.2).
 */
export function setHubAngles(model: NeedleModel, angles: HubAngles): NeedleModel {
  const next: HubAngles = { pitch: finiteOr(angles.pitch, 0), yaw: finiteOr(angles.yaw, 0) };
  const from = hubDirection(model, model.hubAngles);
  const to = hubDirection(model, next);
  const entry = model.entryPoint;
  const track = model.track.map((p, i) => (i === 0 ? copy(entry) : add(entry, rotateBetween(sub(p, entry), from, to))));
  return { ...model, hubAngles: next, track, tipDir: normalize(rotateBetween(model.tipDir, from, to)) };
}

/**
 * Advances the tip by `mm` along its direction of travel, in steps of
 * params.stepMm. The depth never exceeds the needle's length (the hub stops at
 * the skin, F4.9).
 */
export function advance(model: NeedleModel, mm: number, volume: Volume): AdvanceResult {
  void volume; // tissue is looked up from the volume by later stories (bone stop, drift)
  let remaining = Math.max(0, finiteOr(mm, 0));
  let depth = model.depth;
  let tip = model.track[model.track.length - 1];
  const track = model.track.slice();
  const tipDir = model.tipDir;
  while (remaining > EPS) {
    const step = Math.min(params.stepMm, remaining, model.lengthMm - depth);
    if (step <= EPS) break;
    tip = add(tip, scale(tipDir, step));
    track.push(tip);
    depth += step;
    remaining -= step;
  }
  if (model.lengthMm - depth <= EPS) depth = model.lengthMm;
  return { state: { ...model, depth, track, tipDir }, boneContact: false };
}

/** Pulls the tip back `mm` along its own track; the depth never goes below 0. */
export function withdraw(model: NeedleModel, mm: number): NeedleModel {
  let remaining = Math.min(Math.max(0, finiteOr(mm, 0)), model.depth);
  const depth = model.depth - remaining <= EPS ? 0 : model.depth - remaining;
  const track = model.track.slice();
  while (remaining > EPS && track.length > 1) {
    const last = track[track.length - 1];
    const prev = track[track.length - 2];
    const segment = length(sub(last, prev));
    if (segment <= remaining + EPS) {
      track.pop();
      remaining -= segment;
    } else {
      track[track.length - 1] = add(prev, scale(sub(last, prev), (segment - remaining) / segment));
      remaining = 0;
    }
  }
  if (depth === 0) track.length = 1;
  const tipDir =
    track.length >= 2
      ? normalize(sub(track[track.length - 1], track[track.length - 2]))
      : hubDirection(model, model.hubAngles);
  return { ...model, depth, track, tipDir };
}

/** The shared NeedleState (src/core/types.ts): a fresh copy, safe to hand out. */
export function toNeedleState(model: NeedleModel): NeedleState {
  const hubDir = hubDirection(model, model.hubAngles);
  const hub = sub(model.entryPoint, scale(hubDir, model.lengthMm - model.depth));
  const shaft = [hub, ...model.track.map(copy)];
  return {
    needleId: model.needleId,
    preBend: model.preBend,
    entryPoint: copy(model.entryPoint),
    hubAngles: { ...model.hubAngles },
    bevelAngle: model.bevelAngle,
    insertedDepth: model.depth,
    shaft,
    tip: copy(shaft[shaft.length - 1]),
  };
}
