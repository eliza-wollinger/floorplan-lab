# floorplan-lab

A monochrome, browser-based workspace for exploring tile and wood flooring layouts and estimating materials. Built with native JavaScript modules, SVG and CSS; no runtime dependencies or backend.

**Version 0.3 — functional prototype.** Rooms are currently rectangular, displayed one at a time. This is the first working slice of a broader floor planning application, not a complete CAD system.

## What works

- Up to 20 named rectangular rooms, with dimensions in millimetres.
- Optional horizontal or vertical split into two independently configured areas.
- Square and rectangular tiles, wood planks and regular hexagons.
- Visual pattern library: aligned horizontal/vertical/diagonal, running bond with ½, ⅓ or custom offset, herringbone, basket weave/parquet blocks, and regular hexagons. Rotation and X/Y origins work across all patterns.
- Geometric clipping at room and region boundaries; cut-piece hatching.
- Room area, full/cut piece counts and cutting offcut area.
- Per-area reserve, box quantity and cost in BRL.
- Separate Pan view and Move layout tools: drag the pattern inside an area without moving the room.
- Live quantity updates while dragging; each completed drag is one undo step.
- Optimize layout: background origin search, optional angle comparison, visual before/after preview, Apply or Keep current.
- Pan, zoom, optional grid, undo/redo (session only).
- Browser-local autosave; JSON project export/import and SVG drawing export.
- Responsive stacked layout for smaller screens.

## GitHub Pages

1. Upload the **contents** of this folder to your `floorplan-lab` repository. `index.html` must be at the repository root.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, then **main** and **/ (root)**, and save.
4. Open the URL GitHub provides after deployment.

All asset references are relative, so project subpaths work. No build step, secrets or API keys are required. `.nojekyll` is included. Do not upload the ZIP itself as the website; extract it first.

## Local development

Use Node.js 20+:

```sh
npm run dev
```

Open `http://127.0.0.1:3000`. No `npm install` is needed. Alternatively, serve this folder with VS Code Live Server. ES modules require HTTP; do not open `index.html` directly using `file://`.

Run geometry checks:

```sh
npm test
```

## Geometry and quantity assumptions

Model values are in millimetres. SVG viewBox coordinates provide pan/zoom without mutating dimensions. Each rectangular or hexagonal piece is transformed into world coordinates and clipped to its rectangular area with Sutherland–Hodgman clipping. Polygon areas distinguish full pieces from cuts.

- **Floor area:** full rectangular surface, including joints.
- **Full pieces:** source pieces entirely inside the region, within a small numerical tolerance.
- **Cut pieces:** intersecting source pieces requiring trimming.
- **Cutting offcuts:** source area minus retained piece area. This excludes the joint area and the additional purchase reserve.
- **Recommended pieces:** `ceil((full + cut) × (1 + reserve / 100))`.
- **Boxes:** `ceil(recommended / pieces per box)`.
- **Cost:** box count × user-entered box price.

One fresh source piece is assumed for each cut. Offcut reuse, saw kerf, breakage modelling and manufacturer installation constraints are not simulated. Reserve is a user choice, not an installation recommendation. No perimeter movement gap is modelled yet. Counts are conceptual purchase estimates; verify dimensions and installation requirements before ordering.

The bottom summary describes the **current room**. Purchase estimates describe the **selected area** only. Products are not pooled across rooms or regions yet; there is no project-wide purchasing total.

## Layout optimization

Choose **Move layout** and drag inside the desired area. The area is selected automatically, and its origin changes while the room boundary stays fixed. Release to save. Escape cancels an in-progress drag. **Pan view** moves only the drawing viewport. Numeric X/Y origin controls remain available.

Choose **Optimize layout → Find best fit** for the selected area. By default its angle is locked. The optional checkbox also tests 0°, 45° and 90°, in addition to the current angle. Review current/best drawings and quantities, then apply or keep the original. Apply is one undo step. Closing the dialog cancels a running worker.

The deterministic heuristic samples an 8 × 8 origin grid for each angle, then performs three 5 × 5 refinements around the best sampled origin for that angle. The search uses the actual repeat lattice of each pattern, including the oblique running-bond, herringbone and hexagonal lattices. Duplicate candidates are skipped. Rotation is accounted for when converting local tile-grid offsets to world coordinates. Candidate workload limits match the geometry engine.

