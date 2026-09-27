# PS2 — Paper Space and page geometry

PS2 turns each PS1 Layout into a physical Paper Space sheet. Page data is document-owned and expressed authoritatively in millimetres. It includes a named paper size (`A4`, `A3`, `Letter`, `Legal`, or `Custom`), portrait/landscape orientation, physical width and height, and four margins.

`CaderactPaperSpace` validates and derives the sheet and printable rectangles. Presets use their real physical dimensions; Custom requires positive finite dimensions. Margins must be non-negative and leave a positive printable area.

## Rendering

The viewport scene projects physical sheet coordinates through the existing camera into a renderer-neutral `paperSpaceOverlay`. Both renderers consume the same paper fill and boundary data. Model grid, axes, geometry, selection, and commands remain isolated while a Layout is active. Entering a Layout fits its sheet once; subsequent pan and zoom affect only projection, never physical page dimensions.

## Page Setup

Layout-tab Page Setup edits the active Layout through `layoutGateway.setPageSetup`. Each accepted setup is one normal document transaction with exact Undo/Redo and dirty-state behavior. Model has no page configuration.

## Persistence and exchange

Native v3 files preserve page configuration exactly. PS1-era Layout paper records migrate deterministically to A4 landscape with 10 mm margins. Malformed explicit page data is rejected before document replacement, preserving the current Model document.

DXF remains Model Space-only. PS2 does not export or infer paper sheets, printable areas, or Paper Space records.

PS3 owns Layout Viewports. PS4 and later plotting stages own printable output and PDF generation.
