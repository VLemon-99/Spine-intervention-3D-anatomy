import { describe, expect, it, vi } from 'vitest';
import { POSE_LIMITS, changePose, clampPose } from '../../src/carm/limits';
import { createStore } from '../../src/core/store';
import type { CArmPose } from '../../src/core/types';

const pose = (patch: Partial<CArmPose> = {}): CArmPose => ({
  oblique: 0,
  tilt: 0,
  tableLeftRight: 0,
  tableHeadFoot: 0,
  tableHeight: 0,
  ...patch,
});

describe('POSE_LIMITS (F3.1)', () => {
  it('has the ranges from the spec', () => {
    expect(POSE_LIMITS).toEqual({
      oblique: { min: -90, max: 90 },
      tilt: { min: -40, max: 40 },
      tableLeftRight: { min: -200, max: 200 },
      tableHeadFoot: { min: -400, max: 400 },
      tableHeight: { min: -150, max: 150 },
    });
  });
});

describe('clampPose (F3.1)', () => {
  it('returns values inside the ranges unchanged', () => {
    const inside = pose({ oblique: -45.5, tilt: 12, tableLeftRight: 199, tableHeadFoot: -400, tableHeight: 150 });
    expect(clampPose(inside)).toEqual(inside);
    expect(clampPose(pose())).toEqual(pose());
  });

  it('clamps each value at both ends', () => {
    expect(clampPose(pose({ oblique: 120 })).oblique).toBe(90);
    expect(clampPose(pose({ oblique: -91 })).oblique).toBe(-90);
    expect(clampPose(pose({ tilt: -55 })).tilt).toBe(-40);
    expect(clampPose(pose({ tilt: 41 })).tilt).toBe(40);
    expect(clampPose(pose({ tableLeftRight: 500 })).tableLeftRight).toBe(200);
    expect(clampPose(pose({ tableLeftRight: -201 })).tableLeftRight).toBe(-200);
    expect(clampPose(pose({ tableHeadFoot: -900 })).tableHeadFoot).toBe(-400);
    expect(clampPose(pose({ tableHeadFoot: 401 })).tableHeadFoot).toBe(400);
    expect(clampPose(pose({ tableHeight: 151 })).tableHeight).toBe(150);
    expect(clampPose(pose({ tableHeight: -1000 })).tableHeight).toBe(-150);
  });

  it('clamps only the value that is out of range', () => {
    expect(clampPose(pose({ oblique: 120, tilt: 10 }))).toEqual(pose({ oblique: 90, tilt: 10 }));
  });

  it('turns NaN and Infinity into 0', () => {
    expect(
      clampPose(
        pose({ oblique: NaN, tilt: Infinity, tableLeftRight: -Infinity, tableHeadFoot: NaN, tableHeight: Infinity }),
      ),
    ).toEqual(pose());
  });

  it('does not change the pose it is given', () => {
    const input = pose({ oblique: 120 });
    clampPose(input);
    expect(input.oblique).toBe(120);
  });
});

describe('changePose (store, F3.1)', () => {
  it('stores the clamped pose', () => {
    const store = createStore();
    changePose(store, { oblique: 120, tilt: -55, tableHeight: 20 });
    expect(store.get().pose).toEqual(pose({ oblique: 90, tilt: -40, tableHeight: 20 }));
  });

  it('keeps the values that are not in the patch', () => {
    const store = createStore();
    store.set({ pose: pose({ tilt: 7, tableHeadFoot: -30 }) });
    changePose(store, { oblique: 5 });
    expect(store.get().pose).toEqual(pose({ oblique: 5, tilt: 7, tableHeadFoot: -30 }));
  });

  it('stores a new pose object, so subscribers are told', () => {
    const store = createStore();
    const before = store.get().pose;
    const listener = vi.fn();
    store.subscribe(listener);
    changePose(store, { tilt: 3 });
    expect(store.get().pose).not.toBe(before);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].pose.tilt).toBe(3);
  });

  it('does not change other parts of the state', () => {
    const store = createStore();
    store.set({ shotCount: 4 });
    changePose(store, { oblique: 10 });
    expect(store.get().shotCount).toBe(4);
    expect(store.get().lastImagePose).toBeNull();
  });
});
