# Progress log — F7 Needle in the image

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- The needle is a chain of flat-ended tubes: `needlePathLength` intersects the ray with each piece's infinite tube, then cuts to the piece's length along its axis. This is exact, handles a ray along the needle (no infinity), and colinear pieces never double-count. The GPU shader (F7-S3) should copy this maths line for line.
- GPU precision: the source is ~650 mm from the needle, so |w|² in float32 swamps r² (0.12 mm²). The shader first moves the ray start to its closest point to each piece's start (tShift) and counts the ray's own start as t = −tShift. Keep that if the shader is changed.
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
