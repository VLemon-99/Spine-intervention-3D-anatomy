# Progress log — F1 Anatomy data

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- NIfTI header numbers are 32-bit floats: compare affine/spacing values with `Math.fround(...)` or `toBeCloseTo`, never `toEqual` against plain decimals like 0.8.
- Build NIfTI test files with `makeNifti` / `writeNifti` from `tests/anatomy/niftiFixture.ts` (path ending `.gz` gets gzipped; options for big-endian, slope/intercept, sform/qform, bad magic, fake 4-D, truncation).
- `readNifti` returns the file's own axes and the NIfTI RAS+ affine (+x = patient right, +y = front). Our app frame is +x left, +y back — `tools/anatomy/standardLayout.ts` does that conversion.
- Read JSON tables in tools/ with `readFileSync(new URL('./x.json', import.meta.url))` — tsconfig has no `resolveJsonModule`, so `import x from './x.json'` fails the type check (and tsconfig is a shared file).
- ESLint here has `preserve-caught-error`: when re-throwing inside a `catch`, pass `{ cause: e }` to `new Error(...)`.
- Converter logic is in `tools/anatomy/convertCore.ts` so tests can call `runConvertCli(args, { log, error })` without spawning a process; `convert.ts` just sets `process.exitCode`.
- Don't use `Math.min(...list)` / `Math.max(...list)` on voxel lists: real vertebrae have ~100k voxels and spreading that many arguments can overflow the stack. `landmarks.ts` has a `range(values)` loop helper.
- typescript-eslint flags unused destructured names even with a leading `_` (e.g. `({ a: _a, ...rest })`); build the object another way.
- To test the converter on realistic anatomy, write the phantom or the pelvis fixture out as an input folder with `writeNiftiFolder(dir, vol, source?)` from `tests/anatomy/niftiFolderFixture.ts` (one mask per vertebral level present, sacrum, hip_left/right, spinal_cord).
- Node 22 has `Response`, `Blob` and `DecompressionStream` built in, so browser loader code can be unit-tested in Vitest's node environment with a fake fetch that returns `new Response(bytes)`.

## Rounds
<!--
## Round — YYYY-MM-DD HH:MM — F1-S1 — done | failed | blocked
- What I did:
- Files touched:
- Test result:
- Next round should know:
-->

## Round — 2026-11-10 13:10 — F1-S1 — done
- What I did: wrote the NIfTI-1 reader (plain + gzip detected by content, uint8/int16/uint16/float32, both byte orders, slope/intercept with slope 0 meaning none, sform → qform → spacing-only affine) and a fixture writer for tests; 20 unit tests.
- Files touched: tools/anatomy/nifti.ts, tests/anatomy/nifti.test.ts, tests/anatomy/niftiFixture.ts, task file, this log.
- Test result: verify command 20/20 passed; `npm run check` green (lint, types, 103 unit tests, 46 screen tests passed, 6 skipped by set-up).
- Next round should know: two-file NIfTI (.hdr/.img, magic "ni1") is rejected on purpose. The cloud session runs on branch claude/ralph-loop-f1-anatomy-1sgnfd rather than the task file's ralph/F1-anatomy.

## Round — 2026-11-10 13:12 — F1-S2 — done
- What I did: HU → 8-bit mapping over a validated window (default −1000…+2000), rounded and clamped; whole-volume helper for the converter; 7 unit tests.
- Files touched: tools/anatomy/intensity.ts, tests/anatomy/intensity.test.ts, task file, this log.
- Test result: verify 7/7 passed; `npm run check` green (110 unit tests, 46 screen tests passed).
- Next round should know: the converter (F1-S9) should call `huVolumeToIntensity(niftiVolume.data, window)` after reordering; take a custom window via `makeHuWindow`. The loop's state file `.claude/ralph-loop.local.md` is listed in `.git/info/exclude` (local only) so it is never committed.

