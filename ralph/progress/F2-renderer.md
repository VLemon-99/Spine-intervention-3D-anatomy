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
- Fluoro panel layout: `src/render/index.ts` has a row (`body`) with the picture on the left and `createControls` (`src/render/controls.ts`, test id `fluoro-controls`) as a wrapping column on the right. New buttons go into that column; `createToggle(...)` builds an on/off button that follows the settings. On the tablet the panel is about 500×370 px and the picture about 325 px square, so roughly 110 px of width is free for controls before the picture starts to shrink.
- Screen-test helpers for controls in `tests/e2e/render/renderPage.ts`: `press(page, testId)` (click on desktop, tap on tablet) and `expectOnScreen(page, locator)` (inside the window with the page not scrolled; returns the box for the 44 px check).
- To look at the layout, a throwaway spec with `page.screenshot(...)` into the scratchpad works (delete the spec afterwards); never start the dev server by hand.
- Magnification: `detectorPosition(pixel, m)` in `pipeline.ts` is step 1. A patient point appears at image pixel `centre + (project(point) − centre) × m`. `bodyWidth(pose, m)` in `tests/render/magnification.test.ts` measures the upper vertebra body's dark band along its row with 512 single rays (fast) — the same idea works on a canvas row for the GPU stories.
- Pose (0°, 0°): the source is under the table, so a NEGATIVE `tableHeight` moves the anatomy closer to the source (larger picture).
- Settings for TAKING the image reach the shader through `drr.take(volume, pose, options)` (`TakeOptions` in `drrGpu.ts`); `fluoroCanvas.ts` passes values from `lastImage.settings` (the copy made at the exposure), never from the live settings. Add collimation, noise and contrast the same way.
- Comparison helpers in `tests/e2e/render/renderPage.ts`: `meanDifference(canvas, reference)`, `MAX_MEAN_DIFFERENCE`, `samePixels(a, b)`. In a match test also check that the reference with the setting differs from the plain reference by more than the limit, so a GPU that ignores the setting cannot pass.
- The controls column is now about 140 px wide (the row of three 44 px magnification buttons). A group of buttons in a row: a `<div role="group">` with `display: flex` inside the column. `bodyWidthOnCanvas(page, m)` in `tests/e2e/render/magnificationButtons.spec.ts` measures a structure's width on the canvas.
- Collimation rule: `isCollimated(x, y, collimation)` in `pipeline.ts` (whole pixel numbers). A pixel is covered when its distance from an edge, in pixels, is less than percent / 100 × 512. For `{ left: 20, right: 10, top: 30, bottom: 0 }` the open rectangle is columns 103…459 and rows 154…511. In the shader use the same test on `floor(gl_FragCoord)`-style whole pixel numbers BEFORE the magnification step changes px/py.
- Invert after collimation: inverted covered pixels are 1 − NO_SIGNAL = white, still perfectly uniform.
- GPU collimation: the shutter widths are worked out in TypeScript (percent / 100 × 512, the same sum as `isCollimated`) and sent as pixels in `uShutterPx`; the shader tests whole pixel numbers and returns `uNoSignal` early, before any marching. Later steps of taking the image (noise) must stay AFTER that early return so covered pixels get none.
- ESLint (`no-useless-assignment`) rejects `let { a, b } = …` when one of them is re-assigned but not read again; use two separately named results instead.
- Controls column: fixed 140 px wide, 4 px gaps. Rows so far: Invert, the magnification row, the Collimation button, and (when open) the 2×2 slider group (about 120 px high). On the tablet about 325 px of height is available: with the group open about 264 px is used, so ONE more 44 px row fits while it is open. F2-S16's three buttons should share one row (three 44 px buttons, like the magnification row) rather than take three rows.
- Sliders: Playwright's `click`/`tap` with `{ position }` on an `<input type="range">` moves it in both set-ups (`pressTrack` in `collimationSliders.spec.ts`). Screen tests of the sliders must first open the group with `press(page, 'collimation-toggle')`.
- Noise rule (step 3): value + g × 2 × `NOISE_AMPLITUDE` × level, clamped to 0…1, where g is evenly spread over −0.5…0.5 with mean 0 (`addNoise` / `grainAt` in `src/render/noise.ts`). The shader needs its own seeded g with the same range and the same scaling; at the shot default (0.04) that is at most ±2.5 grey levels, standard deviation about 1.5.
- Vitest's default time limit is 5 s per test: more than about five whole 512×512 CPU images in ONE test needs a longer limit as the test's last argument (e.g. `30_000`), or fewer images.
- In the uniform-slab image the middle 100×100 pixels are exactly equal without noise (standard deviation exactly 0), so spread tests can use `toBe(0)`.
- When writing a note into the task file with a script, load the file as JSON afterwards BEFORE committing (`python3 -c "import json; json.load(open('ralph/tasks/F2-renderer.json'))"`), and chain the commit with `&&` so it cannot run after a failed step.
- Orientation: `orientPixel(pixel, orientation)` says where a pixel of the image as taken is SHOWN; `unorientPixel` is the opposite (which taken pixel is shown at a canvas pixel — what the GPU display shader needs). Both in `src/render/orientation.ts`; `ROTATIONS` / `Rotation` live there too (settings.ts re-exports them).
- Image directions at pose (0°, 0°): the patient's LEFT (+x) is on the LEFT half of the image (x < 256), the head (+z) at the top. A small blob's shadow has only a few different values, so follow a whole image (`expectMoved` in `tests/render/orientation.test.ts`), not one "unique" pixel.
- The "mean difference ≤ 3% (7.65 grey levels)" limit is LOOSE on the phantom, because most of the picture is air: a picture with the wrong orientation is only about 7.5 off, with the wrong magnification or shutters somewhat more. A correct GPU image is about 0.05 off. So in every CPU-match test also demand something stricter (e.g. the canvas at least four times closer than the wrong picture would be), and use exact pixel checks where possible.
- For orientation tests use a pose whose picture is not symmetric (e.g. oblique 30, tilt 15, tableLeftRight 20, tableHeadFoot −15); at the default pose the phantom is nearly left-right symmetric and a missing flip could go unnoticed.
- Controls column rows are now: [Invert | Rotate], [1× | 1.5× | 2×], [Flip ↔ | Flip ↕], [Collimation], and the slider group when open. `row(label, ...buttons)` in `createControls` builds a row of equal-width buttons. With the slider group open this fills the tablet panel's height almost completely — any further control needs a different place (F12 owns the final layout).

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

