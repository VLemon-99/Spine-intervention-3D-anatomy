# Progress log — F6 Tissue feedback and events

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- [none yet]

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