The objective is lexicographic: minimize source-piece count, then cut-piece count, then cutting offcut area. The original layout is always a candidate; proposals cannot worsen this objective. This is **best found**, not a proof of global optimality. It does not optimize reuse, kerf, a minimum strip width, installation constraints, or several areas together. Identical box counts can remain even when fewer source pieces are needed.

The search runs in a module Web Worker to avoid blocking pointer/UI input. Include `optimizer.js` and `optimizer-worker.js` when publishing. No external libraries or API services are used.

v0.1/v0.2 JSON files (schema 1) migrate to schema 2, adding row offset and block count. v0.3 saves under a new browser-storage key and reads the older key as a fallback, leaving the older autosave intact. New files are not backward-compatible with v0.2. Undo history is session-only. Export JSON before upgrading.

## Pattern dimensions

- **Aligned:** rotation presets at 0°, 90° and 45°. These rotate the pattern; the width/length fields retain their definitions.
- **Running bond:** each successive row advances by the configured percentage of the width-plus-joint pitch. The ⅓ button stores an exact one-third ratio rather than rounded 33%.
- **Herringbone:** perpendicular rectangular pieces; length must exceed width. If selected from square dimensions, the editor starts at 200 × 800 mm; otherwise it orders short/long dimensions. Review sizes for your actual product.
- **Basket weave/parquet:** 2–8 planks per square block, alternating orientation. Required physical length = n × width + (n − 1) × joint. The length field is derived and updates automatically. This does not mean an existing product can change size: select a product matching the computed dimensions. Imported incompatible blocks are rejected.
- **Regular hexagon:** size means distance across parallel faces. Corner-to-corner size = 2 × across-flats / √3. Piece area = √3 / 2 × across-flats². Joint means perpendicular edge separation. Changing to this family starts at 300 mm across flats and clears the prior box price; check actual packaging.

All patterns remain clipped to rectangular areas. Current/best comparisons optimize the selected layout family, not a choice between different products. No leftover-piece reuse is included.

Open `examples/pattern-library.json` to explore all seven gallery options as named rooms.

## Structure

- `index.html`: editor controls and semantic UI.
- `style.css`: monochrome responsive layout.
- `app.js`: state, interaction, history, persistence and SVG rendering.
- `project.js`: project validation and legacy schema migration.
- `tests/patterns.test.mjs` and `tests/project.test.mjs`: new pattern and compatibility checks.
- `geometry.js`: independent clipping, layout and quantity calculations.
- `optimizer.js`: pure candidate search and ranking.
- `optimizer-worker.js`: background search/progress messaging.
- `tests/optimizer.test.mjs`: improvements, unchanged optimum, fixed angle, rotation, reproducible metrics and ranking.
- `tests/geometry.test.mjs`: exact grids, partial cuts, rotations, staggered layouts, joints, region partition, limits and reserve rounding.
- `server.mjs`: dependency-free development HTTP server.
- `examples/bathroom.json`: two-area sample, opened through **Open project**.
- `examples/optimization-demo.json`: offset grid that improves from nine source pieces to four.

All files remain local to the browser unless explicitly exported. Clearing browser storage removes autosaved work. Export JSON for a durable backup. Imported JSON is validated and limited to 2 MB; excessive tile counts are rejected to protect the UI.

## Planned, not implemented

- Freeform polygons, holes, pillars and interactive vertex editing.
- Placing all rooms on a shared apartment drawing.
- Image import with scale calibration and DXF import.
- Native DWG import (requires a separate compatibility/licensing decision).
- Chevron, mixed-shape modular patterns and custom/interlocking pieces.
- More than two regions per room, material catalog and project-wide product grouping.
- Perimeter gaps, thresholds, skirting, cut optimisation and offcut reuse.
- Scenario comparisons and PDF quantity reports.

## Verification

30 automated tests cover geometry, pattern coverage without overlaps, rotated patterns, joints, optimization, legacy project migration and JSON roundtrips. Desktop browser checks confirmed the gallery, herringbone, automatic parquet length, independent hexagonal areas, direct dragging, hexagon optimization/application, persistence after reload and the one-third offset control. Mobile CSS is included but has not been tested on a physical device. This package has not been deployed to your GitHub repository.