## Round — 2026-11-10 13:14 — F1-S3 — done
- What I did: plan + apply reordering from a NIfTI RAS affine to the standard layout (i left, j back, k head); origin is the app-frame position of output voxel (0,0,0); oblique (> 5°) scans rejected; 6 unit tests (four storage orders incl. RAS and LPS, corner voxel, per-axis spacing, 20°/1° tilt, shared plan for masks, length check).
- Files touched: tools/anatomy/standardLayout.ts, tests/anatomy/standardLayout.test.ts, task file, this log.
- Test result: verify 6/6 passed; `npm run check` green (116 unit tests, 46 screen tests passed).
- Next round should know: plan once from the CT's size + affine, then `applyLayoutPlan(plan, maskData)` for every mask (check the masks have the same size first). A slightly tilted (≤ 5°) scan is snapped to the axes; the origin comes from the real affine.

## Round — 2026-11-10 13:16 — F1-S4 — done
- What I did: draft label table (vertebrae C1–L5, vertebrae_S1/sacrum → sacrum, hip_left/right → ilium, spinal_cord → thecal sac, aorta/iliac arteries, IVC/iliac veins, back/hip muscles) with a validator, and labelsFromMasks (bone wins, then table order; unknown masks reported; size mismatch rejected); 8 unit tests.
- Files touched: tools/anatomy/label-map.json, tools/anatomy/labels.ts, tests/anatomy/labels.test.ts, task file, this log.
- Test result: verify 8/8 passed; `npm run check` green (124 unit tests, 46 screen tests passed).
- Next round should know: masks count as "inside" when value > 0. labelsFromMasks paints lowest priority first so later (higher priority) masks overwrite. F1-S25 adds thresholds to the same JSON — keep validateLabelMap accepting extra fields. Ribs are not in the table (no level code for them).

## Round — 2026-11-10 13:18 — F1-S25 — done
- What I did: draft HU thresholds in label-map.json, validateThresholds, and refineLabelsByHu (bone → cortical/cancellous; unmasked → air/skin-fat/muscle; non-bone masks untouched); 6 new unit tests appended, earlier 8 unchanged.
- Files touched: tools/anatomy/label-map.json, tools/anatomy/labels.ts, tests/anatomy/labels.test.ts, task file, this log.
- Test result: verify 14/14 passed; `npm run check` green (130 unit tests, 46 screen tests passed).
- Next round should know: pipeline order is labelsFromMasks(ctSize, masks, map) → refineLabelsByHu(labels, ctHu, map.thresholds!). validateLabelMap stays thresholds-free (its earlier tests count problems exactly); thresholds are checked by validateThresholds and by loadLabelMap.

## Round — 2026-11-10 13:19 — F1-S5 — done
- What I did: level volume from the bone masks (table order on overlap, 0 for non-bone); 4 unit tests on a 10-voxel fixture (two vertebrae, sacrum, both hips, canal, artery, vein, dense unmasked voxel).
- Files touched: tools/anatomy/labels.ts, tests/anatomy/labels.test.ts, task file, this log.
- Test result: verify 18/18 passed; `npm run check` green (134 unit tests, 46 screen tests passed).
- Next round should know: full label pipeline is labelsFromMasks → refineLabelsByHu → levelsFromMasks(refinedLabels, masks, map). All three work on the masks' own voxel order, so reorder (applyLayoutPlan) either the masks first or the three outputs afterwards — the same plan for all.

## Round — 2026-11-10 13:22 — F1-S6 — done
- What I did: region table and cropToRegion (region bone bbox, lumbosacral ilium near the sacrum + hip bones up to the crests, mm margin clamped to edges, stretched back to the skin, origin moved); 8 unit tests.
- Files touched: tools/anatomy/regions.ts, tests/anatomy/regions.test.ts, task file, this log.
- Test result: verify 8/8 passed (first run had a fixture too short to show the lower hip bone being cut; fixed the fixture, not the code); `npm run check` green (142 unit tests, 46 screen tests passed).
- Next round should know: cropToRegion expects the standard layout and Uint8 intensity/labels/levels (so crop after HU→8-bit and after reordering). Margin in voxels = ceil(marginMm / spacing) per axis. Possible real-data snag: the CT couch behind a supine patient counts as non-air for the back-skin reach.

