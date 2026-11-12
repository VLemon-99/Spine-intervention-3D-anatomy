# Progress log — F3 C-arm, table and exposure

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- Touch drag on a range input works in the tablet set-up with a CDP session: Input.dispatchTouchEvent touchStart / touchMove steps / touchEnd (see tests/e2e/carm/controls.ts). Starting a little off the handle is fine: Chromium jumps the handle to the touch point.

- CDP multi-touch: Input.dispatchTouchEvent touchStart / touchMove list EVERY finger on the screen, but touchEnd must list only the finger(s) being lifted — listing the remaining fingers lifts those instead (see touchScreen() in tests/e2e/carm/controls.ts).
- Throwaway debug specs: create them with the Write tool and delete with a plain `rm <file>`; a combined mkdir + heredoc + rm -rf command was refused by the permission check.
- getSimState() in tests/fixtures/simPage.ts is typed without `volume` (shared fixture, do not edit); read volume through page.evaluate with the SimHook type from src/core/testHook.ts (see regionPicker.spec.ts).

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

## Round — 2026-11-10 13:18 — F3-S4 — done
- What I did: Added src/carm/help.ts: carmShortcutEntries() builds the 'C-arm' group from POSE_KEYS (paired per value, with step sizes) plus Shift, Space, F (hold) and ?; buildHelp(shortcuts) makes the overlay (test id help-overlay, role dialog, fixed over the page; one section test id help-group per registered group, with an h3 heading and <kbd> keys) and the '?' button (help-button, 44×44, aria-expanded). The overlay re-renders on shortcuts.subscribe. index.ts registers the group, puts '?' next to Shot in the header row, and adds a keydown listener: ? toggles (matched by event.key, not code, because ? moves between layouts), Escape closes; same disclaimer/typing rules. Close button (help-close) and a click on the dimmed background close it. Pose keys and Space keep working while it is open.
- Files touched: src/carm/help.ts, src/carm/index.ts, tests/e2e/carm/help.spec.ts, ralph/tasks/F3-carm.json, ralph/progress/F3-carm.md
- Test result: verify 11 passed (3 desktop-only tests skipped on tablet); npm run check green (127 unit tests, 90 screen tests passed, 12 skipped by set-up).
- Next round should know: The C-arm panel title is also 'C-arm', so tests looking for the overlay's 'C-arm' heading must scope to help-group. Header row now holds title, '?' and Shot.

## Round — 2026-11-10 13:20 — F3-S5 — done
- What I did: Added src/carm/counters.ts: resetCounters(store), resetCountersOnCaseStart(store, bus) (returns an unsubscribe), formatFluoroTime ('0.0 s'), buildCounters(store) with shot-count and fluoro-time outputs kept in step with the store. index.ts puts the counters in the header row (title · counters · ? · Shot), wires the caseStart reset, and registers registerDebugGetter('carm', …) returning { fluoroTimeSeconds, fluoroOn: false }.
- Files touched: src/carm/counters.ts, src/carm/index.ts, tests/carm/counters.test.ts, tests/e2e/carm/counters.spec.ts, ralph/tasks/F3-carm.json, ralph/progress/F3-carm.md
- Test result: verify 4 unit + 8 screen tests passed (both set-ups); npm run check green (131 unit tests, 98 screen tests passed, 12 skipped by set-up).
- Next round should know: F3-S7 must replace the hard-coded fluoroOn: false in the 'carm' debug getter in src/carm/index.ts with the real running state. Screen tests emit bus events by importing '/src/core/store.ts' in page.evaluate (see emitCaseStart in counters.spec.ts).

