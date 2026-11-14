# Plan & roadmap

> The bird's-eye view of progress. Updated in interactive sessions (not by loop rounds, so parallel loops never collide on this file). The detailed stories live in `ralph/tasks/`.

## Roadmap

| Feature | Task file | Zone(s) | Depends on | Status | Branch | Notes |
|---|---|---|---|---|---|---|
| F0 — Walking skeleton | `ralph/tasks/F0-skeleton.json` | all (sets up shared files) | — | merged | `claude/sharp-wozniak-jbi9yp` | Merged 2026-11-10 ([PR #4](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/4)). 15/15 stories done, plus a disclaimer keyboard fix from review |
| F1 — Anatomy data | `ralph/tasks/F1-anatomy.json` | anatomy | F0 | merged (except F1.7) | `claude/ralph-loop-f1-anatomy-1sgnfd` | 26/27 stories done; merged ([PR #13](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/13), [PR #15](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/15)). S22 (F1.7, converting the real CT) is left for an interactive session with the owner |
| F2 — Fluoro renderer | `ralph/tasks/F2-renderer.json` | render | F0 | merged | `claude/ralph-f2-renderer-fa4hl7` | 21/21 stories done; merged ([PR #8](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/8)) |
| F3 — C-arm, table & exposure | `ralph/tasks/F3-carm.json` | carm | F0 | merged | `claude/ralph-loop-f3-carm-plwi0m` | 11/11 stories done; merged ([PR #14](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/14)) |
| F4 — Needle mechanics | `ralph/tasks/F4-needle-mechanics.json` | needle | F0 | merged | `claude/inspiring-shannon-l7tzoc` | 9/9 stories done; merged ([PR #10](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/10)). Tuning numbers (`params.json`, catalogue stiffness) need owner review |
| F5 — Needle handling controls | `ralph/tasks/F5-needle-controls.json` | needle | F3, F4 | merged | `claude/f5-needle-controls-rk30wl` | 15/15 stories done; merged ([PR #20](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/20), [PR #22](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/22)). Draft handling numbers need owner review |
| F6 — Tissue feedback & events | `ralph/tasks/F6-tissue-feedback.json` | sim | F4 | merged | `claude/fervent-babbage-5v2fey` | 11/11 stories done; merged ([PR #21](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/21)). Tissue resistances (`tissues.json`) need owner review |
| F7 — Needle in the image | `ralph/tasks/F7-needle-image.json` | render | F2, F4 | merged | `claude/epic-ride-xvy9yc` | 8/8 stories done; merged ([PR #19](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/19)) |
| F8 — 3D see-through view | `ralph/tasks/F8-view3d.json` | view3d | F0 | merged | `claude/confident-mccarthy-e314nq` | 9/9 stories done; merged ([PR #12](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/12)) |
| F9 — Contrast injection | `ralph/tasks/F9-contrast.json` | contrast | F2, F6 | planned | `ralph/F9-contrast` | 15 stories; S1–S11 (all the logic) can loop now; S12–S15 are blocked on owner decisions (where Inject goes, nerve-root rule). Draft numbers (`src/contrast/params.json`) will need owner review |
| F10 — Procedures & scoring | `ralph/tasks/F10-procedures.json` | procedures | F1, F3, F5, F6, F9 | not planned | `ralph/F10-procedures` | Rules need owner review; completes v1 |
| F11 — Image-recognition quiz | `ralph/tasks/F11-quiz.json` | quiz (+ one render story, S12) | F1, F2 | planned | `ralph/F11-quiz` | 16 stories; S1–S11 (question files and logic) can loop now; S12–S16 (everything on screen) are blocked on one owner decision (how the quiz gets its image). Questions and explanations need owner review; real regions (F1.7) needed to see the real questions |
| F12 — App shell | `ralph/tasks/F12-app-shell.json` | app | F0 | merged | `claude/brave-bohr-c9wmq3` | 11/11 stories done; merged ([PR #11](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/11)). Re-check layout once all panels exist |

**Status values:** not planned → planned → looping → in review → merged (or: blocked — needs me)

## Can run in parallel right now
<!-- Features whose zones don't overlap and whose dependencies are merged. See docs/ARCHITECTURE.md → Work zones. -->
- **F9 (contrast) and F11 (quiz) can loop in parallel now**, each as far as its unblocked stories go (F9-S1…S11, F11-S1…S11). They use different zones (contrast, quiz) and those stories touch no shared file.
- Their blocked stories wait on the decisions under "Waiting on me → F9 and F11 planning". Once unblocked, F11-S12 is a **render-zone** story: no other render-zone work may loop at the same time (none is planned).
- **F10 (procedures)** needs F9 finished (F5 is merged).

## Waiting on me
<!-- Blocked stories, open questions, pull requests to review. -->
- **F9 and F11 planning (2026-11-14)** — decisions that unblock stories:
  - **Where Inject goes** (blocks F9-S12…S14). Recommended: beside the Aspirate button, in the same row, so the needle panel gets no taller (it fits at 1024×768). Needs `src/app/main.ts` to mount the contrast zone in the needle panel's slot, after the sim zone (an interactive change).
  - **Shared simulation clock** (F9-S12). Recommended: add it to `src/core/` in that same session and let the sim zone use it too; otherwise the contrast zone keeps its own copy of the rule ("seconds since the last case start").
  - **Contrast at a nerve root** (blocks F9-S15; clinical). In the anatomy the foramen around the nerve root is plain soft tissue, so a well-placed transforaminal needle would show a soft-tissue blob, never the epidural pattern — and F10 could not score "contrast pattern correct" for the v1 procedure. Proposed: a tip in, or within 3 mm (draft) of, a nerve root gives the epidural / nerve-root-sleeve pattern.
  - **How the quiz gets its fluoro image** (blocks F11-S12…S16). Recommended: a small shared "image service" file in `src/core/`; the render zone registers its renderer there (F11-S12) and the quiz asks it for an image.
- **F9 and F11 planning defaults** (used unless you say otherwise):
  - F9: one press of Inject = 0.1 mL (50 presses for 5 mL; no hold-to-repeat). Each press is one event of 0.1 mL; its message ("Contrast injected — 0.1 mL") does not name the compartment. Intravascular contrast is fully there for 1.5 s and then gone (no gradual fade). A full joint takes no more contrast. Tissues the spec does not list (skin/fat, disc, ligamentum flavum, nerve root, spinal cord) behave like muscle. Contrast is cleared when a new case starts or another region is loaded.
  - F11: a "structure" is one of the landmark points the anatomy files hold (vertebral body, pedicle, endplates, superior articular process, foramen, sacrum top, iliac crest) — the spec says "label + level + side". Questions store the two angles; the table position is worked out so the structure (or a chosen neighbour) is centred. A separate 12-question phantom set is used by tests and whenever no real region exists. Choices are not shuffled. The quiz seed is fixed in test builds and the clock time in the real build.
- **Gaps found while planning F9 and F11** (docs not changed):
  - Injection events go out on the bus, but the needle panel's event log (sim zone) lists only the sim zone's own events. Showing injections there is a small sim-zone change — say if you want it.
  - Free play never starts a "new case", so contrast (and the 5 mL total) stays until the page is reloaded or the region changes. The shot counters have the same gap. A "New case" / reset button in Free play is not in the spec.
  - No C1/C2, sacral hiatus, sacral foramina or SI-joint landmarks, so the quiz cannot point its arrow at them (SPEC → Open questions). They can appear only in "name this view" questions.
  - Until F1.7 (real CT), the 40 real quiz questions cannot be seen in the app, and their angles cannot be checked on real anatomy.
  - The quiz loads a question's region into the one shared store, so after a quiz Free play shows the last quiz region. Switching between three real regions inside one quiz may be slow on tablets (each is up to 25 MB).
  - On the quiz screen the spacebar still takes a (hidden) simulator shot instead of pressing the focused button — the known "C-arm keys off the simulator screen" gap below. Mouse, touch and Enter work.
  - The shared "tissue label at a point" helper is not needed for F9 after all: contrast needs the voxel itself, not just its label, so it has its own small grid code.
- On a tablet, check that the depth / bevel / angle readouts inside the needle control pad (12 px text) are easy to read (from F5's last pull request, now merged).
- **F5 draft handling numbers** (yours to tune): pad drag 0.2° per pixel (`src/needle/pad.ts`); Advance/Withdraw hold delay 300 ms and 5 mm/s (`src/needle/holdButtons.ts`).
- **The needle panel is full:** needle controls (two rows) plus the sim zone's resistance, Aspirate and event log just fit at 1024×768. A new control there needs a layout decision (e.g. giving the needle panel more height, an F12 change).
- F4, F8 and F12 planning questions: all answered 2026-11-11 (you accepted every default; recorded in `docs/DECISIONS.md`). The shared contract now has `store.procedures`, `procedureRequest` and `attemptFinished`.
- Gaps found while planning F4, F8 and F12 (docs not changed):
  - Shortcuts off the simulator screen: the C-arm keys should read `data-screen` and ignore keys on other screens — a later change in the C-arm zone. (The F5 needle keys already do.)
  - No shared "tissue label at a point" helper in `src/core/`: the needle zone has its own, and F6 plans the sim zone's own copy (F6-S2), so loops are not blocked. (F9 planning 2026-11-14: contrast does not need it; see above.)
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
- **F2 is merged** ([PR #8](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/8)). Points from its review that are still open:
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

2026-11-11 (same session) owner accepted every F4/F8/F12 planning default. Recorded in `docs/DECISIONS.md` and `docs/ARCHITECTURE.md`; shared contract extended in `src/core/` with tests (`store.procedures`, bus events `procedureRequest` and `attemptFinished`); F12-S10 and F12-S11 unblocked. F2 marked merged in the roadmap.

2026-11-12 F5, F6 and F7 planned (task files + empty progress logs): F5 11 stories, F6 11, F7 7; 8 stories blocked on owner decisions (see "Waiting on me → F5–F7 planning") and 1 by design (F5-S11). No application code was written. Roadmap brought up to date: F3, F4, F8 and F12 merged; F1 still looping.

2026-11-13 (same planning branch) owner accepted every F5–F7 default. Recorded in `docs/DECISIONS.md` and `docs/ARCHITECTURE.md`; shared contract extended with a test (`tests/core/contract-2026-11-13.test.ts`): optional `NeedleState.boneContact` and the bus event `imageTap`. `src/app/main.ts` now mounts the sim zone into the needle panel slot. 7 stories unblocked; only F5-S11 stays blocked (by design).

2026-11-13 merged main (F1 finished: [PR #15](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/15)) into the planning branch; F1 marked merged except S22 (real CT, with the owner).

2026-11-13 F5–F7 story review (branch `claude/review-task-spec-pn33bp`): the owner approved all 13 fixes. Only task files and docs changed, no application code. Needle entry on the detector-side (back) skin, needle pointing against the beam, angle to the beam between lines; F5-S3, F5-S9 and F7-S3 split (new F5-S12, F5-S13, F7-S8); end-to-end checks F5-S14 and F5-S15 added, blocked by design; missing tests and clearer wording; F6-S8 depends on F6-S6; Aspirate random numbers made at mount; "Intravascular" message without the vessel kind; F7-S7 moved earlier. SPEC F6.1 wording now matches the 2026-11-13 decision (names in Practice and Free play).

2026-11-14 F5, F6 and F7 merged into main: F7 ([PR #19](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/19)), F5 stories S1–S13 ([PR #20](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/20)), F6 ([PR #21](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/21)). Together they broke one test on main: F6's event log ran past the bottom of the needle panel. The owner chose to compact the needle controls into two rows (`docs/DECISIONS.md`, 2026-11-14), with no test changed. F5-S11, S14 and S15 were then unblocked and done by the loop (test only); all 15 F5 stories are done and in review ([PR #22](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/22)). Final check: 599 unit and 547 screen tests passed. Next: merge PR #22, then plan F9 and/or F11.

2026-11-14 F5's last pull request merged ([PR #22](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/22)); F5 marked merged. F9 and F11 planned (task files + empty progress logs): F9 15 stories (4 blocked), F11 16 stories (5 blocked, one of them in the render zone). No application code was written. Checked while planning: an Inject button fits beside Aspirate at 1024×768; the phantom test points and spread sizes quoted in the F9 stories were measured. Next: answer the four decisions under "Waiting on me → F9 and F11 planning"; the unblocked stories of both features can loop in parallel meanwhile.
