import { describe, expect, it, vi } from 'vitest';
import {
  applySettingsPatch,
  createSettingsStore,
  defaultRenderSettings,
  renderSettings,
  type RenderSettings,
  type RenderSettingsPatch,
} from '../../src/render/settings';

const DEFAULTS: RenderSettings = {
  invert: false,
  magnification: 1,
  collimation: { left: 0, right: 0, top: 0, bottom: 0 },
  noiseLevel: 0,
  flipHorizontal: false,
  flipVertical: false,
  rotation: 0,
};

/** A patch with values the type does not allow (as a careless caller could send). */
const loose = (patch: unknown): RenderSettingsPatch => patch as RenderSettingsPatch;

describe('default render settings', () => {
  it('are: not inverted, 1×, shutters open, noise 0, no flips, rotation 0', () => {
    expect(defaultRenderSettings()).toEqual(DEFAULTS);
  });

  it('are a fresh object each time', () => {
    const a = defaultRenderSettings();
    a.collimation.left = 30;
    expect(defaultRenderSettings()).toEqual(DEFAULTS);
  });

  it('are what the shared store starts with', () => {
    expect(renderSettings.get()).toEqual(DEFAULTS);
  });
});

describe('applySettingsPatch', () => {
  it('applies valid values', () => {
    const next = applySettingsPatch(defaultRenderSettings(), {
      invert: true,
      magnification: 1.5,
      collimation: { left: 20, top: 30 },
      noiseLevel: 0.25,
      flipHorizontal: true,
      flipVertical: true,
      rotation: 270,
    });
    expect(next).toEqual({
      invert: true,
      magnification: 1.5,
      collimation: { left: 20, right: 0, top: 30, bottom: 0 },
      noiseLevel: 0.25,
      flipHorizontal: true,
      flipVertical: true,
      rotation: 270,
    });
  });

  it('does not change the settings it was given', () => {
    const current = defaultRenderSettings();
    applySettingsPatch(current, { invert: true, collimation: { left: 10 } });
    expect(current).toEqual(DEFAULTS);
  });

  it('clamps each collimation value to 0–50', () => {
    for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
      expect(applySettingsPatch(defaultRenderSettings(), { collimation: { [edge]: 80 } }).collimation[edge]).toBe(50);
      const start = applySettingsPatch(defaultRenderSettings(), { collimation: { [edge]: 25 } });
      expect(start.collimation[edge]).toBe(25);
      expect(applySettingsPatch(start, { collimation: { [edge]: -5 } }).collimation[edge]).toBe(0);
    }
  });

  it('clamps noiseLevel to 0–1', () => {
    expect(applySettingsPatch(defaultRenderSettings(), { noiseLevel: 3 }).noiseLevel).toBe(1);
    const half = applySettingsPatch(defaultRenderSettings(), { noiseLevel: 0.5 });
    expect(applySettingsPatch(half, { noiseLevel: -2 }).noiseLevel).toBe(0);
  });

  it('ignores NaN and Infinity', () => {
    const start = applySettingsPatch(defaultRenderSettings(), {
      noiseLevel: 0.5,
      collimation: { left: 10, right: 11, top: 12, bottom: 13 },
    });
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(applySettingsPatch(start, { noiseLevel: bad })).toEqual(start);
      for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
        expect(applySettingsPatch(start, { collimation: { [edge]: bad } })).toEqual(start);
      }
      expect(applySettingsPatch(start, loose({ magnification: bad }))).toEqual(start);
      expect(applySettingsPatch(start, loose({ rotation: bad }))).toEqual(start);
    }
  });

  it('ignores a magnification other than 1, 1.5 or 2', () => {
    const start = applySettingsPatch(defaultRenderSettings(), { magnification: 1.5 });
    for (const bad of [0, 1.25, 3, -1, '2', null]) {
      expect(applySettingsPatch(start, loose({ magnification: bad })).magnification).toBe(1.5);
    }
    for (const good of [1, 1.5, 2] as const) {
      expect(applySettingsPatch(start, { magnification: good }).magnification).toBe(good);
    }
  });

  it('ignores a rotation other than 0, 90, 180 or 270', () => {
    const start = applySettingsPatch(defaultRenderSettings(), { rotation: 90 });
    for (const bad of [45, 360, -90, 91, '180', null]) {
      expect(applySettingsPatch(start, loose({ rotation: bad })).rotation).toBe(90);
    }
    for (const good of [0, 90, 180, 270] as const) {
      expect(applySettingsPatch(start, { rotation: good }).rotation).toBe(good);
    }
  });

  it('ignores on/off values that are not true or false, and unknown names', () => {
    const start = defaultRenderSettings();
    expect(
      applySettingsPatch(
        start,
        loose({ invert: 'yes', flipHorizontal: 1, flipVertical: null, collimation: 'open', surprise: 5 }),
      ),
    ).toEqual(DEFAULTS);
  });

  it('a bad value does not stop the good values in the same patch', () => {
    const next = applySettingsPatch(defaultRenderSettings(), loose({ magnification: 7, invert: true }));
    expect(next.magnification).toBe(1);
    expect(next.invert).toBe(true);
  });
});

describe('settings store', () => {
  it('starts with the defaults and reports changes through get()', () => {
    const settings = createSettingsStore();
    expect(settings.get()).toEqual(DEFAULTS);
    settings.set({ magnification: 2, collimation: { bottom: 15 } });
    expect(settings.get().magnification).toBe(2);
    expect(settings.get().collimation).toEqual({ left: 0, right: 0, top: 0, bottom: 15 });
  });

  it('calls subscribers once per real change and not when nothing changed', () => {
    const settings = createSettingsStore();
    const listener = vi.fn();
    settings.subscribe(listener);

    settings.set({ invert: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(settings.get());

    settings.set({ invert: true }); // same value
    settings.set({}); // nothing
    settings.set({ collimation: { left: 0 } }); // same value
    settings.set(loose({ magnification: 4 })); // ignored value
    settings.set({ noiseLevel: Number.NaN }); // ignored value
    settings.set({ collimation: { left: -10 } }); // clamped to 0 = no change
    expect(listener).toHaveBeenCalledTimes(1);

    settings.set({ magnification: 2, rotation: 90 }); // two fields, one call
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops calling a subscriber after it unsubscribes', () => {
    const settings = createSettingsStore();
    const listener = vi.fn();
    const unsubscribe = settings.subscribe(listener);
    unsubscribe();
    settings.set({ invert: true });
    expect(listener).not.toHaveBeenCalled();
  });

  it('separate stores do not share settings', () => {
    const a = createSettingsStore();
    const b = createSettingsStore();
    a.set({ invert: true });
    expect(b.get().invert).toBe(false);
  });
});
