# Progress log — F6 Tissue feedback and events

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- Phantom labels on the midline (x = 0, z = 0), from the back: air y ≥ 43, skin/fat 42–39, muscle 38–23, ligamentum flavum 22–16, epidural space 15–13, thecal sac 12–10, spinal cord 9–3, thecal sac 2–0, epidural space −1, disc −2 to −22. At y = −28, z = 0: artery x 11 to 5, vein x −5 to −13, muscle between. At x = 13, z = 0: joint space y 22–14, nerve root y 7–3. The line x = 30 leaves the body (air), so it is not a muscle-only path.
- To print phantom labels, a throwaway `tests/sim/zz*.test.ts` with `console.log` needs `--reporter=verbose` to show stdout; delete it afterwards.

## Rounds
<!--
## Round — YYYY-MM-DD HH:MM — F1-S1 — done | failed | blocked
- What I did:
- Files touched:
- Test result:
- Next round should know:
-->

## Round — 2026-11-13 04:39 — F6-S1 — done
- What I did: added `src/sim/tissues.json` (draft, reviewedByOwner false, notes say the numbers are drafts; resistance 0–1 for all 14 tissue keys; arterialAspirationProbability 0.5) and `src/sim/data.ts` with a hand-written validator `validateTissues` plus the checked `tissues` export. Tests first in `tests/sim/data.test.ts` (11 tests).
- Files touched: src/sim/tissues.json, src/sim/data.ts, tests/sim/data.test.ts, this log, the task file.
- Test result: verify passed (11/11); `npm run check` passed (lint, types, 501 unit, 409 screen tests passed, 25 skipped by set-up).
- Next round should know: ran on the cloud session branch `claude/fervent-babbage-5v2fey` (allowed by step 2). Draft resistances: bone 0.9–1, ligamentum flavum 0.8, epidural space 0.05, thecal sac 0.1. Import `tissues` from `src/sim/data.ts` for resistance lookups. The validator also rejects unknown tissue keys.

## Round — 2026-11-13 04:45 — F6-S2 — done
- What I did: added `src/sim/tissue.ts`: `assertStandardLayout`, `labelAt(volume, point)` (nearest voxel, outside = air; the sim zone's own copy of the needle zone's), `tissueLabel(id)`, `tissueAt(volume, point)` and `tipTissue(needle, volume)` returning { id, key, name, resistance }. Tests first in `tests/sim/tissue.test.ts`; hand-made needle helper `tests/sim/needleStates.ts` (`needleAt(tip, extra)`).
- Files touched: src/sim/tissue.ts, tests/sim/tissue.test.ts, tests/sim/needleStates.ts, this log, the task file.
- Test result: verify passed (9/9); `npm run check` passed (lint, types, all unit tests, 409 screen tests passed, 25 skipped by set-up).
- Next round should know: `tissueAt(volume, point)` is the per-sample helper for the tracker (F6-S3+). Use `needleAt(tip, { boneContact })` from `tests/sim/needleStates.ts` for hand-made needle states.

## Round — 2026-11-13 04:52 — F6-S3 — done
- What I did: added `src/sim/tracker.ts`: `createTissueTracker()` with `update(needle, volume, time)` and `reset()`. It samples the straight segment from the previous tip to the new one every 0.25 mm (`SAMPLE_STEP_MM`; previous tip excluded, new tip included; the very first update samples only the tip) and emits 'lossOfResistance' when one sample is ligamentum flavum and the next is epidural space; the event's tip is that sample point. Tests first in `tests/sim/tracker.test.ts` (8 tests).
- Files touched: src/sim/tracker.ts, tests/sim/tracker.test.ts, this log (plus Lessons), the task file.
- Test result: verify passed (8/8); `npm run check` passed (lint, types, all unit tests, 409 screen tests passed, 25 skipped by set-up).
- Next round should know: the tracker keeps the last sample { point, label }; S4/S5 can add more checks inside the same sample loop (compare `last.label` with `sample.label`). S5 needs landmarks: extend update with an optional 4th argument `landmarks?` so existing calls keep working.

## Round — 2026-11-13 04:59 — F6-S4 — done
- What I did: extended `src/sim/tracker.ts` with an `ENTRY_EVENTS` table: a sample whose label differs from the previous sample's and is thecal sac / spinal cord / artery / vein emits 'duralPuncture' ('Dural puncture') / 'cordContact' ('Spinal cord contact') / 'intravascular' ('Intravascular', same text for both vessels). Tests first in `tests/sim/safetyEvents.test.ts` (6 tests).
- Files touched: src/sim/tracker.ts, tests/sim/safetyEvents.test.ts, this log, the task file.
- Test result: verify passed (6/6), tracker tests still pass; `npm run check` passed (lint, types, all unit tests, 409 screen tests passed, 25 skipped by set-up).
- Next round should know: like loss of resistance, entry events need a previous sample: the very first update after creation/reset emits nothing, even if the tip is already in the sac. Going straight from artery into vein would emit a second 'intravascular' (label changed); the phantom's vessels do not touch, so no test covers it.
