# floorplan-lab

A monochrome, browser-based workspace for exploring tile and wood flooring layouts and estimating materials. Built with native JavaScript modules, SVG and CSS; no runtime dependencies or backend.

**Version 0.1 — functional prototype.** Rooms are currently rectangular, displayed one at a time. This is the first working slice of a broader floor planning application, not a complete CAD system.

## What works

- Up to 20 named rectangular rooms, with dimensions in millimetres.
- Optional horizontal or vertical split into two independently configured areas.
- Square and rectangular tiles, large formats and rectangular wood planks.
- Straight grid and half-offset running bond; rotation and X/Y origin offsets.
- Geometric clipping at room and region boundaries; cut-piece hatching.
- Room area, full/cut piece counts and cutting offcut area.
- Per-area reserve, box quantity and cost in BRL.
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

Model values are in millimetres. SVG viewBox coordinates provide pan/zoom without mutating dimensions. Each rectangular piece is transformed into world coordinates and clipped to its rectangular area with Sutherland–Hodgman clipping. Polygon areas distinguish full pieces from cuts.

- **Floor area:** full rectangular surface, including joints.
- **Full pieces:** source rectangles entirely inside the region, within a small numerical tolerance.
- **Cut pieces:** intersecting source rectangles requiring trimming.
- **Cutting offcuts:** source area minus retained piece area. This excludes the joint area and the additional purchase reserve.
- **Recommended pieces:** `ceil((full + cut) × (1 + reserve / 100))`.
- **Boxes:** `ceil(recommended / pieces per box)`.
- **Cost:** box count × user-entered box price.

One fresh source piece is assumed for each cut. Offcut reuse, saw kerf, breakage modelling and manufacturer installation constraints are not simulated. Reserve is a user choice, not an installation recommendation. No perimeter movement gap is modelled yet. Counts are conceptual purchase estimates; verify dimensions and installation requirements before ordering.

The bottom summary describes the **current room**. Purchase estimates describe the **selected area** only. Products are not pooled across rooms or regions yet; there is no project-wide purchasing total.

## Structure

- `index.html`: editor controls and semantic UI.
- `style.css`: monochrome responsive layout.
- `app.js`: state, interaction, history, persistence and SVG rendering.
- `geometry.js`: independent clipping, layout and quantity calculations.
- `tests/geometry.test.mjs`: exact grids, partial cuts, rotations, staggered layouts, joints, region partition, limits and reserve rounding.
- `server.mjs`: dependency-free development HTTP server.
- `examples/bathroom.json`: two-area sample, opened through **Open project**.

All files remain local to the browser unless explicitly exported. Clearing browser storage removes autosaved work. Export JSON for a durable backup. Imported JSON is validated and limited to 2 MB; excessive tile counts are rejected to protect the UI.

## Planned, not implemented

- Freeform polygons, holes, pillars and interactive vertex editing.
- Placing all rooms on a shared apartment drawing.
- Image import with scale calibration and DXF import.
- Native DWG import (requires a separate compatibility/licensing decision).
- Hexagonal tiles, herringbone, chevron and modular patterns.
- More than two regions per room, material catalog and project-wide product grouping.
- Perimeter gaps, thresholds, skirting, cut optimisation and offcut reuse.
- Scenario comparisons and PDF quantity reports.

## Verification

Eight automated geometry tests pass. Desktop browser checks cover area selection, independent materials, keyboard-entered rotation, undo/redo, persistence after reload and JSON/SVG downloads. Mobile CSS is included but has not been tested on a physical mobile device. This release has not been deployed to the user's GitHub repository.
