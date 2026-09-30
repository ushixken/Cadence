# PLOT1 — Page Setup and Plot Foundation

Page Setup owns only a Layout's persistent physical sheet: paper preset, orientation, millimetre-backed width and height, and printable margins. Its UI can display and edit millimetres or inches, converting at the boundary without changing the internal physical representation. Applying Page Setup is one document transaction; canceling is non-mutating.

The production Page Setup surface presents these physical settings beside ephemeral output controls and a live physical-page preview. This is a unified interaction surface, not a merged state model: Apply publishes only the physical sheet through the Layout gateway. Output controls construct a temporary `CaderactPlotJob` and never enter document history or persistence. The right preview accepts the draft sheet plus that temporary job through `CaderactPlotOutput` and `CaderactPlotScene`, so unapplied paper edits can be inspected without mutating the Layout.

Output choices belong to `CaderactPlotJob`, an immutable, validated, ephemeral value. PLOT1 supports PDF destination, vector output, Layout area, physical 1:1 sheet output, centered or millimetre-offset placement, and Plot Color, Display Color, Grayscale, or Monochrome transformation. Plot Color and Display Color currently preserve the same resolved explicit/ByLayer colors because plot-style tables are not implemented.

`CaderactPlotOutput` is the current-document preparation boundary. It validates the PlotJob, reads the active Layout and document authorities, and creates one `CaderactPlotScene`. Plot Preview and PDF Export independently consume that same boundary; PDF no longer depends on the preview controller.

Legacy native-v3 `paper.plot` metadata is accepted on load and discarded during normalization. New saves omit it. This preserves file compatibility while preventing output-job state from becoming Layout sheet state.

Raster output, Extents/Window/Selected/View areas, Fit to Paper, output-level standard/custom scaling, physical printers, plot-style tables, and multi-Layout jobs are explicitly deferred. Their controls are disabled rather than simulated. Layout Model View scale remains the sole Model-to-paper scale for normal Layout output.
