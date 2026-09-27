# PDF1 — Plot Preview

Plot Preview is an ephemeral Layout-context inspection surface. `CaderactPlotScene` remains the sole output interpretation: the preview creates the same physical page-space scene that PDF2 will serialize and merely rasterizes those vector primitives for screen display.

The dialog shows the physical sheet, printable boundary, clipped viewport content, geometry, text, and dimensions using the active Color, Grayscale, or Monochrome mode. Its canvas contains no editor canvas background, grid, axes, selection, grips, crosshair, snap or tracking feedback, Dynamic Input, or viewport editing affordances.

Fit Page derives screen magnification from the physical page dimensions while maintaining its aspect ratio. Preview zoom changes only screen magnification; page millimetres, margins, offsets, Layout 1:1 output, and PS3 viewport scales remain unchanged.

The compact header exposes Close, Fit Page, zoom controls, current paper/orientation/color metadata, and the existing Page Setup entry. While open, committed history changes—including Page Setup changes—regenerate the scene from the active document. Closing and reopening also rebuilds it, preventing stale output.

Opening, fitting, zooming, refreshing, and closing do not mutate document state, history, revision, persistence, or workspace preferences. Missing Layouts and plot-scene failures produce restrained feedback instead of document changes.

PDF2 is intentionally deferred. It will serialize the underlying vector `CaderactPlotScene`; it must not depend on preview pixels or canvas screenshots.