## Round — 2026-11-10 13:15 — F2-S5 — done
- What I did: Added the Invert button (`invert-toggle`, a `<button>` with `aria-pressed`) in a new controls column beside the canvas. It flips `settings.invert` and follows the setting when it changes elsewhere.
- Files touched: `src/render/controls.ts` (new), `src/render/index.ts`, `tests/e2e/render/invertToggle.spec.ts` (new), `tests/e2e/render/renderPage.ts` (helpers `press`, `expectOnScreen`), this log, the task file.
- Test result: verify command passed (8 screen tests). `npm run check` passed: lint + types clean, 113 unit tests, 78 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: the button is 64×44 px minimum. Its test also checks that the picture stays at least 200 px and that the button does not lie on top of it — later control stories should keep that true (the collimation sliders will probably need the fold-out group).

## Round — 2026-11-10 13:18 — F2-S6 — done
- What I did: Added `options.magnification` (1, 1.5 or 2; anything else throws) to `renderDrrCpu` and `transmissionAt`, as step 1: `detectorPosition(pixel, m)` in `pipeline.ts`. Moved the list `MAGNIFICATIONS` and the `Magnification` type into `pipeline.ts` (settings.ts re-exports them) so there is one list.
- Files touched: `src/render/pipeline.ts`, `src/render/drrCpu.ts`, `src/render/settings.ts`, `tests/render/magnification.test.ts` (new), this log, the task file.
- Test result: verify command passed (6 unit tests). `npm run check` passed: lint + types clean, 119 unit tests, 78 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: the GPU image does not use magnification yet (F2-S7): add a uniform and apply the same formula to the pixel position before building the ray, in the shader that TAKES the image.

## Round — 2026-11-10 13:21 — F2-S7 — done
- What I did: The shader that takes the image now applies magnification (uniform `uMagnification`, same formula as the CPU reference) and `fluoroCanvas.ts` passes the magnification remembered for that exposure. Changing the setting leaves the held image alone; it shows on the next image.
- Files touched: `src/render/drrGpu.ts`, `src/render/fluoroCanvas.ts`, `tests/e2e/render/magnification.spec.ts` (new), `tests/e2e/render/renderPage.ts` (comparison helpers), this log, the task file.
- Test result: verify command passed (6 new screen tests; all 60 render screen tests). `npm run check` passed: lint + types clean, 119 unit tests, 84 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: no magnification buttons yet (F2-S8) — they go into the controls column from F2-S5.

