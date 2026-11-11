# Plan & roadmap

> The bird's-eye view of progress. Updated in interactive sessions (not by loop rounds, so parallel loops never collide on this file). The detailed stories live in `ralph/tasks/`.

## Roadmap

| Feature | Task file | Zone(s) | Depends on | Status | Branch | Notes |
|---|---|---|---|---|---|---|
| F0 — Walking skeleton | `ralph/tasks/F0-skeleton.json` | all (sets up shared files) | — | merged | `claude/sharp-wozniak-jbi9yp` | Merged 2026-11-10 ([PR #4](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/4)). 15/15 stories done, plus a disclaimer keyboard fix from review |
| F1 — Anatomy data | `ralph/tasks/F1-anatomy.json` | anatomy | F0 | planned | `ralph/F1-anatomy` | 27 stories; 25 for the loop. Blocked by design: S27 (end-to-end picker test, needs F3 merged — no decision needed) and S22 (F1.7, real CT — interactive session with the owner) |
| F2 — Fluoro renderer | `ralph/tasks/F2-renderer.json` | render | F0 | in review | `claude/ralph-f2-renderer-fa4hl7` | 21/21 stories done 2026-11-10; waiting for review of [PR #8](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/8) |
| F3 — C-arm, table & exposure | `ralph/tasks/F3-carm.json` | carm | F0 | planned | `ralph/F3-carm` | 11 stories, all for the loop. F3.3 is already covered by F0's tests |
| F4 — Needle mechanics | `ralph/tasks/F4-needle-mechanics.json` | needle | F0 | planned | `ralph/F4-needle-mechanics` | 9 stories, all for the loop. Tuning numbers (`params.json`, catalogue stiffness) need owner review |
| F5 — Needle handling controls | `ralph/tasks/F5-needle-controls.json` | needle | F3, F4 | not planned | `ralph/F5-needle-controls` | |
| F6 — Tissue feedback & events | `ralph/tasks/F6-tissue-feedback.json` | sim | F4 | not planned | `ralph/F6-tissue-feedback` | |
| F7 — Needle in the image | `ralph/tasks/F7-needle-image.json` | render | F2, F4 | not planned | `ralph/F7-needle-image` | |
| F8 — 3D see-through view | `ralph/tasks/F8-view3d.json` | view3d | F0 | planned | `ralph/F8-view3d` | 9 stories, all for the loop. Tests put a hand-made needle in the store, so F4 is not needed first |
| F9 — Contrast injection | `ralph/tasks/F9-contrast.json` | contrast | F2, F6 | not planned | `ralph/F9-contrast` | |
| F10 — Procedures & scoring | `ralph/tasks/F10-procedures.json` | procedures | F1, F3, F5, F6, F9 | not planned | `ralph/F10-procedures` | Rules need owner review; completes v1 |
| F11 — Image-recognition quiz | `ralph/tasks/F11-quiz.json` | quiz | F1, F2 | not planned | `ralph/F11-quiz` | Explanations need owner review |
| F12 — App shell | `ralph/tasks/F12-app-shell.json` | app | F0 | planned | `ralph/F12-app-shell` | 11 stories; 9 for the loop. S10 (procedure list) and S11 (saving attempts handed over) blocked by design until a shared-contract change. S1 and S3 change the shared helper `tests/fixtures/acceptDisclaimer.ts` (needs your OK). Re-check layout once all panels exist |

**Status values:** not planned → planned → looping → in review → merged (or: blocked — needs me)

## Can run in parallel right now
<!-- Features whose zones don't overlap and whose dependencies are merged. See docs/ARCHITECTURE.md → Work zones. -->
- **F1, F2 and F3 are planned and can loop in parallel now**: three different zones (anatomy, render, carm), all depend only on F0, and none of their loop stories changes a shared file. Each adds its own screen-test helpers inside its own `tests/e2e/<zone>/` folder instead of touching `tests/fixtures/`.
- **F4, F8 and F12 are planned and can also loop in parallel now** (with F1 and F3): three more zones (needle, view3d, app), all depend only on F0. F4 and F8 change no shared file. F12 changes one shared helper, `tests/fixtures/acceptDisclaimer.ts` (F12-S1, F12-S3, with your OK); no other loop edits that file, and its name and use stay the same, so the other branches merge cleanly.
- F12's two blocked stories (S10, S11) wait for an interactive shared-contract change (see "Waiting on me").
- Two F1 stories are blocked by design: F1-S22 (real CT, with the owner) and F1-S27 (one end-to-end picker test once F1 and F3 are both merged). The F1 loop skips them and says so in its pull request.
- Afterwards: F5 needs F3 + F4; F6 needs F4; F7 needs F2 + F4 (and runs after F2, same zone); F11 needs F1 + F2.

## Waiting on me
<!-- Blocked stories, open questions, pull requests to review. -->
- Open questions in `docs/SPEC.md` → "Open questions": app name, choosing the CT scan(s) (before F1.7).
- Next step: start the F1 and F3 loops (stories reviewed and fixed 2026-11-10); review the F4, F8 and F12 stories (planned 2026-11-11), then start those loops too.
- Open questions from F4, F8 and F12 planning (the plan uses the stated default until you say otherwise):
  - **F4.2 vs F4.8 (needle):** the lever rule (tip moves opposite the hub) and track memory (a deep needle barely moves) disagree for deep needles. Default: the lever rule up to 10 mm deep, track memory beyond.
  - **Pre-bend direction:** default: the bend points away from the hub notch (the same side the bevel drift goes, so both add up). The curved RF cannula's curve is fixed by the catalogue.
  - **Needle clock face:** 12 o'clock = toward the patient's head; the notch marks the bevel opening and the tip drifts to the opposite side.
  - **3D view:** off at start; nerves, vessels and thecal sac shown, soft tissue hidden. "Soft tissue" = skin/fat, muscle, disc, ligamentum flavum, epidural space, joint space. After Exam mode the view stays off until turned on.
  - **Home screen:** the app opens on the home screen after the disclaimer. To keep every existing screen test working, the shared helper `acceptDisclaimer` is changed (by F12-S1 and F12-S3) to skip a remembered disclaimer and then choose Free play. Alternative: the app opens straight into Free play and Home is a button.
  - **Navigation:** History and About are reached from the home screen; the simulator, quiz and picker screens have a Home button.
  - **Shortcuts off the simulator screen:** the app sets `data-screen` on `<html>`; teaching the C-arm (and later needle) shortcuts to ignore keys on the home/About/History screens is a later shared change.
  - **About page without a real dataset:** shows "Images are computed from a synthetic test phantom; no patient data is used." The app reads the dataset credits from `data/manifest.json` with the field names F1 writes (`sourceDataset`, `licence`, `attribution`) — check they match when F1 is reviewed.
  - **No WebGL2:** only the message is shown, without the disclaimer.
- **Shared-contract change needed (interactive), before F12-S10/S11 and before F10/F11 are planned:** proposed `store.procedures` (`{ id, title }`, filled by the procedures zone), bus event `procedureRequest` (a procedure id), and bus event `attemptFinished` (an `AttemptRecord`, emitted by procedures and quiz, saved by the app).
- Gaps found while planning F4, F8 and F12 (docs not changed):
  - No shared "tissue label at a point" helper in `src/core/`: the needle zone writes its own; sim (F6) and contrast (F9) would need the same. Worth adding to core before F6/F9.
  - `NeedleState` has no bone-contact flag, so the sim zone (F6.3 `boneContact`) cannot see what the needle model reports. Decide before planning F5/F6.
  - Per-tissue numbers will live in two files: needle drift stiffness (`src/needle/params.json`) and tissue resistance (`src/sim/tissues.json`, F6). Both are yours to tune.
  - Touch-gesture test helpers are written per zone (F3 `tests/e2e/carm/controls.ts`, F8 `tests/e2e/view3d/touch.ts`); they could move to `tests/fixtures/` later.
  - How the quiz shows a fluoro image (render zone's panel or its own) is open for F11 planning; F12 only gives the quiz its screen.
  - The 3D bone surface is built from voxel faces; on a real CT region it may be large or slow on tablets. Check by hand after F1.7.
- Open questions from F1–F3 planning (the plan uses the stated default until you say otherwise):
  - **C-arm keys** (F3.2 names none). Default: J/L oblique, I/K tilt, N/M table right/left, U/O table head/feet, Y/H table up/down — chosen to stay clear of the needle keys in F5.
  - **Pose text at 0°** (F2.9). Default: "AP · TILT 0°".
  - **Region list:** once real regions exist, does "Phantom" stay in the picker, and which region loads at start?
  - **Landmarks for C1 and C2:** F1 skips them (no normal vertebral body). Sacrum and iliac crest landmarks are now planned (F1-S23). The caudal and SI-joint procedures (F10) will still need sacral hiatus and SI-joint landmarks — a later shared-contract change.
  - **After switching region:** the picture on screen stays (last image hold) until the next image, and the counters are not reset. Say if switching should clear the picture or start a new case.
  - **Lumbosacral file size:** the region is now cut wide enough to include both iliac crests. If it does not fit in 25 MB at 1 mm (found out in F1.7), the choice is a coarser voxel size or cutting the crests off.
  - **Dataset contents:** the TotalSegmentator mask names in `tools/anatomy/label-map.json` are a draft to check against the real download (F1.7). Its "spinal cord" mask is treated as thecal sac; discs have no mask as far as I know, so they would be labelled as generic soft tissue unless you want modelled discs (not in the spec). VerSe (the fallback dataset) uses a different file layout the converter stories do not cover.
  - **Noise levels, contrast darkness and all soft-tissue shape numbers** are drafts for you to tune.
- **Review and merge F2:** [PR #8](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/8). Points to look at while reviewing:
  - With Invert on, the collimated (covered) area is white, not black, because Invert comes after collimation in the order of steps. Say if it should stay black.
  - Draft numbers in `src/render/pipeline.ts`: noise levels (shot 0.04, fluoro 0.1), grain strength (0.25) and contrast darkness (0.3 per mm).
  - The fluoro panel's controls column is nearly full on the tablet when the collimation sliders are folded out (F12 owns the final layout).
  - The spec's "within 3% of the grey range" comparison is a loose check on the phantom (most of the picture is air); the tests add stricter checks.
- Spec wording to update if you agree (not changed yet): SPEC F2 does not say the magnification, collimation and flip/rotate controls sit in the fluoro panel, or that Invert/flip/rotate act immediately (both are recorded in `docs/DECISIONS.md`).
- Not yet approved (proposed by the F0 loop, see the story notes in `ralph/tasks/F0-skeleton.json`): extra dev packages `@types/node`, `@eslint/js` and `tsx`, TypeScript 6 instead of 7; the contrast volume stored at 8-bit precision (may need revisiting in F9); level names in shared data as text ('L4'); and the rest of the `src/core/types.ts` field choices (F0-S4 notes). Approve or change them in an interactive session — `src/core/` changes are shared-file changes.
- Optional: `npm audit` reports 10 moderate warnings, all inside the lint tool (ESLint / typescript-eslint, via minimatch); nothing reaches the app. Fix by updating those packages in an interactive session with the full test suite. Never use `npm audit fix --force` (it downgrades ESLint and breaks the version pins).
- Real-tablet check on an iPad once F2 and F3 are merged (SPEC → Open questions).

## Handoff note (interactive sessions)
<!-- Where we stopped, anything half-finished, what the next session should check first. -->
2026-11-09 kickoff: interview done, and these are written: SPEC (F0–F12), ARCHITECTURE (zones + shared files), DECISIONS (stack, anatomy, no-login, desktop+tablet, Playwright pin, clinical review), CLAUDE.md (stack + commands) and the `.claude/settings.json` allow list. No application code exists yet. The npm scripts named in CLAUDE.md (`dev`, `test`, `test:e2e`, `lint`, `typecheck`, `check`, `build`, `anatomy:convert`) must be created by F0. `anatomy:convert` is a placeholder in F0 (F0.10, owner decision 2026-11-09); F1 builds the real converter behind it.

2026-11-09 F0 story review: applied the 10 approved fixes. F0 now has 15 stories (renumbered S1–S15 in priority order; phantom and GPU image each split in two). Shared contracts extended (Landmarks, Mode, quiz-friendly AttemptRecord, more store slots and bus events). Oblique sign decided: positive = right (detector toward the patient's right). No jsdom/happy-dom: unit-tested logic stays browser-free.

2026-11-10 F1–F3 planned (task files + empty progress logs). The owner had no preference on four planning questions, so the recommended options were adopted and recorded in `docs/DECISIONS.md`. No application code was written; `npm install` was not run in that session.

2026-11-10 F0 merged (PR #4). Review found one bug (keyboard could reach the app behind the disclaimer), fixed with two new screen tests before merging. Owner ran the app locally on a Mac: the first image renders correctly on a real GPU. Merge wrap-up: lessons promoted into `CLAUDE.md` (tool versions, screen tests, 3D graphics); decisions recorded (image orientation, C-arm numbers, disclaimer wording). Accepted from review: F0-S14 added the shared helper `tests/fixtures/simPage.ts` without its story saying so; F0 ran alone so nothing collided. F0 ran on the cloud branch `claude/sharp-wozniak-jbi9yp`, not `ralph/F0-skeleton` (allowed by `ralph/PROMPT_build.md` step 2). Note for F3: the spacebar shortcut currently takes a shot whenever focus is not in a text field, so focused checkboxes/toggles added later would lose space to it.

2026-11-10 F1–F3 story review (branch `claude/review-story-specs-e8r7vv`): the owner approved nine fixes. Shared contract extended in `src/core/` with tests (image kind, region list + `regionRequest`, sacrum and iliac crest landmarks, shortcut list); `takeShot` marks its image as a shot. Stories: L5–S1 foramen and sacrum/iliac crest landmarks added (F1-S11, F1-S23); F1-S4, S13, S19 and F3-S7 split (new F1-S25, S26, S24, F3-S11); F1-S21, F2-S21 and F3-S10 unblocked and rewritten against the shared contract; missing tests added; slider size rule clarified. Story IDs were kept; only priorities changed. Details in `docs/DECISIONS.md`. Merge this branch before starting the loops.

2026-11-11 F4, F8 and F12 planned (task files + empty progress logs): F4 9 stories, F8 9, F12 11 (2 blocked by design). No application code was written. Open questions and gaps are listed under "Waiting on me".
