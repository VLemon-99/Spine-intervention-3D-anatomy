# Progress log — F1 Anatomy data

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- NIfTI header numbers are 32-bit floats: compare affine/spacing values with `Math.fround(...)` or `toBeCloseTo`, never `toEqual` against plain decimals like 0.8.
- Build NIfTI test files with `makeNifti` / `writeNifti` from `tests/anatomy/niftiFixture.ts` (path ending `.gz` gets gzipped; options for big-endian, slope/intercept, sform/qform, bad magic, fake 4-D, truncation).
- `readNifti` returns the file's own axes and the NIfTI RAS+ affine (+x = patient right, +y = front). Our app frame is +x left, +y back — F1-S3 must convert (flip x and y) when reordering.

## Rounds
<!--
## Round — YYYY-MM-DD HH:MM — F1-S1 — done | failed | blocked
- What I did:
- Files touched:
- Test result:
- Next round should know:
-->

## Round — 2026-11-10 13:10 — F1-S1 — done
- What I did: wrote the NIfTI-1 reader (plain + gzip detected by content, uint8/int16/uint16/float32, both byte orders, slope/intercept with slope 0 meaning none, sform → qform → spacing-only affine) and a fixture writer for tests; 20 unit tests.
- Files touched: tools/anatomy/nifti.ts, tests/anatomy/nifti.test.ts, tests/anatomy/niftiFixture.ts, task file, this log.
- Test result: verify command 20/20 passed; `npm run check` green (lint, types, 103 unit tests, 46 screen tests passed, 6 skipped by set-up).
- Next round should know: two-file NIfTI (.hdr/.img, magic "ni1") is rejected on purpose. The cloud session runs on branch claude/ralph-loop-f1-anatomy-1sgnfd rather than the task file's ralph/F1-anatomy.

## Round — 2026-11-10 13:12 — F1-S2 — done
- What I did: HU → 8-bit mapping over a validated window (default −1000…+2000), rounded and clamped; whole-volume helper for the converter; 7 unit tests.
- Files touched: tools/anatomy/intensity.ts, tests/anatomy/intensity.test.ts, task file, this log.
- Test result: verify 7/7 passed; `npm run check` green (110 unit tests, 46 screen tests passed).
- Next round should know: the converter (F1-S9) should call `huVolumeToIntensity(niftiVolume.data, window)` after reordering; take a custom window via `makeHuWindow`. The loop's state file `.claude/ralph-loop.local.md` is listed in `.git/info/exclude` (local only) so it is never committed.
