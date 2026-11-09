# Plan & roadmap

> The bird's-eye view of progress. Updated in interactive sessions (not by loop rounds, so parallel loops never collide on this file). The detailed stories live in `ralph/tasks/`.

## Roadmap

| Feature | Task file | Zone(s) | Depends on | Status | Branch | Notes |
|---|---|---|---|---|---|---|
| F0 — Walking skeleton | `ralph/tasks/F0-skeleton.json` | all (sets up shared files) | — | planned | `ralph/F0-skeleton` | Must be merged before anything else. 15 stories; round limit 20 |
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
- Nothing yet. F0 is planned and must be looped and merged first, on its own (it creates every shared file).
- After F0 is merged: F1, F2, F3, F4, F8 and F12 (all different zones, all only depend on F0).

## Waiting on me
<!-- Blocked stories, open questions, pull requests to review. -->
- Open questions in `docs/SPEC.md` → "Open questions": app name, choosing the CT scan(s) (before F1.7).
- Next step: run the F0 loop (Prompt 4, round limit 20). The F0 stories were reviewed and fixed on 2026-11-09.
- Before merging F0: read `src/core/types.ts` against F0-S4's field list (it can only change in an interactive session afterwards).

## Handoff note (interactive sessions)
<!-- Where we stopped, anything half-finished, what the next session should check first. -->
2026-11-09 kickoff: interview done, and these are written: SPEC (F0–F12), ARCHITECTURE (zones + shared files), DECISIONS (stack, anatomy, no-login, desktop+tablet, Playwright pin, clinical review), CLAUDE.md (stack + commands) and the `.claude/settings.json` allow list. No application code exists yet. The npm scripts named in CLAUDE.md (`dev`, `test`, `test:e2e`, `lint`, `typecheck`, `check`, `build`, `anatomy:convert`) must be created by F0. `anatomy:convert` is a placeholder in F0 (F0.10, owner decision 2026-11-09); F1 builds the real converter behind it.

2026-11-09 F0 story review: applied the 10 approved fixes. F0 now has 15 stories (renumbered S1–S15 in priority order; phantom and GPU image each split in two). Shared contracts extended (Landmarks, Mode, quiz-friendly AttemptRecord, more store slots and bus events). Oblique sign decided: positive = right (detector toward the patient's right). No jsdom/happy-dom: unit-tested logic stays browser-free.
