# Progress log — F5 Needle handling controls

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- `window.__sim.needle()` is null whenever no needle is placed (F5-S13 expects null after Withdraw fully). Screen tests that need needleId/preBend first place an uninserted needle (markEntry at depth 0) through the dev server's `/src/needle/session.ts` module; picking a needle/pre-bend at depth 0 rebuilds it at the same entry.
- Zone screen-test helpers live in tests/e2e/needle/needlePage.ts: `readNeedle`, `waitForVolume`, `markEntryAtPixel`, `advanceNeedle` (wait for the volume after acceptDisclaimer; take an image before marking).
- Chromium turns Shift + wheel into a sideways scroll (deltaX), so wheel handlers read deltaY, falling back to deltaX.
- To test "does not scroll the page" on the tablet, first make the page scrollable in the test (html overflow auto + a 3000 px spacer); a swipe off the pad then scrolls ~250 px, so the check is meaningful.
- The needle panel is full (decision 2026-11-14): needle rows are set-up (44 px) + steering (56 px, readouts inside the pad); the sim feedback fills the rest. Don't add rows; at 1024×768 the readouts use 230 of 233 px with the deepest needle.
- The app's session (`needleSession`) notifies through `needleSession.subscribe(listener)`; UI parts subscribe to stay in step (disabled while locked).

## Rounds
<!--
## Round — YYYY-MM-DD HH:MM — F1-S1 — done | failed | blocked
- What I did:
- Files touched:
- Test result:
- Next round should know:
-->

## Round — 2026-11-13 04:30 — F5-S1 — done
- What I did: added `skinEntry(volume, ray)` in `src/needle/entry.ts`. It clips the ray to the voxel grid's box, starts at the detector-side edge, walks back toward the source in half-voxel steps, and bisects the last step to within 0.1 mm. Returns the tissue-side point (so 1 voxel further toward the detector is air), or null if no tissue.
- Files touched: src/needle/entry.ts, tests/needle/entry.test.ts
- Test result: entry tests 5/5; full unit suite 495 passed; lint + typecheck clean; screen tests passed.
- Next round should know: `skinEntry` returns a point on the tissue side of the boundary. `Ray` type is exported from `src/core/geometry.ts`.

## Round — 2026-11-13 04:45 — F5-S2 — done
- What I did: added `createNeedleSession(volume)` in `src/needle/session.ts`, wrapping the F4 model. Calls return 'ok' | 'locked' | 'rejected' | 'ignored' | 'noNeedle'. markEntry builds the model with direction = −beamDirection. Changing needle/pre-bend while an uninserted needle sits at an entry rebuilds it at the same entry. choosePreBend returns 'ignored' for the curved-tip cannula. Hub angles clamped to ±45° (MAX_HUB_ANGLE_DEG). Fixed the CreateNeedleInput.direction comment in model.ts (comment only).
- Files touched: src/needle/session.ts, src/needle/model.ts (comment), tests/needle/session.test.ts
- Test result: session tests 7/7; unit suite 502 passed; lint + typecheck clean; screen tests 409 passed, 25 skipped.
- Next round should know: the session's `volume` is a writable property (advance returns 'rejected' without one). F5-S3 must export the app's one `needleSession` from session.ts and keep `volume` in sync with store.volume. "Locked" = model exists with depth > 0 (withdrawing back to 0 also unlocks).

## Round — 2026-11-13 04:55 — F5-S3 — done
- What I did: added `subscribe` and the app-wide `needleSession` to src/needle/session.ts; src/needle/storeLink.ts (`linkNeedleToStore`: publishes NeedleState to store.needle on each change, keeps session.volume = store.volume, removes the needle on caseStart and on a different volume); src/needle/pickers.ts (needle-select, prebend-select; disabled while locked, pre-bend disabled for the curved cannula); index.ts mounts the row, links once and registers the 'needle' getter.
- Files touched: src/needle/{session,storeLink,pickers,index}.ts, tests/needle/storeLink.test.ts, tests/e2e/needle/pickers.spec.ts
- Test result: verify passed (pickers 7 passed + 1 skipped; storeLink 3/3); npm run check: 505 unit, 416 screen tests passed.
- Next round should know: pickers.spec.ts has an inline `placeNeedle` helper; F5-S12 writes the shared zone helper tests/e2e/needle/needlePage.ts (later specs can use that instead).

## Round — 2026-11-13 05:05 — F5-S12 — done
- What I did: added `lastImagePose` (kept in step with the store by storeLink) and `markEntryAtPixel(pixel)` to the needle session: unproject at lastImagePose → skinEntry → markEntry against the ray. Returns 'rejected' before the first image / without a volume / on a miss, 'locked' while inserted. Wrote tests/e2e/needle/needlePage.ts and markPixel.spec.ts (0°/0° at (256,256) and oblique 20° at (240,270); tip = entry; advancing 5 mm moves the tip ≥ 4.9 mm closer to the source; nothing before the first image). Two unit tests added to session.test.ts.
- Files touched: src/needle/session.ts, src/needle/storeLink.ts, tests/needle/session.test.ts, tests/e2e/needle/needlePage.ts, tests/e2e/needle/markPixel.spec.ts
- Test result: verify 8/8; npm run check: 507 unit, 424 screen tests passed.
- Next round should know: F5-S5 (keys) is next by priority.

