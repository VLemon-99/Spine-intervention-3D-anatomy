# Plan & roadmap

> The bird's-eye view of progress. Updated in interactive sessions (not by loop rounds, so parallel loops never collide on this file). The detailed stories live in `ralph/tasks/`.

## Roadmap

| Feature | Task file | Zone(s) | Depends on | Status | Branch | Notes |
|---|---|---|---|---|---|---|
| F0 — Walking skeleton | `ralph/tasks/F0-skeleton.json` | all (sets up shared files) | — | merged | `claude/sharp-wozniak-jbi9yp` | Merged 2026-11-10 ([PR #4](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/4)). 15/15 stories done, plus a disclaimer keyboard fix from review |
| F1 — Anatomy data | `ralph/tasks/F1-anatomy.json` | anatomy | F0 | planned | `ralph/F1-anatomy` | 22 stories; 20 for the loop. Blocked from the start: S21 (region picker hook-up, needs a shared-contract change + F3) and S22 (F1.7, real CT — interactive session with the owner) |
| F2 — Fluoro renderer | `ralph/tasks/F2-renderer.json` | render | F0 | planned | `ralph/F2-renderer` | 21 stories; 20 for the loop. Blocked from the start: S21 (higher noise for fluoro frames on screen, needs a shared-contract change + F3) |
| F3 — C-arm, table & exposure | `ralph/tasks/F3-carm.json` | carm | F0 | planned | `ralph/F3-carm` | 10 stories; 9 for the loop. Blocked from the start: S10 (switching between real regions, needs a shared-contract change + F1). F3.3 is already covered by F0's tests |
| F4 — Needle mechanics | `ralph/tasks/F4-needle-mechanics.json` | needle | F0 | not planned | `ralph/F4-needle-mechanics` | Tuning needs owner review |
| F5 — Needle handling controls | `ralph/tasks/F5-needle-controls.json` | needle | F3, F4 | not planned | `ralph/F5-needle-controls` | |
| F6 — Tissue feedback & events | `ralph/tasks/F6-tissue-feedback.json` | sim | F4 | not planned | `ralph/F6-tissue-feedback` | |
| F7 — Needle in the image | `ralph/tasks/F7-needle-image.json` | render | F2, F4 | not planned | `ralph/F7-needle-image` | |
| F8 — 3D see-through view | `ralph/tasks/F8-view3d.json` | view3d | F0 | not planned | `ralph/F8-view3d` | |
| F9 — Contrast injection | `ralph/tasks/F9-contrast.json` | contrast | F2, F6 | not planned | `ralph/F9-contrast` | |
| F10 — Procedures & scoring | `ralph/tasks/F10-procedures.json` | procedures | F1, F3, F5, F6, F9 | not planned | `ralph/F10-procedures` | Rules need owner review; completes v1 |
| F11 — Image-recognition quiz | `ralph/tasks/F11-quiz.json` | quiz | F1, F2 | not planned | `ralph/F11-quiz` | Explanations need owner review |
| F12 — App shell | `ralph/tasks/F12-app-shell.json` | app | F0 | not planned | `ralph/F12-app-shell` | Re-check layout once all panels exist |

**Status values:** not planned → planned → looping → in review → merged (or: blocked — needs me)

## Can run in parallel right now
<!-- Features whose zones don't overlap and whose dependencies are merged. See docs/ARCHITECTURE.md → Work zones. -->
- **F1, F2 and F3 are planned and can loop in parallel now**: three different zones (anatomy, render, carm), all depend only on F0, and none of their loop stories changes a shared file. Each adds its own screen-test helpers inside its own `tests/e2e/<zone>/` folder instead of touching `tests/fixtures/`.
- Still to plan, and also parallel-safe after F0: **F4, F8 and F12**.
- Four stories are blocked from the start because they cross zones or need the owner (F1-S21, F1-S22, F2-S21, F3-S10). The loops skip them and say so in their pull requests; see "Waiting on me".
- Afterwards: F5 needs F3 + F4; F6 needs F4; F7 needs F2 + F4 (and runs after F2, same zone); F11 needs F1 + F2.

## Waiting on me
<!-- Blocked stories, open questions, pull requests to review. -->
- Open questions in `docs/SPEC.md` → "Open questions": app name, choosing the CT scan(s) (before F1.7).
- Next step: check the F1, F2 and F3 stories (Prompt 3), then start their loops. Still to plan: F4, F8 and F12.
- **Shared-contract change to approve (blocks F1-S21, F2-S21, F3-S10).** Zones may only talk through `src/core/`, and two things are missing there. Proposal, to do in one short interactive session (before or after the loops — the loops don't wait for it):
  - a store field `lastImageKind: 'shot' | 'fluoro' | null`, set by the C-arm when it takes an image, so the renderer can use more noise for fluoro frames (F2.6);
  - a store field `regions: { name, title }[]` filled by the anatomy zone, plus a bus event `regionRequest` (region name) sent by the region picker, so the picker (F3.7) can ask the loader (F1.6) for a region.
- Open questions from F1–F3 planning (the plan uses the stated default until you say otherwise):
  - **C-arm keys** (F3.2 names none). Default: J/L oblique, I/K tilt, N/M table right/left, U/O table head/feet, Y/H table up/down — chosen to stay clear of the needle keys in F5.
  - **Pose text at 0°** (F2.9). Default: "AP · TILT 0°".
  - **Region list:** once real regions exist, does "Phantom" stay in the picker, and which region loads at start?
  - **Landmarks for C1, C2, sacrum and ilium:** the shared landmark format assumes a normal vertebra (body, pedicles, endplates). F1 skips these levels for now. The caudal and SI-joint procedures (F10) will need sacral hiatus and SI-joint landmarks — a later shared-contract change.
  - **Dataset contents:** the TotalSegmentator mask names in `tools/anatomy/label-map.json` are a draft to check against the real download (F1.7). Its "spinal cord" mask is treated as thecal sac; discs have no mask as far as I know, so they would be labelled as generic soft tissue unless you want modelled discs (not in the spec). VerSe (the fallback dataset) uses a different file layout the converter stories do not cover.
  - **Noise levels, contrast darkness and all soft-tissue shape numbers** are drafts for you to tune.
- Spec/architecture wording to update if you agree (not changed yet): SPEC F2 does not say the magnification, collimation and flip/rotate controls sit in the fluoro panel, that Invert/flip/rotate act immediately, or that the pose text shows the image's pose; ARCHITECTURE says F3 depends only on F0, but switching real regions (part of F3.7) also needs F1.
- Not yet approved (proposed by the F0 loop, see the story notes in `ralph/tasks/F0-skeleton.json`): extra dev packages `@types/node`, `@eslint/js` and `tsx`, TypeScript 6 instead of 7; the contrast volume stored at 8-bit precision (may need revisiting in F9); level names in shared data as text ('L4'); and the rest of the `src/core/types.ts` field choices (F0-S4 notes). Approve or change them in an interactive session — `src/core/` changes are shared-file changes.
- Optional: `npm audit` reports 10 moderate warnings, all inside the lint tool (ESLint / typescript-eslint, via minimatch); nothing reaches the app. Fix by updating those packages in an interactive session with the full test suite. Never use `npm audit fix --force` (it downgrades ESLint and breaks the version pins).
- Real-tablet check on an iPad once F2 and F3 are merged (SPEC → Open questions).

## Handoff note (interactive sessions)
<!-- Where we stopped, anything half-finished, what the next session should check first. -->
2026-11-09 kickoff: interview done, and these are written: SPEC (F0–F12), ARCHITECTURE (zones + shared files), DECISIONS (stack, anatomy, no-login, desktop+tablet, Playwright pin, clinical review), CLAUDE.md (stack + commands) and the `.claude/settings.json` allow list. No application code exists yet. The npm scripts named in CLAUDE.md (`dev`, `test`, `test:e2e`, `lint`, `typecheck`, `check`, `build`, `anatomy:convert`) must be created by F0. `anatomy:convert` is a placeholder in F0 (F0.10, owner decision 2026-11-09); F1 builds the real converter behind it.

2026-11-09 F0 story review: applied the 10 approved fixes. F0 now has 15 stories (renumbered S1–S15 in priority order; phantom and GPU image each split in two). Shared contracts extended (Landmarks, Mode, quiz-friendly AttemptRecord, more store slots and bus events). Oblique sign decided: positive = right (detector toward the patient's right). No jsdom/happy-dom: unit-tested logic stays browser-free.

2026-11-10 F1–F3 planned (task files + empty progress logs). The owner had no preference on four planning questions, so the recommended options were adopted and recorded in `docs/DECISIONS.md`. No application code was written; `npm install` was not run in that session.

2026-11-10 F0 merged (PR #4). Review found one bug (keyboard could reach the app behind the disclaimer), fixed with two new screen tests before merging. Owner ran the app locally on a Mac: the first image renders correctly on a real GPU. Merge wrap-up: lessons promoted into `CLAUDE.md` (tool versions, screen tests, 3D graphics); decisions recorded (image orientation, C-arm numbers, disclaimer wording). Accepted from review: F0-S14 added the shared helper `tests/fixtures/simPage.ts` without its story saying so; F0 ran alone so nothing collided. F0 ran on the cloud branch `claude/sharp-wozniak-jbi9yp`, not `ralph/F0-skeleton` (allowed by `ralph/PROMPT_build.md` step 2). Note for F3: the spacebar shortcut currently takes a shot whenever focus is not in a text field, so focused checkboxes/toggles added later would lose space to it.