## Round — 2026-11-10 13:24 — F2-S8 — done
- What I did: Added the 1×, 1.5× and 2× buttons (`magnification-1x`, `magnification-1.5x`, `magnification-2x`; `<button>` with `aria-pressed`, the one in use pressed) as a row in the controls column. They set `settings.magnification` and follow the setting when it changes elsewhere.
- Files touched: `src/render/controls.ts`, `tests/e2e/render/magnificationButtons.spec.ts` (new), this log, the task file.
- Test result: verify command passed (8 screen tests). `npm run check` passed: lint + types clean, 119 unit tests, 92 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: column height used so far is two rows (about 94 px of roughly 325 px on the tablet). The layout tests of F2-S5 and F2-S8 require the picture to stay at least 200 px wide and no button to lie on it.

## Round — 2026-11-10 13:28 — F2-S9 — done
- What I did: Added `options.collimation` to `renderDrrCpu` / `transmissionAt` (step 4): covered pixels get `NO_SIGNAL` (0, in `pipeline.ts`) and are not ray-marched; values outside 0–50 or non-finite throw. `isCollimated` and the `Collimation` type live in `pipeline.ts` (settings.ts re-exports the type).
- Files touched: `src/render/pipeline.ts`, `src/render/drrCpu.ts`, `src/render/settings.ts`, `tests/render/collimation.test.ts` (new), this log, the task file.
- Test result: verify command passed (8 unit tests). `npm run check` passed: lint + types clean, 127 unit tests, 92 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: the GPU image does not collimate yet (F2-S10). Proposal for the owner (not decided): with Invert on, the covered area is white because Invert comes after collimation in the documented order of steps.

## Round — 2026-11-10 13:33 — F2-S10 — done
- What I did: The shader that takes the image now applies the four shutters exactly as the CPU reference does (covered pixels = `NO_SIGNAL`, decided before the ray is marched). `fluoroCanvas.ts` passes the shutters remembered for the exposure, so changing them shows on the next image only.
- Files touched: `src/render/drrGpu.ts`, `src/render/fluoroCanvas.ts`, `tests/e2e/render/collimation.spec.ts` (new), this log, the task file.
- Test result: verify command passed (10 new screen tests; all 78 render screen tests). First `npm run check` failed on one lint error in the new test file (an unused re-assignment); fixed, then it passed: lint + types clean, 127 unit tests, 102 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: no sliders yet (F2-S11). `coveredAndOpen(canvas)` in `collimation.spec.ts` shows how to check that covered pixels have one single value.

## Round — 2026-11-10 13:37 — F2-S11 — done
- What I did: Added the four collimation sliders (`collimation-left/right/top/bottom`, 0–50, step 1) with % readouts (`collimation-…-readout`) in a fold-out group opened by a new Collimation button (`collimation-toggle`, `aria-expanded`). Moving a slider sets that shutter (shown from the next image); sliders and readouts follow the settings when they change elsewhere.
- Files touched: `src/render/controls.ts`, `tests/e2e/render/collimationSliders.spec.ts` (new), this log, the task file.
- Test result: verify command passed (12 screen tests). `npm run check` passed: lint + types clean, 127 unit tests, 114 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: the group is closed after page load. Each slider's `<input>` box is 67×44 px on the tablet.

## Round — 2026-11-10 13:41 — F2-S12 — done
- What I did: Added `src/render/noise.ts` (`grainAt`, `addNoise`) and `options.noise { seed, level }` to `renderDrrCpu` / `transmissionAt` as step 3 (collimated pixels get none; bad seed or level throws). Added `NOISE_AMPLITUDE`, `DEFAULT_NOISE_LEVEL = { shot: 0.04, fluoro: 0.1 }` and `defaultNoiseLevel(kind)` to `pipeline.ts`. The CPU grain takes its numbers from `src/core/random.ts` (read only).
- Files touched: `src/render/noise.ts` (new), `src/render/pipeline.ts`, `src/render/drrCpu.ts`, `tests/render/noise.test.ts` (new), this log, the task file.
- Test result: verify command passed (11 unit tests) after I cut one of my new tests from 12 whole images to 6 and gave it a 30 s limit (it had timed out at 5 s; nothing was wrong with the values). `npm run check` passed: lint + types clean, 138 unit tests, 114 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: the default `settings.noiseLevel` is still 0 and the GPU has no grain yet (F2-S13). See the Lessons entry about `tests/render/settings.test.ts` before changing that default.