## Round — 2026-11-10 13:24 — F1-S7 — done
- What I did: resampler (trilinear intensity, nearest labels/levels, origin kept, exact copy when spacing already matches, spacing validation); 6 unit tests.
- Files touched: tools/anatomy/resample.ts, tests/anatomy/resample.test.ts, task file, this log.
- Test result: verify 6/6 passed; `npm run check` green (148 unit tests, 46 screen tests passed).
- Next round should know: resample works on 8-bit intensity (after HU→8-bit). Crop before resampling to save time on real scans; both keep patient positions.

## Round — 2026-11-10 13:26 — F1-S8 — done
- What I did: region header type + hand-written validator (shared, no Node/browser code) and a Node writer (gzip level 9, header JSON last); 9 unit tests.
- Files touched: src/anatomy/regionFormat.ts, tools/anatomy/writeRegion.ts, tests/anatomy/regionFormat.test.ts, task file, this log.
- Test result: verify 9/9 passed; `npm run check` green (157 unit tests, 46 screen tests passed).
- Next round should know: the validator also checks that each data file name is exactly `<region>.<kind>.bin.gz`. Header orientation is stored as three {x,y,z} objects, matching the shared Volume type, so the loader can copy it.

## Round — 2026-11-10 13:30 — F1-S9 — done
- What I did: real converter (source.json checks, ct + segmentations reading, standard layout, HU window, labels/levels, crop, resample, write via scratch folder then move, report); convert.ts reduced to the CLI entry; 9 unit tests incl. a full fixture compared voxel by voxel against hand-worked expectations.
- Files touched: tools/anatomy/convertCore.ts (new), tools/anatomy/convert.ts, tests/anatomy/convert.test.ts, task file, this log.
- Test result: verify 9/9 passed (convert-cli.test.ts untouched and passing); first `npm run check` failed lint (preserve-caught-error) — fixed; then green (165 unit tests, 46 screen tests passed).
- Next round should know: ConvertReport.source carries sourceDataset/licence/attribution for the manifest (F1-S18). F1-S18 should add the modeller and landmarks between labels and writing, inside convertFolder.

## Round — 2026-11-10 13:34 — F1-S10 — done
- What I did: body centre + superior/inferior endplates (plane fit on body columns) per typical level; 6 unit tests (phantom L4/L5 vs createPhantomLandmarks, bone+level at centres, a tilted endplate, empty/skip cases).
- Files touched: tools/anatomy/landmarks.ts, tests/anatomy/landmarks.test.ts, task file, this log.
- Test result: verify 6/6 passed; `npm run check` green (171 unit tests, 46 screen tests passed).
- Next round should know: landmarks.ts works on any {size, spacing, origin, labels, levels} in the standard layout (e.g. createPhantom()). Reuse boneVoxelsByLevel / bodyVoxels / centreInside for pedicles and articular processes. Endplate centre = mean of top (or bottom) voxel centres, i.e. on the outer voxel centres, as in the phantom's truth.

## Round — 2026-11-10 13:40 — F1-S11 — done
- What I did: pedicle centres and foramen centres (incl. L5–S1 with the sacrum) in landmarks.ts; pelvis fixture helper with true landmark positions; 5 new unit tests, earlier 6 unchanged.
- Files touched: tools/anatomy/landmarks.ts, tests/anatomy/landmarks.test.ts, tests/anatomy/pelvisFixture.ts (new), task file, this log.
- Test result: verify 11/11 passed; `npm run check` green (176 unit tests, 46 screen tests passed).
- Next round should know: pelvis fixture is 121×81×111 voxels (1 mm, origin (−60, −40, −70)); building it takes well under a second. Its S1 SAP pillars top out at z −4 (tips (±15, 18, −4)); L5's pillars run −2…23 (facet gap z −3). findLevelParts skips a level whose pedicles can't be found on both sides.

