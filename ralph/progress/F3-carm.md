# Progress log — F3 C-arm, table and exposure

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- Touch drag on a range input works in the tablet set-up with a CDP session: Input.dispatchTouchEvent touchStart / touchMove steps / touchEnd (see tests/e2e/carm/controls.ts). Starting a little off the handle is fine: Chromium jumps the handle to the touch point.

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

## Round — 2026-11-10 13:12 — F3-S2 — done
- What I did: Added src/carm/sliders.ts (buildSliders(store)): five range inputs (step 1, ranges from POSE_LIMITS), each with a label, end labels (L/R, CAUD/CRAN, R/L for table left/right since + = toward the patient's left, FOOT/HEAD, DOWN/UP; test ids slider-<id>-min-label / -max-label) and an <output> readout ('25°', '-10°', '15 mm'). Input events go through changePose; a store subscription keeps sliders and readouts in step with the pose. In index.ts the title and the Shot button now share one header row. Added tests/e2e/carm/controls.ts with dragSlider(page, testId, fraction) — mouse drag on desktop, CDP Input.dispatchTouchEvent on tablet; fractions <0 or >1 drag past the end.
- Files touched: src/carm/sliders.ts, src/carm/index.ts, tests/e2e/carm/controls.ts, tests/e2e/carm/sliders.spec.ts, ralph/tasks/F3-carm.json, ralph/progress/F3-carm.md
- Test result: verify 30/30 passed (both set-ups); npm run check green (93 unit tests, 76 screen tests passed, 6 skipped by set-up).
- Next round should know: Slider rows are 44 px tall with a 2 px gap; header row 44 px. Roughly 80 px of the tablet panel (~372 px tall) is left for counters, pedal, region picker and help button — put those side by side in the header or one extra row. Range inputs have touch-action: none.

## Round — 2026-11-10 13:15 — F3-S3 — done
- What I did: Added src/carm/keymap.ts with POSE_KEYS (code, label, field, sign, kind, action) for J/L, I/K, N/M, U/O, Y/H, stepSize() and stepPose(pose, code, shift) (clamped; null for non-pose keys). Wired a keydown listener in src/carm/index.ts: same rules as the spacebar (disclaimer, typing), ignores Ctrl/Alt/Meta combinations, key repeat keeps stepping, goes through changePose.
- Files touched: src/carm/keymap.ts, src/carm/index.ts, tests/carm/keymap.test.ts, tests/e2e/carm/shortcuts.spec.ts, ralph/tasks/F3-carm.json, ralph/progress/F3-carm.md
- Test result: verify 34 unit + 3 desktop screen tests passed (3 skipped on tablet by design); npm run check green (127 unit tests, 79 screen tests passed, 9 skipped by set-up).
- Next round should know: The help overlay (F3-S4) can build its 'C-arm' group from POSE_KEYS (label + action) and stepSize(). stepPose returns CArmPose | null, so tests need ?. before indexing (tsc strict).