## Round — 2026-11-10 13:43 — F2-S13 — blocked
- What I did: Ran the baseline (green) and picked F2-S13. Before writing code I checked the conflict noted in Lessons: the story changes the default `settings.noiseLevel` from 0 to the shot default, but the existing unit test `tests/render/settings.test.ts` (from F2-S2, acceptance text "noiseLevel 0 for now") checks that the default is exactly 0. A loop round may not edit an existing test to make it pass, and there is no honest way to meet both (starting the app at the shot level while leaving `defaultRenderSettings()` at 0 would break the F2-S2 screen test that compares the two, and would dodge the story's wording). So I blocked the story without writing code.
- Files touched: this log, the task file (status `blocked`, notes say exactly what the owner needs to decide).
- Test result: baseline `npm run check` passed: 138 unit tests, 114 screen tests passed and 6 skipped. No code changed.
- Mistake this round: my first commit of the blocked status (5th commit from the top at the time, "F2-S13: blocked …") contained a task file that was not valid JSON (a stray backslash in the note) and no log entry, because the script failed halfway and the commit still ran. Fixed in the next commit; no code or test was affected.
- Next round should know: F2-S21 and F2-S20 depend on F2-S13 and cannot start until it is unblocked. Still open and not affected: F2-S14, S15, S16, S17, S18, S19. When F2-S13 is unblocked, the plan is: one uniform `uNoiseLevel` and one `uNoiseSeed` in the shader that takes the image, a seeded hash giving g in −0.5…0.5, value + g × 2 × NOISE_AMPLITUDE × level clamped to 0…1, placed after the collimation early return; `fluoroCanvas.ts` passes `lastImage.settings.noiseLevel` and `lastImage.noiseSeed`.

## Round — 2026-11-10 17:01 — F2-S14 — done
- What I did: Added `src/render/orientation.ts` (`orientPixel`, `unorientPixel`, `ROTATIONS`) and `options.flipHorizontal`, `options.flipVertical`, `options.rotation` to `renderDrrCpu` / `transmissionAt` as step 6 (flips first, then the clockwise rotation; a bad rotation throws).
- Files touched: `src/render/orientation.ts` (new), `src/render/drrCpu.ts`, `src/render/settings.ts` (re-exports the rotation list), `tests/render/orientation.test.ts` (new), this log, the task file.
- Test result: verify command passed (15 unit tests) after correcting two mistakes in my own new test (it looked for a pixel with a unique value, which the spot does not have, and expected the spot on the wrong half of the image). `npm run check` passed: lint + types clean, 153 unit tests, 114 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: the GPU display step does not flip or rotate yet (F2-S15): add the three settings to `DisplayOptions` and, in `displayFragmentShader`, look up the held pixel that `unorientPixel` gives for the canvas pixel (canvas row from the top = 511 − floor(gl_FragCoord.y); the held image is stored bottom row first). The worker was restarted in the middle of this round; nothing was lost.

## Round — 2026-11-10 17:06 — F2-S15 — done
- What I did: The GPU display step now applies flip left-right, flip up-down and the clockwise rotation (the `unorientPixel` mapping written in GLSL in `displayFragmentShader`), so they re-display the held image at once with no new exposure. `fluoroCanvas.ts` passes the three settings to `drr.display`.
- Files touched: `src/render/drrGpu.ts`, `src/render/fluoroCanvas.ts`, `tests/e2e/render/orientation.spec.ts` (new), this log, the task file.
- Test result: verify command passed (16 new screen tests; all render screen tests) after I reworked a safety check in my own new test (it compared with the 7.65 limit a difference that is really 7.5; the renderer was right). `npm run check` passed: lint + types clean, 153 unit tests, 130 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: no flip/rotate buttons yet (F2-S16) — see the Lessons entry on the controls column: put the three buttons in ONE row.

## Round — 2026-11-10 17:11 — F2-S16 — done
- What I did: Added the buttons Flip ↔ (`flip-horizontal`), Flip ↕ (`flip-vertical`), both with `aria-pressed`, and Rotate (`rotate-button`, +90° clockwise per press, wraps to 0°, shows the angle). They change the settings, so the picture changes at once. Rotate moved into the first row beside Invert to save height.
- Files touched: `src/render/controls.ts`, `tests/e2e/render/orientationButtons.spec.ts` (new), this log, the task file.
- Test result: verify command passed (10 screen tests). `npm run check` passed: lint + types clean, 153 unit tests, 140 screen tests passed and 6 skipped (one-set-up-only tests).
- Next round should know: the Invert button is now half the column wide (68 px), still at least 44×44 px; all earlier control tests pass unchanged.
