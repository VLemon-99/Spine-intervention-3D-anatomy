# Progress log — F5 Needle handling controls

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- `window.__sim.needle()` is null whenever no needle is placed (F5-S13 expects null after Withdraw fully). Screen tests that need needleId/preBend first place an uninserted needle (markEntry at depth 0) through the dev server's `/src/needle/session.ts` module; picking a needle/pre-bend at depth 0 rebuilds it at the same entry.
- Zone screen-test helpers live in tests/e2e/needle/needlePage.ts: `readNeedle`, `waitForVolume`, `markEntryAtPixel`, `advanceNeedle` (wait for the volume after acceptDisclaimer; take an image before marking).
- Chromium turns Shift + wheel into a sideways scroll (deltaX), so wheel handlers read deltaY, falling back to deltaX.
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
