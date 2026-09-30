# PS4 — Page Setup and Plot Configuration (superseded by PLOT1)

PLOT1 separates this stage's former persistent `paper.plot` metadata from the physical Layout sheet. See `PLOT1-page-setup-plot-foundation.md` for the current ownership boundary. Legacy metadata remains load-compatible but is no longer saved or edited by Page Setup.

PS4 extends the document-owned PS2 `Layout.paper` authority. It does not create a printer, preview, PDF, or workspace-preference model.

## Persistent model

Each Layout paper setup retains physical dimensions and margins in millimetres and owns one validated `plot` object:

- `area: "layout"`
- `scale: 1`
- `placement: "centered" | "offset"`
- `offset: { x, y }` in paper millimetres
- `colorMode: "color" | "grayscale" | "monochrome"`

Paper Space output is always physical 1:1. A Model coordinate reaches output through the existing document-unit conversion, the PS3 viewport denominator, Paper Space millimetres, and finally printable-area clipping. No fit-to-page rescaling occurs.

## Plot scene

`CaderactPlotScene` is the deterministic renderer-neutral boundary for later Plot Preview and PDF work. Its output is expressed only in page millimetres and contains clipped geometry segments and annotation text. It reads authoritative Model records, layer visibility, effective explicit/ByLayer colors, Layout viewport frames, centers, and scales.

Color mode is applied only while deriving plot primitives:

- Color preserves the effective drawing color.
- Grayscale applies deterministic luminance conversion.
- Monochrome emits black technical-drawing content.

The transform never rewrites records or Layers. Canvas background, grids, axes, crosshair, selection, grips, snaps, tracking, Dynamic Input, and other editor overlays are absent by construction.

## UI and lifecycle

The existing Layout Page Setup dialog groups Paper, Margins / printable area, and Plot / Output controls. Apply sends one complete paper setup through `layoutGateway.setPageSetup`, producing one normal document transaction with exact Undo/Redo and dirty-state behavior.

Native v3 persistence includes the plot object. PS1–PS3 files without it migrate to Layout, 1:1, centered, zero offset, Color. Invalid persisted plot metadata is rejected before document replacement. DXF remains Model Space-only.

## Deferred

PDF1/PDF2 own Plot Preview, PDF serialization, fonts, vector output policies, page ranges, and final export UX.
