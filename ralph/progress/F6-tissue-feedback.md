# Progress log — F6 Tissue feedback and events

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- Phantom labels on the midline (x = 0, z = 0), from the back: air y ≥ 43, skin/fat 42–39, muscle 38–23, ligamentum flavum 22–16, epidural space 15–13, thecal sac 12–10, spinal cord 9–3, thecal sac 2–0, epidural space −1, disc −2 to −22. At y = −28, z = 0: artery x 11 to 5, vein x −5 to −13, muscle between. At x = 13, z = 0: joint space y 22–14, nerve root y 7–3. The line x = 30 leaves the body (air), so it is not a muscle-only path.
- Phantom nerve roots: cylinders along x for |x| 5–26, radius 2 mm around y = 5, z = 0; nerve voxels at x = 13 are y 3–7 on z = 0.
- ESLint here flags `_`-prefixed unused destructured names (`{ a: _drop, ...rest }`); copy the object and `delete` the field instead.
- Screen tests put a needle in the app's store with `putNeedle(page, needleWithTip(tip))` from `tests/e2e/sim/simZone.ts` (dev-server store module import); read the sim with `getSim(page)` (waits for `window.__sim.sim`).
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

## Round — 2026-11-13 05:06 — F6-S5 — done
- What I did: extended `src/sim/tracker.ts`: `update` takes an optional 4th argument `landmarks`. Each sample records `nearNerve` (`isNearNerve`: any nerve-root voxel whose centre is within `NERVE_CONTACT_MM` = 1 mm, checking only voxels in the 1 mm box); a false→true change emits 'nerveContact'. `nearestForamen(landmarks, point)` gives level + side of the nearest foramen centre; message 'Paresthesia — left L4', or just 'Paresthesia' without level/side when there are no foramina or no landmarks. Tests first in `tests/sim/nerveContact.test.ts` (7 tests, including a one-nerve-voxel test volume for the 1.5 mm / 0.8 mm check).
- Files touched: src/sim/tracker.ts, tests/sim/nerveContact.test.ts, this log (plus Lessons), the task file.
- Test result: verify passed (7/7), all 42 sim tests pass; `npm run check` passed after one lint fix (lint, types, all unit tests, 409 screen tests passed, 25 skipped by set-up).
- Next round should know: like the other events, nerve contact needs a previous sample (none on the first update). The runner (F6-S8) should pass `store.landmarks` as the 4th argument.

## Round — 2026-11-13 05:12 — F6-S6 — done
- What I did: extended `src/sim/tracker.ts`: it remembers the last `NeedleState.boneContact` (absent = false) and emits 'boneContact' ('Bone contact', time, needle tip) when it goes from false/absent to true; `reset()` forgets the flag too. Unlike the tissue-entry events, this one can fire on the very first update (absent → true). Tests first in `tests/sim/boneContact.test.ts` (5 tests).
- Files touched: src/sim/tracker.ts, tests/sim/boneContact.test.ts, this log, the task file.
- Test result: verify passed (5/5), all 47 sim tests pass; `npm run check` passed (lint, types, all unit tests, 409 screen tests passed, 25 skipped by set-up).
- Next round should know: F6-S7 (aspirate) depends only on S1. The bone-contact event comes after any tissue events from the same update in the returned list.

## Round — 2026-11-13 05:18 — F6-S7 — done
- What I did: added `src/sim/aspirate.ts`: `aspirate(tissueKey, random, probability = tissues.arterialAspirationProbability)` → 'CSF' (thecal sac), 'blood' (vein), artery 'blood' when random() < probability else 'nothing', everything else 'nothing'. random() is only called in an artery. Tests first in `tests/sim/aspirate.test.ts` (6 tests; seed 12345 for the 1000-draw check).
- Files touched: src/sim/aspirate.ts, tests/sim/aspirate.test.ts, this log, the task file.
- Test result: verify passed (6/6); `npm run check` passed (lint, types, all unit tests, 409 screen tests passed, 25 skipped by set-up).
- Next round should know: F6-S8 (runner) is now eligible: S4–S7 are all done. The screen will show 'CSF' / 'Blood' / 'Nothing' (F6-S10), so capitalise 'blood' and 'nothing' at display time.

## Round — 2026-11-13 05:25 — F6-S8 — done
- What I did: added `src/sim/runner.ts`: `connectSim(store, bus, clock = performance.now()/1000)` subscribes to the store; when `store.needle` changes (by reference) it runs the tracker with `store.volume` and `store.landmarks`, emits each event as 'tissueEvent' and keeps them (oldest first). Time = clock() − start, where start is reset on caseStart (or set at connecting). caseStart clears events and resets the tracker; needle → null resets the tracker only; no volume → nothing. Returns { events(), tipTissue(), time(), disconnect() }. `mount()` in `src/sim/index.ts` connects it to the app store/bus and registers the 'sim' debug getter { tipTissue (key or null), resistance (or null), events }. Tests first: `tests/sim/runner.test.ts` (10 unit tests) and `tests/e2e/sim/runner.spec.ts` (3 screen tests × 2 set-ups), with helpers in `tests/e2e/sim/simZone.ts`.
- Files touched: src/sim/runner.ts, src/sim/index.ts, tests/sim/runner.test.ts, tests/e2e/sim/runner.spec.ts, tests/e2e/sim/simZone.ts, this log (plus Lessons), the task file.
- Test result: verify passed (10 unit + 6 screen); `npm run check` passed (lint, types, all unit tests, 415 screen tests passed, 25 skipped by set-up).
- Next round should know: the hidden 'zone-sim' marker is still there; F6-S9 builds the visible sim section. `mount()` keeps the runner in a local `sim` variable — the UI stories can build on it (e.g. subscribe to the store / 'tissueEvent' to refresh the panel).
