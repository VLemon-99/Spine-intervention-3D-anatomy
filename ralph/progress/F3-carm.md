# Progress log — F3 C-arm, table and exposure

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

## Round — 2026-11-10 13:08 — F3-S1 — done
- What I did: Added POSE_LIMITS (F3.1 ranges), clampPose (clamps each value, non-finite → 0, returns a new object) and changePose(store, patch) which merges the patch into the current pose, clamps it and stores a new pose object.
- Files touched: src/carm/limits.ts, tests/carm/limits.test.ts, ralph/tasks/F3-carm.json, ralph/progress/F3-carm.md
- Test result: verify (tests/carm/limits.test.ts) 10/10 passed; npm run check green (24 unit files / 93 tests, 46 screen tests passed, 6 skipped by set-up).
- Next round should know: Sliders/keys should call changePose(store, { field: value }) from src/carm/limits.ts and read ranges from POSE_LIMITS. The session runs on branch claude/ralph-loop-f3-carm-plwi0m (cloud session's own branch), not ralph/F3-carm.
