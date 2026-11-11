# Progress log — F8 3D see-through view

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- `buildSurface` (src/view3d/surface.ts) returns a NON-indexed mesh: 9 floats per triangle in `positions`, same layout in `normals`; triangle count = positions.length / 9. Feed it straight into a Three.js BufferGeometry ('position' and 'normal' attributes, itemSize 3).
- Zone screen-test helpers live in tests/e2e/view3d/view3dPage.ts: getView3d(page), sceneObject(info, name), press(page, testId), expectOnScreen, countNonBackgroundPixels (3D canvas vs its top-left background pixel), putTestVolume(page, n, boneVoxels) (store trick like setPose).
- To add a scene object to window.__sim.view3d().objects, add it to the list in the registerDebugGetter call in src/view3d/index.ts; call requestDraw() after any scene change (draw on demand).
- Don't add test checks beyond the story's acceptance criteria when a later story is planned to change that behaviour: loops can't edit an existing test later (this blocked F8-S3).
- The layer buttons are hidden with style.display = 'none' in setShown (src/view3d/index.ts); F8-S9 (exam mode) must hide them the same way.
- `npm install` is needed first in a fresh cloud session (node_modules is not committed).

## Rounds
<!--
## Round — YYYY-MM-DD HH:MM — F1-S1 — done | failed | blocked
- What I did:
- Files touched:
- Test result:
- Next round should know:
-->

## Round — 2026-11-11 06:50 — F8-S1 — done
- What I did: Added buildSurface(volume, labels): one quad (two CCW triangles) per voxel face between an in-set voxel and an out-of-set voxel or the grid edge, normals out of the set, positions from origin/spacing. Rejects non-identity orientation with a clear error. Unit tests cover the five acceptance criteria plus an empty-set case and winding.
- Files touched: src/view3d/surface.ts, tests/view3d/surface.test.ts, ralph/tasks/F8-view3d.json, ralph/progress/F8-view3d.md
- Test result: verify (6/6) passed; npm run check passed (182 unit, 186 screen passed, 6 skipped). One unit run done while the screen tests ran in parallel had 1 failure that did not repeat; never run `npm test` alongside `npm run check`.
- Next round should know: The phantom bone mesh is built in two passes (count, then fill) and is fast enough for the 95³ phantom; F8-S2 can call it on volume change.

## Round — 2026-11-11 07:05 — F8-S2 — done
- What I did: Added the '3D view' toggle (aria-pressed, off at start) beside the panel title, and the 3D canvas below it filling the rest of the panel. Three.js scene with the 'bone' surface (buildSurface on the store's volume, bone labels), ambient light plus a light that moves with the camera, start camera fitted to the volume's box (up = +z). Rebuilt when store.volume changes; draws on demand via requestAnimationFrame only while shown. Registered window.__sim.view3d() reading from the Three.js objects.
- Files touched: src/view3d/index.ts, src/view3d/scene.ts, tests/e2e/view3d/toggle.spec.ts, tests/e2e/view3d/view3dPage.ts, ralph/tasks/F8-view3d.json, ralph/progress/F8-view3d.md
- Test result: verify 12/12 passed (desktop + tablet); npm run check passed (182 unit, 198 screen passed, 6 skipped).
- Next round should know: fitCamera in scene.ts frames only the volume box; F8-S3 must widen it to include the C-arm source and detector. The camera target is view.target (a Vector3) — hand that same object to OrbitControls in F8-S5.

## Round — 2026-11-11 07:15 — F8-S3 — blocked
- What I did: Read the story and the geometry. Found that its camera requirement ('start camera shows the whole C-arm') contradicts the F8-S2 screen test 'the start camera looks at the middle of the volume' (camera distance < 50 mm for a 5 mm test volume). Blocked for an owner decision instead of changing the test. No code written.
- Files touched: ralph/tasks/F8-view3d.json, ralph/progress/F8-view3d.md
- Test result: baseline unchanged from F8-S2 (npm run check passed: 182 unit, 198 screen passed, 6 skipped); no code changes this round.
- Next round should know: F8-S4 and F8-S7 depend only on F8-S2 and are eligible. F8-S5, F8-S6 and F8-S9 wait on F8-S3. Plan for F8-S3 once unblocked: src/view3d/carmModel.ts carmModel(pose) → { source, detectorCentre, detectorCorners } from createProjection (corners = centre ± 150·detectorRight ± 150·detectorUp); 'detector' mesh with its four corners as world-space vertices, 'source' sphere at mesh.position, 'beam' LineSegments source→corners; triangleCount must handle indexed geometry (sphere) and lines.

## Round — 2026-11-11 07:25 — F8-S4 — done
- What I did: Added the 'needle' scene object (a line along NeedleState.shaft, hub to tip, drawn over the bone), hidden when the store has no needle, rebuilt when store.needle changes. Extended window.__sim.view3d() with needle: { hub, tip } | null from the line's geometry; objects now lists bone and needle (lines report 0 triangles).
- Files touched: src/view3d/index.ts, src/view3d/scene.ts, tests/e2e/view3d/needle.spec.ts, tests/e2e/view3d/view3dPage.ts, ralph/tasks/F8-view3d.json, ralph/progress/F8-view3d.md
- Test result: verify passed (4/4); all view3d screen tests 16/16; npm run check passed (182 unit, 202 screen passed, 6 skipped).
- Next round should know: F8-S3 is still blocked (owner decision). Next eligible: F8-S7 (layers). In the getter, objects are listed as [view.bone, view.needle] — add new objects there; triangles counts only Mesh objects.

## Round — 2026-11-11 07:40 — F8-S7 — done
- What I did: Added src/view3d/layers.ts (BONE_LABELS + the four owner-chosen layers with label ids, colour, opacity and start visibility) and one surface Mesh per layer in the scene ('layer-nerves', 'layer-vessels', 'layer-thecal', 'layer-soft'), rebuilt with the bone when the volume changes. Soft tissue is see-through (opacity 0.2, no depth write) and hidden at start.
- Files touched: src/view3d/layers.ts, src/view3d/scene.ts, src/view3d/index.ts, tests/view3d/layers.test.ts, tests/e2e/view3d/layers.spec.ts, ralph/tasks/F8-view3d.json, ralph/progress/F8-view3d.md
- Test result: verify passed (unit 2/2, screen 4/4); npm run check passed (184 unit, 206 screen passed, 6 skipped).
- Next round should know: F8-S8 (layer toggle buttons) is next. view.layers.get(id) gives each layer Mesh; flip .visible then requestDraw(). Layer button names are in LAYERS[].name. F8-S3 still blocked.

## Round — 2026-11-11 07:55 — F8-S8 — done
- What I did: Added the four layer toggles (Nerves, Vessels, Thecal sac, Soft tissue; test ids layer-toggle-<id>, aria-pressed) in the toggle row, shown only while the 3D view is on. Each press flips its layer's visible flag and redraws. Narrowed the button minimum width to 44 px so all five fit in one row on the tablet (checked with a throwaway screenshot, deleted).
- Files touched: src/view3d/index.ts, tests/e2e/view3d/layerToggles.spec.ts, ralph/tasks/F8-view3d.json, ralph/progress/F8-view3d.md
- Test result: verify 6/6 passed; all view3d screen tests 26/26; npm run check passed (184 unit, 212 screen passed, 6 skipped).
- Next round should know: Every remaining story (F8-S3 blocked; F8-S5, F8-S6, F8-S9 depend on it) waits on the owner's F8-S3 decision, so no story is eligible until then.
