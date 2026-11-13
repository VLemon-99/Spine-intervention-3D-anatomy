# Progress log — F7 Needle in the image

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- The needle is a chain of flat-ended tubes: `needlePathLength` intersects the ray with each piece's infinite tube, then cuts to the piece's length along its axis. This is exact, handles a ray along the needle (no infinity), and colinear pieces never double-count. The GPU shader (F7-S3) should copy this maths line for line.
- GPU precision: the source is ~650 mm from the needle, so |w|² in float32 swamps r² (0.12 mm²). The shader first moves the ray start to its closest point to each piece's start (tShift) and counts the ray's own start as t = −tShift. Keep that if the shader is changed.
- A Playwright `tap()` on the tablet set-up also fires a `click` event, so one 'click' listener covers mouse and touch (fluoroCanvas.ts imageTap).
- Phantom spots for test needles in plain muscle: y = 30, z = 30…36, |x| ≤ 10 (bone ends at z = 26, skin starts at z = 38). Near z = 24–26 the block edge makes 20+ grey-level steps 5 px away.
- `needlePathLength` counts only t ≥ 0 (in front of the ray's start), so pass the X-ray source as the ray origin.

## Rounds
<!--
## Round — YYYY-MM-DD HH:MM — F1-S1 — done | failed | blocked
- What I did:
- Files touched:
- Test result:
- Next round should know:
-->

## Round — 2026-11-13 04:40 — F7-S1 — done
- What I did: Added step 2b (the needle) to the ORDER OF STEPS in `src/render/pipeline.ts`, with NEEDLE_RADIUS_MM = 0.35, NEEDLE_ABSORPTION_PER_MM = 3 (draft) and MAX_NEEDLE_SEGMENTS = 64; `resampleShaft` (always 65 evenly spaced points for a shaft with length; [] / one point otherwise) and `needlePathLength` (ray vs flat-ended tube per piece, ray direction need not be unit length).
- Files touched: src/render/pipeline.ts, tests/render/needleMaths.test.ts (new), this task file and log.
- Test result: verify 11/11 passed; `npm run check` green (unit 501 passed; screen 409 passed, 25 skipped by set-up).
- Next round should know: NEEDLE_ABSORPTION_PER_MM = 3 was picked from a rough phantom estimate (vertebra body ray ≈ 0.3 more absorption than muscle; needle diameter gives 2.1). F7-S2's darker-than-bone test checks it; tune there if needed.

## Round — 2026-11-13 04:55 — F7-S2 — done
- What I did: `renderDrrCpu` and `transmissionAt` take an optional `needle` (shaft points). After the volume march, `total += needlePathLength(source, ray direction, resampleShaft(needle)) × NEEDLE_ABSORPTION_PER_MM` over the whole ray (t ≥ 0 from the source; the needle can never lie beyond the detector, so no end cut is needed). No needle / [] → image unchanged.
- Files touched: src/render/drrCpu.ts, tests/render/needleCpu.test.ts (new), this task file and log.
- Test result: verify 5/5 passed; `npm run check` green (unit 506 passed; screen 409 passed, 25 skipped by set-up).
- Next round should know: at pose 0°/0°, a needle at (30, 0, z) lets 0.08 through vs 0.61 for the muscle beside it, so NEEDLE_ABSORPTION_PER_MM = 3 easily beats bone. F7-S3's shader must resample the same way (65 points) and use the ray from the source, as `march` does.

## Round — 2026-11-13 05:10 — F7-S3 — done
- What I did: The GPU shader adds the needle (uniform array `uNeedle[65]` + `uNeedleCount`, filled from `resampleShaft`) with the same tube maths as `needlePathLength`, on every ray, also outside the box. `TakeOptions.needle` is optional (null/absent = none). `fluoroCanvas.ts` passes `store.needle?.shaft` at each exposure (F7-S4 will freeze a copy). Zone helpers `straightTestNeedle` and `putNeedle` added to tests/e2e/render/renderPage.ts.
- Files touched: src/render/drrGpu.ts, src/render/fluoroCanvas.ts, tests/e2e/render/renderPage.ts, tests/e2e/render/needle.spec.ts (new), this task file and log.
- Test result: verify 4/4 passed (both set-ups); `npm run check` green (unit 506 passed; screen 413 passed, 25 skipped by set-up).
- Next round should know: F7-S8 compares GPU vs CPU; the CPU uses doubles without the tShift trick, so small differences at the needle's edge pixels are expected, but the 21×21 box mean should be well inside 3%.

## Round — 2026-11-13 05:25 — F7-S8 — done
- What I did: New screen test comparing the GPU needle with renderDrrCpu (same needle and pose, noise 0) in a 21×21 px box around the needle's projected middle: a needle across the beam at 0°/0°, a slanted needle at oblique +25°/tilt −10°, and a needle in the air at y = 55 (outside the box). Each is ≤ 3% mean difference, and the needle is > 20 grey levels darker than the box corners (both images) / than the image without needle (air case). No shader fix was needed.
- Files touched: tests/e2e/render/needleCpuMatch.spec.ts (new), this task file and log.
- Test result: verify 6/6 passed (both set-ups); `npm run check` green (lint + types; unit 506 passed; screen 419 passed, 25 skipped by set-up).
- Next round should know: next eligible is F7-S7 (imageTap), then F7-S4. The tShift precision trick in the shader is enough for the GPU to match the CPU.

## Round — 2026-11-13 05:45 — F7-S7 — done
- What I did: New plain function `imageTapPixel` (src/render/imageTap.ts): canvas pixel (floored, on the 512 grid) → unorientPixel with the CURRENT display flips/rotation → null if collimated by the held image's shutters → detectorPosition with the held image's magnification. fluoroCanvas.ts listens for 'click' on the canvas, scales the position from the canvas's on-screen box, and emits 'imageTap' only while an image is held.
- Files touched: src/render/imageTap.ts (new), src/render/fluoroCanvas.ts, tests/render/imageTap.test.ts (new), tests/e2e/render/imageTap.spec.ts (new), this task file and log.
- Test result: verify passed (unit 8/8, screen 6/6 in both set-ups); `npm run check` green (unit 514 passed; screen 425 passed, 25 skipped by set-up).
- Next round should know: the emitted pixel is a whole-pixel position (e.g. 256, not 256.5), scaled by magnification (so 306 at m = 2 can be fractional for odd offsets). F5-S11 can now be unblocked by the owner once F7 is merged.

## Round — 2026-11-13 06:05 — F7-S4 — done
- What I did: fluoroCanvas.ts copies the store needle's shaft and tip into `lastImage` at each exposure and takes the image with that copy. The 'render' debug getter's lastImage gains `needleTip` (copy, or null); the shaft copy stays internal. Display changes only re-show the held texture, so they keep the old needle. RenderInfo type in tests/e2e/render/renderPage.ts gained needleTip.
- Files touched: src/render/fluoroCanvas.ts, tests/e2e/render/renderPage.ts, tests/e2e/render/needleHold.spec.ts (new), this task file and log.
- Test result: verify 8/8 passed (both set-ups); `npm run check` green (unit 514 passed; screen 433 passed, 25 skipped by set-up). One of my own new checks first failed because I had put the "new" needle at the vertebra's edge (z = 24); moved it to z = 35 in muscle.
- Next round should know: next eligible is F7-S5 (tip lands where geometry says, 5 seeded poses). For the "needle pixel" mask, compare with an image taken with no needle at the same pose (take two images).

## Round — 2026-11-13 06:20 — F7-S5 — done
- What I did: Zone helpers in tests/e2e/render/renderPage.ts: `seededPoses(seed)` (createRandom; oblique −40…40°, tilt −20…20°), `needlePixels(with, without)` (≥ NEEDLE_PIXEL_MARGIN = 30 grey levels darker than the no-needle image) and `findTipPixel(pixels, hubPixel)` (needle pixel centre farthest from the hub's projection). New spec: per seeded pose (seed 7), a no-needle image and a needle image with default settings; the found tip is within 2 px of project(tip). Needle: hub (28, 14, −8) → tip (28, 10, −30), in muscle left of the spine.
- Files touched: tests/e2e/render/renderPage.ts, tests/e2e/render/needleTip.spec.ts (new), this task file and log.
- Test result: verify 12/12 passed (both set-ups); `npm run check` green (unit 514 passed; screen 445 passed, 25 skipped by set-up).
- Next round should know: F7-S6 is the last loop story; reuse needlePixels for the spot/line extent (longest extent = largest distance between two needle pixel centres, plus 1 px).
