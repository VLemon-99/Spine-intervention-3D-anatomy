# Progress log — F4 Needle mechanics

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- JSON imports (`import x from './file.json'`) type-check without tsconfig changes (moduleResolution bundler). Validators take `unknown` and return the typed data; tests break a deep copy of the committed JSON to check each rejection.
- To look at phantom voxels quickly: `npx tsx -e "import { createPhantom } from './src/core/phantom'; …"` (console.log in a Vitest test is not shown with the default reporter).
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

## Round — 2026-11-11 06:59 — F4-S3 — done
- What I did: added src/needle/sample.ts (labelAt: nearest voxel, outside grid = air, rejects non-identity orientation via assertStandardLayout). advance() now checks the label at the next step position before moving; bone stops the tip at the last position outside bone and sets boneContact (on the model and in the result). A withdrawal of more than 0 mm clears it; a successful step also clears it.
- Files touched: src/needle/sample.ts, src/needle/model.ts, tests/needle/bone.test.ts, this log, the task file.
- Test result: bone.test.ts 7/7, all needle tests 28/28; npm run check passed (unit 203, screen 186 passed / 6 skipped).
- Next round should know: in the phantom the lamina's back surface (x 0, z 14) is the voxel boundary y = 24.5; skin starts at y = 42. The tip stops up to one step (0.25 mm) short of the surface because whole steps are used. advance() now calls assertStandardLayout on every call.

## Round — 2026-11-11 07:03 — F4-S4 — done
- What I did: added rotateBevel and bevel drift. Each step, after checking for bone, the direction of travel turns by driftDegPerMm[tipType] × tissueStiffness(label at the tip) × step toward the side opposite the notch. The clock face is the hub frame's up/right made perpendicular to the current direction. NeedleModel now carries tipType. New params field driftDegPerMm (validated: one non-negative number per tip type).
- Files touched: src/needle/model.ts, src/needle/data.ts, src/needle/params.json, tests/needle/drift.test.ts, this log, the task file.
- Test result: drift.test.ts 7/7, all needle tests 35/35; npm run check passed (unit 210, screen 186 passed / 6 skipped).
- Next round should know: drift with today's drafts: 22G Quincke, 40 mm muscle, about 2.36 mm. Needle stiffness is NOT used yet (F4-S5 adds it). The tissue is looked up at the current tip position before the step. Quick numbers: `npx tsx -e "…"` with imports from './src/needle/model' and './tests/needle/volumes'.

## Round — 2026-11-11 07:08 — F4-S5 — done
- What I did: drift now also depends on the needle: it is divided by catalogue stiffness ^ driftStiffnessPower (new params field, 0.5 draft, validated as positive). With power 1 a 25G would drift about 3.7× a 22G (8.7 mm at 40 mm), which looked too much, so 0.5 was chosen (about 1.9×) — a proposal for the owner to tune. Tissue and depth ordering already held from F4-S4. Added a validator test for the drift fields in data.test.ts (an extension, no existing test changed).
- Files touched: src/needle/model.ts, src/needle/data.ts, src/needle/params.json, tests/needle/driftOrder.test.ts, tests/needle/data.test.ts, this log, the task file.
- Test result: driftOrder.test.ts 3/3, drift.test.ts 7/7, all needle tests 39/39; npm run check passed (unit 214, screen 186 passed / 6 skipped).
- Next round should know: drift after 40 mm muscle: 22G 2.36 mm, 25G 4.52 mm. Among muscle/skinFat/ligamentumFlavum the stiffest is ligamentumFlavum (1.8), softest skinFat (0.4).

## Round — 2026-11-11 07:12 — F4-S6 — done
- What I did: added tests/needle/spin.test.ts (22G Quincke, uniform muscle, 40 × 1 mm advances with the bevel rotated ±30° before each). The model already applies drift step by step in the current bevel direction, so no change to src/needle/ was needed.
- Files touched: tests/needle/spin.test.ts, this log, the task file.
- Test result: spin.test.ts 3/3 (with drift.test.ts and driftOrder.test.ts 13/13); npm run check passed (unit 217, screen 186 passed / 6 skipped).
- Next round should know: spin drift 0.219 mm vs no-spin 2.356 mm (both spin directions equal, by symmetry).
