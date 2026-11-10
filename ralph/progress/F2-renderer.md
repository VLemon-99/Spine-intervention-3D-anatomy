# Progress log — F2 Fluoroscopic image renderer

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- A slab for the absorption tests must be made of whole voxels: with 1 mm voxels use an EVEN number of voxels along the beam so an even thickness (10, 20, 40 mm) is exact. `slabVolume(thicknessMm)` in `tests/render/drrCpu.test.ts` does this (and has a different spacing per axis).
- For an exact central ray use the pixel position `{ x: 256, y: 256 }` with `transmissionAt`; pixel (255, 255)'s centre is half a pixel off it.
- A full 512×512 `renderDrrCpu` of the phantom takes about 1 second in Vitest, so a handful of whole images per test file is fine; use `transmissionAt` for single rays.
- The shader's loop limit comes from `MAX_MARCH_STEPS` in `pipeline.ts` (pasted into the shader text); the CPU march uses the same number.
- ESLint rejects unused parameters even with a leading underscore; use `void options;` for a parameter kept for later stories.
- Settings: change them with `renderSettings.set(patch)` (shared instance in `src/render/settings.ts`); shutters can be patched one at a time (`{ collimation: { left: 20 } }`). In screen tests use `setRenderSettings` / `getRenderInfo` from `tests/e2e/render/renderPage.ts`.
- `tests/render/settings.test.ts` checks that the default `noiseLevel` is 0 (F2-S2's own acceptance text, "0 for now"). F2-S13 changes that default on purpose, so that round must NOT quietly edit the test: its story text allows the screen tests to stay unedited (they read the defaults from the module), but the unit-test line is a human call — block or flag it as the rules require.
- CPU-vs-GPU comparison pattern: `tests/e2e/render/cpuMatch.spec.ts` (render the CPU image in the test process, `readWholeCanvas(page)`, compare `value × 255` with the grey values). With matching sampling the mean difference is about 0.05 grey levels and the worst pixel under 2 — a later story that lands near the 7.65 limit almost certainly has a real mismatch (wrong order of steps or an off-by-one pixel), not rounding.
- The canvas shows the shader's values as they are (no colour conversion): grey = round(value × 255).
- GPU drawing is two steps in `drrGpu.ts`: `take(volume, pose)` renders into the held off-screen image (a 512×512, 8-bit `WebGLRenderTarget`); `display(options)` draws it to the canvas with `texelFetch(uHeld, ivec2(gl_FragCoord.xy), 0)`, so held pixel = canvas pixel with no y-flip. Things that belong to TAKING the image (magnification, collimation, noise, contrast) go in the first shader; display settings (invert, flips, rotation) go in `displayFragmentShader` and in `DisplayOptions`.
- `fluoroCanvas.ts` re-runs `display()` on every settings change while an image is held, so a new display setting only has to be passed into `drr.display({...})`. Settings changes made with `setRenderSettings` are on the canvas as soon as the call returns (no waiting needed in tests).
- Whole-canvas comparisons in screen tests: `worstDifference(now, before, expected)` in `tests/e2e/render/invert.spec.ts` is a pattern to copy.

## Rounds
<!--
## Round — YYYY-MM-DD HH:MM — F1-S1 — done | failed | blocked
- What I did:
- Files touched:
- Test result:
- Next round should know:
-->

## Round — 2026-11-10 07:23 — F2-S1 — done
- What I did: Added `src/render/pipeline.ts` (the ORDER OF STEPS comment, `MARCH_STEP_MM`, `ABSORPTION_PER_MM`, and `MAX_MARCH_STEPS` = the shader's old fixed 4096) and `src/render/drrCpu.ts` (`renderDrrCpu`, `transmissionAt`, the identity-orientation check). `drrGpu.ts` now imports the numbers from `pipeline.ts` and re-exports the two it exported before; the shader itself is unchanged. Step 2 only, no extra volume yet.
- Files touched: `src/render/pipeline.ts` (new), `src/render/drrCpu.ts` (new), `src/render/drrGpu.ts`, `tests/render/drrCpu.test.ts` (new), this log, the task file.
- Test result: verify command passed (11 unit tests, 14 render screen tests). `npm run check` passed: lint + types clean, 94 unit tests, 46 screen tests passed and 6 skipped (the usual one-set-up-only tests).
- Next round should know: the CPU march copies the shader line for line (box clipping with the same 1e-8 nudge, samples at entry + (i + 0.5) × 0.5 mm, nearest voxel by `floor`, clamped to the grid). `DrrCpuOptions` is an empty interface for later stories to fill. The CPU-vs-GPU comparison has not been run yet — that is F2-S3.

## Round — 2026-11-10 13:06 — F2-S2 — done
- What I did: Added `src/render/settings.ts` (the `RenderSettings` type, defaults, `applySettingsPatch` validation, `createSettingsStore` and the shared `renderSettings`). `fluoroCanvas.ts` now remembers pose + settings copy + noise seed (image counter) for each exposure and registers the `render` debug getter, so `window.__sim.render()` returns `{ settings, lastImage }`. Added the helper `tests/e2e/render/renderPage.ts` (`setRenderSettings`, `getRenderInfo`). The settings do not change the picture yet.
- Files touched: `src/render/settings.ts` (new), `src/render/fluoroCanvas.ts`, `tests/render/settings.test.ts` (new), `tests/e2e/render/renderPage.ts` (new), `tests/e2e/render/settings.spec.ts` (new), this log, the task file.
- Test result: verify command passed (16 unit tests, 8 screen tests, production build has no '__sim'). `npm run check` passed: lint + types clean, 110 unit tests, 54 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: the image counter goes up on every `exposure` event, also when no volume is loaded. `createFluoroCanvas` takes the settings store as an optional 4th argument (default: the shared one). The GPU draw now uses `lastImage.pose`.

## Round — 2026-11-10 13:08 — F2-S3 — done
- What I did: Added the screen test for F2.2 (`cpuMatch.spec.ts`): three poses, noiseLevel 0, the whole 512×512 canvas compared with `renderDrrCpu` on the phantom. Added `readWholeCanvas(page)` to `renderPage.ts`. The two renderers already matched, so no renderer code changed.
- Files touched: `tests/e2e/render/cpuMatch.spec.ts` (new), `tests/e2e/render/renderPage.ts`, this log, the task file.
- Test result: verify command passed (6 new screen tests; all 28 render screen tests). `npm run check` passed: lint + types clean, 110 unit tests, 60 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: measured mean differences were 0.052 (default pose), 0.056 (oblique +30°/tilt +15°) and 0.054 (third pose) grey levels; worst single pixel 1.7. `readWholeCanvas` returns `{ width, height, data: Uint8Array }` with pixel (x, y) at x + 512 × y from the top.

## Round — 2026-11-10 13:12 — F2-S4 — done
- What I did: Split the GPU drawing into take (into a held off-screen image) and display (held image → canvas). Added invert to the display step and `options.invert` to `renderDrrCpu` / `transmissionAt`. `fluoroCanvas.ts` re-displays the held image whenever the settings change, with no new exposure.
- Files touched: `src/render/drrGpu.ts`, `src/render/fluoroCanvas.ts`, `src/render/drrCpu.ts`, `tests/render/drrCpu.test.ts` (3 tests added), `tests/e2e/render/invert.spec.ts` (new), this log, the task file.
- Test result: verify command passed (14 unit tests, 10 invert screen tests, all 38 render screen tests incl. the CPU match). `npm run check` passed: lint + types clean, 113 unit tests, 70 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: before the first image, and after an image taken with no volume loaded, nothing is held, so display settings do not repaint the canvas. The no-volume fill is not inverted (the story does not ask for it). No on-screen Invert button yet — that is F2-S5.
