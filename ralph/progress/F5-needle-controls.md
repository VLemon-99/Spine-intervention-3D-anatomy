# Progress log — F5 Needle handling controls

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- `window.__sim.needle()` is null whenever no needle is placed (F5-S13 expects null after Withdraw fully). Screen tests that need needleId/preBend first place an uninserted needle (markEntry at depth 0) through the dev server's `/src/needle/session.ts` module; picking a needle/pre-bend at depth 0 rebuilds it at the same entry.
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