## Round — 2026-11-10 13:43 — F1-S12 — done
- What I did: superior articular process tips and the whole Landmarks object (computeLandmarks); 3 new unit tests (phantom tips vs truth, tips on own-level bone on phantom + pelvis fixture, complete object), earlier 11 unchanged.
- Files touched: tools/anatomy/landmarks.ts, tests/anatomy/landmarks.test.ts, task file, this log.
- Test result: verify 14/14 passed; `npm run check` green (179 unit tests, 46 screen tests passed).
- Next round should know: F1-S23 extends computeLandmarks with optional `sacrum` and `iliacCrest` and a report (e.g. return { landmarks, report } from a new function, keeping computeLandmarks' current return so earlier tests stay unchanged). canalBeside/CanalBox can be reused for the sacrum's canal.

## Round — 2026-11-10 13:46 — F1-S23 — done
- What I did: sacrum landmarks (S1 superior endplate, S1 SAP tips) and iliac crest points with a notes list (crest cut off / side missing); 5 new unit tests on the pelvis fixture and phantom, earlier 14 unchanged.
- Files touched: tools/anatomy/landmarks.ts, tests/anatomy/landmarks.test.ts, task file, this log.
- Test result: verify 19/19 passed; `npm run check` green (184 unit tests, 46 screen tests passed).
- Next round should know: the converter (F1-S18) should call computeRegionLandmarks and print its notes in the report. On real data the S1 endplate is tilted ~40°; the plane fit handles tilt but only the owner can judge the result.

## Round — 2026-11-10 13:52 — F1-S13 — done
- What I did: soft-tissue modeller with the canal step (epidural space + ligamentum flavum), its params file, stripped-phantom helper and shared midline check; 6 unit tests.
- Files touched: tools/anatomy/softTissue.ts, tools/anatomy/soft-tissue-params.json, tests/anatomy/softTissueCanal.test.ts, tests/anatomy/strippedPhantom.ts, tests/anatomy/softTissueChecks.ts (all new), task file, this log.
- Test result: verify 6/6 passed; `npm run check` green (190 unit tests, 46 screen tests passed).
- Next round should know: createStrippedPhantom({ removeSac: true }) also turns sac and cord into muscle (for F1-S26). expectMidlineOrder(vol) and labelAt(vol, p) are in tests/anatomy/softTissueChecks.ts. modelSoftTissue already takes landmarks (unused so far) for the nerve roots and arteries. The canal step only runs in slices that contain sac/cord voxels, so F1-S26 must add the sac before it.

## Round — 2026-11-10 13:56 — F1-S26 — done
- What I did: thecal-sac step for scans without one (tube down the middle of the bone-enclosed canal, carried across open slices); params added; 5 unit tests on the phantom with sac and cord removed; F1-S13 tests unchanged and passing.
- Files touched: tools/anatomy/softTissue.ts, tools/anatomy/soft-tissue-params.json, tests/anatomy/softTissueSac.test.ts (new), task file, this log.
- Test result: verify 11/11 passed; `npm run check` green (195 unit tests, 46 screen tests passed).
- Next round should know: step order in modelSoftTissue is sac → canal; nerve roots (F1-S14), joints (F1-S15) and arteries (F1-S16) come after. Only GENERIC labels (air, skin/fat, muscle, epidural, LF) are overwritten by these steps.

## Round — 2026-11-10 14:00 — F1-S14 — done
- What I did: nerve-root step in the modeller (sac → foramen → outward/downward), tube painter, params; 6 unit tests.
- Files touched: tools/anatomy/softTissue.ts, tools/anatomy/soft-tissue-params.json, tests/anatomy/softTissueNerves.test.ts (new), task file, this log.
- Test result: verify 6/6 passed; first `npm run check` failed lint on an unused `_f` in the new test — rewrote that line; then green (201 unit tests, 46 screen tests passed).
- Next round should know: paintTube(vol, labels, [points], radius, label, mayReplace) is ready for the arteries (F1-S16). sacVoxels scans the whole volume once per call; fine for now.

## Round — 2026-11-10 14:05 — F1-S15 — done
- What I did: facet and SI joint spaces (gap walks from bone surfaces along 13 directions, canal-front rule for facets), param maxWidthMm 4; 5 unit tests on the stripped phantom and pelvis fixture.
- Files touched: tools/anatomy/softTissue.ts, tools/anatomy/soft-tissue-params.json, tests/anatomy/softTissueJoints.test.ts (new), task file, this log.
- Test result: verify 5/5 passed (first run: my new pelvis test's SI box was too tight at the gap's corners, where diagonal gaps are real; widened that test's box by 2 mm at the edges — test written this round); `npm run check` green (206 unit tests, 46 screen tests passed).
- Next round should know: step order now sac → canal → nerve roots (if landmarks) → joints. Joint spaces replace only air/skin-fat/muscle, so roots and arteries painted earlier stay. F1-S16 adds arteries; put that step before joints or make sure it never overwrites nerve root.

## Round — 2026-11-10 14:09 — F1-S16 — done
- What I did: lumbar segmental artery step (beside the body → upper front of the foramen), params; 5 unit tests incl. all earlier modelling checks run together.
- Files touched: tools/anatomy/softTissue.ts, tools/anatomy/soft-tissue-params.json, tests/anatomy/softTissueArteries.test.ts (new), task file, this log.
- Test result: verify 5/5 passed; `npm run check` green (211 unit tests, 46 screen tests passed).
- Next round should know: the modeller is complete: modelSoftTissue(vol, landmarks) = sac → canal → nerve roots → arteries → joints. Landmarks must be computed BEFORE modelling (they use bone + sac only), so F1-S18's order is: labels/levels → crop → resample → landmarks → modeller → write.

## Round — 2026-11-10 14:15 — F1-S17 — done
- What I did: shared manifest + landmarks-file formats with hand-written validators and the 25 MB size check; committed an empty public/data/manifest.json; 10 unit tests. (The worker restarted mid-round; I re-ran the full check before committing.)
- Files touched: src/anatomy/manifestFormat.ts, public/data/manifest.json, tests/anatomy/manifestFormat.test.ts (all new), task file, this log.
- Test result: verify 10/10 passed; `npm run check` green (221 unit tests, 46 screen tests passed).
- Next round should know: 25 MB is taken as 25 000 000 bytes. Endplate normals must have length 1 (±0.001). Each manifest region has a `title`; F1-S18 can take it from REGIONS[region].title in tools/anatomy/regions.ts. Landmarks-file `region` may be any valid region name (so 'phantom' passes).

## Round — 2026-11-12 — F1-S18 — blocked
- What I did: (owner confirmed keeping the manifest `title` field; noted in F1-S17.) Read F1-S18 and found it conflicts with an existing test: tests/anatomy/convert.test.ts:129 expects the output folder to contain exactly the four region files, while F1-S18 must add landmarks.json and manifest.json there. Blocked rather than edit that test.
- Files touched: task file, this log.
- Test result: no code changed; suite was green at the start of the round (221 unit, 46 screen).
- Next round should know: F1-S19 (loader) is eligible next — it depends only on F1-S17. F1-S20 and F1-S22 wait on F1-S18.

## Round — 2026-11-12 — F1-S18 — done
- What I did: the owner approved the test change, so I unblocked the story. The converter now computes landmarks, runs the soft-tissue modeller, writes the landmarks file and adds/replaces the region in manifest.json, with the 25 MB check (limit can be lowered for tests). Updated only the approved file-list assertion in convert.test.ts. 6 new tests in convertManifest.test.ts using the phantom and pelvis fixture written as NIfTI folders.
- Files touched: tools/anatomy/convertCore.ts, tests/anatomy/convert.test.ts (approved assertion only), tests/anatomy/convertManifest.test.ts and tests/anatomy/niftiFolderFixture.ts (new), task file, this log.
- Test result: verify 14/14 passed (first run failed because my new folder helper only wrote L1–L5 masks, so the thoracic test fixture had no bone; the helper now writes every vertebral level); `npm run check` green (227 unit tests, 46 screen tests passed). public/data/ untouched.
- Next round should know: F1-S19 (loader) is next. Manifest files are named in each region entry; the loader should only fetch names from the manifest (isSafeFileName already checked by validateManifest).

## Round — 2026-11-12 — F1-S19 — done
- What I did: browser region loader (listRegions, loadRegion with phantom shortcut, gzip-signature check, full validation, injectable fetch) exported from src/anatomy/index.ts; 9 unit tests with files served from memory.
- Files touched: src/anatomy/loadRegion.ts (new), src/anatomy/index.ts, tests/anatomy/loadRegion.test.ts (new), task file, this log.
- Test result: verify 9/9 passed; `npm run check` green (236 unit tests, 46 screen tests passed); `npm run build` also succeeds.
- Next round should know: F1-S24 (browser check that a loaded region can be shown) is next. Default baseUrl 'data/' is relative to the page, which matches Vite serving public/data at /data/.

## Round — 2026-11-12 — F1-S24 — done
- What I did: anatomy screen-test helper and 3 screen tests (load a routed tiny region and see it in window.__sim and on the next image; empty committed manifest → no regions; unlisted name rejected), each in both set-ups.
- Files touched: tests/e2e/anatomy/regionPage.ts and tests/e2e/anatomy/loadRegion.spec.ts (new), task file, this log.
- Test result: verify 6/6 passed (3 tests × desktop/tablet); `npm run check` green (236 unit tests, 52 screen tests passed).
- Next round should know: F1-S21 can reuse serveRegion/buildTinyRegion. While serveRegion is active, every data/* request not in the tiny set gets a 404 — so a test that wants the committed manifest must not call serveRegion.

## Round — 2026-11-12 — F1-S21 — done
- What I did: region wiring (store.regions from the manifest, regionRequest → loadRegion → store, __sim.anatomy() status) mounted by the anatomy zone; 1 unit test and 5 screen tests (both set-ups) with helpers regionsInStore / requestRegion / anatomyStatus added to tests/e2e/anatomy/regionPage.ts.
- Files touched: src/anatomy/regionWiring.ts (new), src/anatomy/index.ts, tests/anatomy/regionEntries.test.ts (new), tests/e2e/anatomy/regionRequest.spec.ts (new), tests/e2e/anatomy/regionPage.ts, task file, this log.
- Test result: verify passed (1 unit, 10 screen); `npm run check` green (237 unit tests, 62 screen tests passed); build has no `__sim`.
- Next round should know: to know the initial listing is done in a screen test, wait for the data/manifest.json response before goto completes (see open() in regionRequest.spec.ts). F1-S20 is the last todo story.

## Round — 2026-11-12 — F1-S20 — done
- What I did: data-folder checker and the committed-data test (public/data today + converted phantom fixture, failing on a deleted file, a body centre in soft tissue, size limits, a short data file).
- Files touched: tools/anatomy/checkData.ts, tests/anatomy/committedData.test.ts (new), task file, this log.
- Test result: verify passed: committedData 6/6, `npm run check` green (243 unit tests, 62 screen tests in both set-ups), `npm run build` passes.
- Next round should know: no `todo` stories remain. F1-S27 (needs F3's picker merged) and F1-S22 (real data with the owner) stay blocked by design.