## Round — 2026-11-10 13:22 — F3-S6 — done
- What I did: Added src/carm/fluoro.ts: createFluoro(store, bus) → { start(nowMs), frame(nowMs), stop(nowMs), isRunning() }. Time is added from clock differences (countedUntilMs), each frame adds time since the last counted moment, stop adds the rest; a backwards clock adds nothing. Each running frame sets lastImagePose (copy) and lastImageKind 'fluoro' in one store.set, then emits 'exposure'. start does not draw a frame by itself.
- Files touched: src/carm/fluoro.ts, tests/carm/fluoro.test.ts, ralph/tasks/F3-carm.json, ralph/progress/F3-carm.md
- Test result: verify 8/8 passed; npm run check green (139 unit tests, 98 screen tests passed, 12 skipped by set-up).
- Next round should know: Clock is in milliseconds (event.timeStamp and requestAnimationFrame's time are both ms on the performance.now() clock). F3-S7 should call frame() once right after start() if an immediate first image is wanted, and use fluoro.isRunning() for the 'carm' debug getter's fluoroOn.

## Round — 2026-11-10 13:25 — F3-S7 — done
- What I did: Added src/carm/fluoroRunner.ts: createFluoroRunner(fluoro) → { begin(timeMs), end(timeMs), isOn() }; begin starts, draws a first frame at once and runs one frame per requestAnimationFrame; end stops and cancels the frame request. index.ts: F keydown (event.code KeyF, no Ctrl/Alt/Meta, repeats ignored, disclaimer/typing rules) → begin(event.timeStamp); F keyup → end(event.timeStamp) (always, as a safety stop); window blur and visibilitychange→hidden also end. The 'carm' debug getter now reports fluoroOn from the runner.
- Files touched: src/carm/fluoroRunner.ts, src/carm/index.ts, tests/e2e/carm/fluoro.spec.ts, ralph/tasks/F3-carm.json, ralph/progress/F3-carm.md
- Test result: verify 4 passed (desktop; tablet skipped by design), stable over --repeat-each=3; npm run check green (139 unit tests, 102 screen tests passed, 16 skipped by set-up).
- Next round should know: The pedal (F3-S11) should call the same runner (fluoro.begin / fluoro.end in index.ts) with pointer event time stamps. Note: if F and the pedal are both held, releasing either one stops fluoro (the runner has no per-source count) — decide in S11 whether to track sources. The renderer has no noise yet, so canvas pixels are exactly equal when nothing is drawn.

## Round — 2026-11-10 13:31 — F3-S11 — done
- What I did: Added src/carm/pedal.ts: buildPedal(runner) → 'Fluoro' button (test id fluoro-pedal, ≥88×44, touch-action none, no text selection / long-press callout, contextmenu blocked). pointerdown (left button for mouse) → setPointerCapture + runner.begin(e.timeStamp); pointerup / pointercancel / lostpointercapture for the same pointer → runner.end(e.timeStamp). aria-pressed and the gold background follow runner.onChange (new on FluoroRunner), so they reset when fluoro stops another way (page hidden, blur). Header row: title · counters (now stacked in two lines) · ? · Shot · Fluoro. tests/e2e/carm/controls.ts now has touchScreen(page) (several fingers by id), centreOf(locator), and dragSlider(..., { screen, id }) for a second finger.
- Files touched: src/carm/pedal.ts, src/carm/fluoroRunner.ts, src/carm/counters.ts, src/carm/index.ts, tests/e2e/carm/controls.ts, tests/e2e/carm/fluoroPedal.spec.ts, ralph/tasks/F3-carm.json, ralph/progress/F3-carm.md
- Test result: verify (fluoroPedal + fluoro specs) 11 passed, 7 skipped by set-up; fluoroPedal stable over --repeat-each=3; npm run check green (139 unit tests, 109 screen tests passed, 19 skipped by set-up). F-key tests unchanged and passing.
- Next round should know: Holding F and the pedal together: releasing either stops fluoro (no per-source counting) — safe default, not tested. Tablet header width is about 382 of 484 px, leaving ~100 px; the region picker (S9) may fit at the end of the header row or as a short extra row (about 50 px of panel height remain).

## Round — 2026-11-10 13:32 — F3-S8 — done
- What I did: Added tests/e2e/carm/lastImageHold.spec.ts: take an image, record a 16×16-grid canvas fingerprint, move oblique and tilt with the sliders (plus Shift+L on desktop), check the fingerprint is identical, pose ≠ lastImagePose, lastImagePose and shot count unchanged; then one more Shot raises the count by exactly 1, sets lastImagePose to the new pose and changes the fingerprint. The behaviour already held; no app code changed.
- Files touched: tests/e2e/carm/lastImageHold.spec.ts, ralph/tasks/F3-carm.json, ralph/progress/F3-carm.md
- Test result: verify passed in both set-ups (stable over --repeat-each=2); npm run check green (139 unit tests, 111 screen tests passed, 19 skipped by set-up).
- Next round should know: Once the renderer adds noise/grain (F2), exact fingerprint equality still holds for the hold (nothing is redrawn), but "changes after a Shot" stays true too.

## Round — 2026-11-10 13:35 — F3-S9 — done
- What I did: Added src/carm/regions.ts: regionEntries(regions, loadedName) (copies of the listed regions, plus the loaded region if missing, titled 'Phantom' for 'phantom', else its name) and buildRegionPicker(store) (<select> test id region-picker, ≥44 px tall, rebuilt when store.regions or volume.region changes, selects the loaded region). index.ts adds a 'Region' row under the sliders. No switching yet (S10).
- Files touched: src/carm/regions.ts, src/carm/index.ts, tests/carm/regions.test.ts, tests/e2e/carm/regionPicker.spec.ts, ralph/tasks/F3-carm.json, ralph/progress/F3-carm.md
- Test result: verify 5 unit + 4 screen tests passed (both set-ups); npm run check green (144 unit tests, 115 screen tests passed, 19 skipped by set-up).
- Next round should know: For S10, add a 'change' listener on the picker: if select.value differs from the loaded region, emit bus 'regionRequest' once, then set select.value back to the loaded region (the picker keeps showing what is loaded until a new volume arrives). The region row fits inside the tablet panel (checked by the screen test).

## Round — 2026-11-12 22:38 — F3-S10 — done
- What I did: buildRegionPicker(store, bus) now listens for 'change': it puts the picker back on the loaded region (store volume) and, if the picked region differs, emits exactly one 'regionRequest' with its name. Nothing is loaded by the picker, no image is taken, counters are untouched; when a new volume arrives the picker follows the store (and 'Phantom' drops out once a real region is loaded — owner decision 2026-11-12). Unit tests for cervical + lumbosacral with phantom / lumbosacral loaded; screen tests fill store.regions, record regionRequest on the bus and put a renamed volume in the store via '/src/core/store.ts'.
- Files touched: src/carm/regions.ts, src/carm/index.ts, tests/carm/regions.test.ts, tests/e2e/carm/regionSwitch.spec.ts, ralph/tasks/F3-carm.json, ralph/progress/F3-carm.md
- Test result: verify (regions unit 7/7, regionSwitch 8/8, npm run check) green: 319 unit tests, 349 screen tests passed, 19 skipped by set-up. (The branch now includes main as of 2026-11-12: F2, F4, F12.)
- Next round should know: All F3 stories are done. Loading lumbosacral at start and the end-to-end check with the real loader are F1 work (F1-S27).
