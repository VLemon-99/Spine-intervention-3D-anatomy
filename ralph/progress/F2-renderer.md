# Progress log — F2 Fluoroscopic image renderer

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- A slab for the absorption tests must be made of whole voxels: with 1 mm voxels use an EVEN number of voxels along the beam so an even thickness (10, 20, 40 mm) is exact. `slabVolume(thicknessMm)` in `tests/render/drrCpu.test.ts` does this (and has a different spacing per axis).
- For an exact central ray use the pixel position `{ x: 256, y: 256 }` with `transmissionAt`; pixel (255, 255)'s centre is half a pixel off it.
- A full 512×512 `renderDrrCpu` of the phantom takes about 1 second in Vitest, so a handful of whole images per test file is fine; use `transmissionAt` for single rays.
- The shader's loop limit comes from `MAX_MARCH_STEPS` in `pipeline.ts` (pasted into the shader text); the CPU march uses the same number.
- ESLint rejects unused parameters even with a leading underscore; use `void options;` for a parameter kept for later stories.

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