## Round — 2026-11-13 05:15 — F5-S5 — done
- What I did: src/needle/keys.ts (needleKeyAction(code, shift) and the 'Needle' help entries); index.ts registers the group in the shared shortcut list and adds one window keydown listener: acts only with a needle, no Ctrl/Alt/Meta, disclaimer not shown, data-screen absent or 'sim', and focus not in a text field / slider (range) / select. Up/Down = pitch ±1°, Right/Left = yaw ±1°.
- Files touched: src/needle/keys.ts, src/needle/index.ts, tests/e2e/needle/keys.spec.ts
- Test result: verify 6 passed (6 tablet skips, by design); npm run check: 507 unit, 430 screen tests passed.
- Next round should know: in keys.spec the beforeEach blurs the focused element after marking so keys reach window. Helper text uses '↑ / ↓' and '← / →' for the arrow keys.

## Round — 2026-11-13 05:25 — F5-S6 — done
- What I did: src/needle/pad.ts builds needle-pad (pointer events, touch-action none, pointer capture). Drag sets hub angles from the drag's start (start − dy·0.2°, start + dx·0.2°), clamped by the session. Wheel (non-passive, always preventDefault): deltaY<0 advances, >0 withdraws, 1 mm or 0.2 mm with Shift, one step per wheel event. Mounted after the pickers in index.ts.
- Files touched: src/needle/pad.ts, src/needle/index.ts, tests/e2e/needle/padMouse.spec.ts
- Test result: verify 4/4 (desktop only, by design); npm run check: 507 unit, 434 screen tests passed (layout tests still pass with the pad).
- Next round should know: the pad tracks a single pointer (`drag`); F5-S7 must extend it for a second finger (twist) without breaking the one-finger drag.

## Round — 2026-11-13 05:40 — F5-S7 — done
- What I did: pad.ts now tracks touch pointers. One finger drags the hub exactly like the mouse; when a second finger lands the drag ends and a twist starts: each move rotates the bevel by the change in the angle between the two fingers (screen atan2, so clockwise on screen = +). No new drag starts until every finger is lifted. Added tests/e2e/needle/touch.ts (CDP oneFingerDrag, twist) and padTouch.spec.ts.
- Files touched: src/needle/pad.ts, tests/e2e/needle/touch.ts, tests/e2e/needle/padTouch.spec.ts
- Test result: verify 3/3 (tablet only, by design); padMouse still 4/4; npm run check: 507 unit, 437 screen tests passed.
- Next round should know: F5-S8 (Advance/Withdraw buttons) is next by priority.

## Round — 2026-11-13 05:55 — F5-S8 — done
- What I did: src/needle/holdButtons.ts: needle-advance / needle-withdraw. pointerdown moves 1 mm at once; after 300 ms a 40 ms interval moves by real elapsed time at 5 mm/s until pointerup/cancel/lost capture/window blur (a 1 s hold ≈ 4.5 mm). Keyboard activation (click with detail 0) steps 1 mm. touch-action none and no context menu on long press. index.ts puts them in a steering row: Withdraw | pad | Advance.
- Files touched: src/needle/holdButtons.ts, src/needle/index.ts, tests/e2e/needle/advanceButtons.spec.ts
- Test result: verify 5 passed (1 desktop skip, tablet-size test); npm run check: 507 unit, 442 screen tests passed.
- Next round should know: holding on the tablet in tests = CDP touchStart, wait, touchEnd (see hold() in advanceButtons.spec.ts). Next by priority: F5-S9 (readouts).

