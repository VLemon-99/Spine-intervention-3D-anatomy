# Progress log — F4 Needle mechanics

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- JSON imports (`import x from './file.json'`) type-check without tsconfig changes (moduleResolution bundler). Validators take `unknown` and return the typed data; tests break a deep copy of the committed JSON to check each rejection.
- `npm run check` takes about 2.5 minutes; run it with a long timeout (e.g. 400000 ms).

## Rounds
<!--
## Round — YYYY-MM-DD HH:MM — F1-S1 — done | failed | blocked
- What I did:
- Files touched:
- Test result:
- Next round should know:
-->

## Round — 2026-11-11 06:50 — F4-S1 — done
- What I did: added the needle catalogue (six needles from F4.1, draft stiffness ≈ outer diameter⁴, 22G = 1), params.json (stepMm 0.25, a draft stiffness per tissue key, air 0), and src/needle/data.ts with hand-written validators that list every problem, plus typed exports `catalogue`, `params` and `needleSpec(id)`.
- Files touched: src/needle/catalogue.json, src/needle/params.json, src/needle/data.ts, tests/needle/data.test.ts, this log, the task file.
- Test result: data.test.ts 12/12; npm run check passed (unit 188, screen 186 passed / 6 skipped).
- Next round should know: validateParams rejects unknown tissue keys inside tissueStiffness; new top-level params fields must be added to the NeedleParams type and validator (they are not rejected if unknown). The curved RF cannula is 20G, 100 mm, tipCurveDeg 15 (drafts).

## Round — 2026-11-11 06:56 — F4-S2 — done
- What I did: added src/needle/model.ts (createNeedle, setHubAngles, advance, withdraw, toNeedleState) and the test helper tests/needle/volumes.ts (uniformVolume, airVolume). The internal NeedleModel stores the track (entry point → tip, one point per step) and tipDir; the shaft is [hub, ...track] with the hub at entry − hubDir × (length − depth). setHubAngles rotates the whole track rigidly about the entry point (Rodrigues rotation from the old to the new hub direction). advance() returns { state, boneContact } already so F4-S3 keeps the same shape; it ignores the volume for now (`void volume`).
- Files touched: src/needle/model.ts, tests/needle/model.test.ts, tests/needle/volumes.ts, this log, the task file.
- Test result: model.test.ts 8/8; npm run check passed (unit 196, screen 186 passed / 6 skipped).
- Next round should know: withdraw() trims the track by arc length and resets tipDir to the last track segment's direction (or the hub direction at depth 0). The ESLint setup flags unused parameters, hence `void volume`; remove it once the volume is really used. bevelAngle starts at 0.
