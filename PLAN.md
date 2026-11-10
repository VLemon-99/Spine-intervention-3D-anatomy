# Plan & roadmap

> The bird's-eye view of progress. Updated in interactive sessions (not by loop rounds, so parallel loops never collide on this file). The detailed stories live in `ralph/tasks/`.

## Roadmap

| Feature | Task file | Zone(s) | Depends on | Status | Branch | Notes |
|---|---|---|---|---|---|---|
| F0 — Walking skeleton | `ralph/tasks/F0-skeleton.json` | all (sets up shared files) | — | merged | `claude/sharp-wozniak-jbi9yp` | Merged 2026-11-10 ([PR #4](https://github.com/VLemon-99/Spine-intervention-3D-anatomy/pull/4)). 15/15 stories done, plus a disclaimer keyboard fix from review |
| F1 — Anatomy data | `ralph/tasks/F1-anatomy.json` | anatomy | F0 | not planned | `ralph/F1-anatomy` | F1.7 (real CT) is an interactive session with the owner |
| F2 — Fluoro renderer | `ralph/tasks/F2-renderer.json` | render | F0 | not planned | `ralph/F2-renderer` | |
| F3 — C-arm, table & exposure | `ralph/tasks/F3-carm.json` | carm | F0 | not planned | `ralph/F3-carm` | |
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
- F0 is merged, so these can be planned and looped in parallel (all different zones, all only depend on F0): **F1, F2, F3, F4, F8 and F12**.
- Suggested first batch: F2 + F3 (visible progress: C-arm controls and a better image), optionally F4. F1 can wait until the owner has time to choose the CT scan (F1.7).
- Afterwards: F5 needs F3 + F4; F6 needs F4; F7 needs F2 + F4 (and runs after F2, same zone); F11 needs F1 + F2.

## Waiting on me
<!-- Blocked stories, open questions, pull requests to review. -->
- Open questions in `docs/SPEC.md` → "Open questions": app name, choosing the CT scan(s) (before F1.7).
- Next step: plan F1, F2, F3, F4, F8 and F12 in a fresh session (Prompt 2: "Follow `ralph/PROMPT_plan.md`. Only plan features F1, F2, F3, F4, F8 and F12."), then check the stories (Prompt 3).
- Not yet approved (proposed by the F0 loop, see the story notes in `ralph/tasks/F0-skeleton.json`): extra dev packages `@types/node`, `@eslint/js` and `tsx`, TypeScript 6 instead of 7; the contrast volume stored at 8-bit precision (may need revisiting in F9); level names in shared data as text ('L4'); and the rest of the `src/core/types.ts` field choices (F0-S4 notes). Approve or change them in an interactive session — `src/core/` changes are shared-file changes.
- Optional: `npm audit` reports 10 moderate warnings, all inside the lint tool (ESLint / typescript-eslint, via minimatch); nothing reaches the app. Fix by updating those packages in an interactive session with the full test suite. Never use `npm audit fix --force` (it downgrades ESLint and breaks the version pins).
- Real-tablet check on an iPad once F2 and F3 are merged (SPEC → Open questions).

## Handoff note (interactive sessions)
<!-- Where we stopped, anything half-finished, what the next session should check first. -->
2026-11-09 kickoff: interview done, and these are written: SPEC (F0–F12), ARCHITECTURE (zones + shared files), DECISIONS (stack, anatomy, no-login, desktop+tablet, Playwright pin, clinical review), CLAUDE.md (stack + commands) and the `.claude/settings.json` allow list. No application code exists yet. The npm scripts named in CLAUDE.md (`dev`, `test`, `test:e2e`, `lint`, `typecheck`, `check`, `build`, `anatomy:convert`) must be created by F0. `anatomy:convert` is a placeholder in F0 (F0.10, owner decision 2026-11-09); F1 builds the real converter behind it.

2026-11-09 F0 story review: applied the 10 approved fixes. F0 now has 15 stories (renumbered S1–S15 in priority order; phantom and GPU image each split in two). Shared contracts extended (Landmarks, Mode, quiz-friendly AttemptRecord, more store slots and bus events). Oblique sign decided: positive = right (detector toward the patient's right). No jsdom/happy-dom: unit-tested logic stays browser-free.

2026-11-10 F0 merged (PR #4). Review found one bug (keyboard could reach the app behind the disclaimer), fixed with two new screen tests before merging. Owner ran the app locally on a Mac: the first image renders correctly on a real GPU. Merge wrap-up: lessons promoted into `CLAUDE.md` (tool versions, screen tests, 3D graphics); decisions recorded (image orientation, C-arm numbers, disclaimer wording). Accepted from review: F0-S14 added the shared helper `tests/fixtures/simPage.ts` without its story saying so; F0 ran alone so nothing collided. F0 ran on the cloud branch `claude/sharp-wozniak-jbi9yp`, not `ralph/F0-skeleton` (allowed by `ralph/PROMPT_build.md` step 2). Note for F3: the spacebar shortcut currently takes a shot whenever focus is not in a text field, so focused checkboxes/toggles added later would lose space to it.