## Round — 2026-11-13 06:10 — F5-S9 — done
- What I did: src/needle/readouts.ts (lineAngleDeg: angle between lines 0–90°; needleBeamAngleDeg: hub→entry vs current pose's source→entry). src/needle/readoutRow.ts: needle-depth (toFixed(1), '—' without a needle), needle-bevel (SVG clock face, data-angle, notch needle-bevel-notch at (sin, −cos)·9), needle-beam-angle (whole degrees), kept in step through store.subscribe. needlePage.ts gained rotateBevel and setHubAngles helpers.
- Files touched: src/needle/{readouts,readoutRow,index}.ts, tests/needle/readouts.test.ts, tests/e2e/needle/{needlePage.ts,readouts.spec.ts}
- Test result: verify: unit 5/5, screen 6/6; npm run check: 512 unit, 448 screen tests passed.
- Next round should know: next by priority is F5-S13 (Withdraw fully + lock checks).

## Round — 2026-11-13 06:25 — F5-S13 — done
- What I did: src/needle/withdrawAll.ts: needle-withdraw-all button (44×44 min) calling needleSession.withdrawFully(); disabled while there is no needle. Appended to the readouts row. Screen tests: Withdraw fully → needle() null and pickers enabled; while inserted both pickers are disabled, and a forced pick (set value + dispatch change, bypassing the disabled state) leaves the needle unchanged and the picker snaps back.
- Files touched: src/needle/withdrawAll.ts, src/needle/index.ts, tests/e2e/needle/withdrawAll.spec.ts
- Test result: verify 5 passed (1 desktop skip for the tablet-size test); npm run check: 512 unit, 453 screen tests passed.
- Next round should know: next by priority is F5-S10 (boneContact in NeedleState), then F5-S4 (Mark entry tool, the last loop story).

## Round — 2026-11-13 06:40 — F5-S10 — done
- What I did: toNeedleState (src/needle/model.ts) now sets boneContact from the model's own flag (always a boolean). No other model change. New unit test over the phantom's upper lamina: false at entry and in soft tissue, true against bone (tip stays above y = 24), false after withdrawing 1 mm (red before the change, green after).
- Files touched: src/needle/model.ts, tests/needle/boneState.test.ts
- Test result: verify: boneState 1/1; npm run check: 513 unit, 453 screen tests passed; existing F4 tests unchanged and passing.
- Next round should know: the last loop story is F5-S4 (Mark entry tool, imageTap); its verify runs npm run check. After it, only the by-design blocked stories (F5-S11, S14, S15) remain.

## Round — 2026-11-13 06:55 — F5-S4 — done
- What I did: src/needle/markEntryTool.ts: mark-entry toggle button (aria-pressed shows on/off) in the set-up row. While on and usable, an 'imageTap' bus event calls needleSession.markEntryAtPixel(tap) and the tool switches off. Disabled (and switched off) before the first image (store.lastImagePose null) and while the needle is inserted. needlePage.ts gained emitImageTap and withdrawFully helpers.
- Files touched: src/needle/markEntryTool.ts, src/needle/index.ts, tests/e2e/needle/needlePage.ts, tests/e2e/needle/markEntry.spec.ts
- Test result: verify: markEntry 9 passed (1 desktop skip for the tablet-size test); npm run check: 513 unit, 462 screen tests passed. A throwaway check confirmed every needle control lies inside the needle panel at 1280×800 and 1024×768.
- Next round should know: no `todo` stories remain. F5-S11, F5-S14 and F5-S15 stay blocked by design until F6/F7 are merged (see their notes).

## Interactive fix — 2026-11-14 — baseline (needle panel overflow) — done
- What I did: the baseline after merging F5, F6 and F7 failed tests/e2e/sim/eventLog.spec.ts:42 in both set-ups (the event log ran past the needle panel). The owner chose to compact the needle controls (docs/DECISIONS.md, 2026-11-14): readouts moved inside the control pad (one nowrap line, 12 px text), Withdraw fully moved to the steering row (max 76 px wide, label wraps), one whole row removed. No test was changed.
- Files touched: src/needle/{index,pad,readoutRow,withdrawAll}.ts, docs/DECISIONS.md
- Test result: npm run check: 599 unit, 537 screen tests passed (43 skipped by set-up); the event log now ends at 753 ≤ 760 on the tablet and 757 ≤ 792 on desktop.
- Next round should know: next by priority is F5-S11.

## Round — 2026-11-14 02:00 — F5-S11 — done
- What I did: baseline was the green `npm run check` of commit fb59972 (the needle-panel fix). Added tests/e2e/needle/markEntryCanvas.spec.ts: after one image at 0°/0°, turn Mark entry on, click/tap the real fluoro-canvas at image pixel (256, 256) (canvas box × pixel/512, default display); the render zone's real imageTap marks the entry: on the back (y > 30), not air, air 1 voxel toward the detector, projects to (256, 256) within 2 px; the tool switches off. Test only, no app code changed.
- Files touched: tests/e2e/needle/markEntryCanvas.spec.ts
- Test result: verify: 2/2 (desktop + tablet); npm run check: 599 unit, 539 screen tests passed (43 skipped by set-up).
- Next round should know: next is F5-S14 (sim end to end + layout). The sim zone's screen helpers are in tests/e2e/sim/simZone.ts (getSim etc.); zone helpers are not shared, so write needle-zone versions if needed.

## Round — 2026-11-14 02:20 — F5-S14 — done
- What I did: tests/e2e/needle/simEndToEnd.spec.ts. Mark the entry at image pixel (256, 256) at 0°/0° (the midline, |x|, |z| < 0.5 mm), then advance 1 mm at a time with W (desktop) or the Advance button (tablet) until tip.y < 14: sim().tipTissue is 'epiduralSpace', the events include 'Loss of resistance' and the event log in the needle panel shows it. Layout: with that needle and events, all four panels lie inside the viewport, the page does not scroll, and needle-steer / needle-readouts / event-log end inside the needle panel. Test only, no app code changed.
- Files touched: tests/e2e/needle/simEndToEnd.spec.ts
- Test result: verify: 4/4 (2 per set-up); npm run check: 599 unit, 543 screen tests passed (43 skipped by set-up).
- Next round should know: last story is F5-S15 (needle in the image end to end). The render zone's getter is window.__sim.render() with lastImage.needleTip; tests/e2e/fixtures/readCanvas.ts reads canvas grey values.
