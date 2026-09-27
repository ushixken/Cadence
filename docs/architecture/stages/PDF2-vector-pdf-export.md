# PDF2 — Vector PDF Export

PDF2 serializes the same immutable `CaderactPlotScene` built for PDF1. The export UI calls the preview's scene-preparation boundary, then passes that exact page-space scene to `CaderactPdfSerializer`; it contains no separate geometry, viewport, clipping, color, or annotation interpretation.

## Serializer

The dependency-free PDF 1.4 writer converts physical millimetres to PDF points using `72 / 25.4`. The page MediaBox therefore matches the configured sheet size and orientation. Plot-scene segments become PDF path operators and annotation entries become PDF text operators with position, size, rotation, and effective output color preserved. Curves, dimensions, and leaders are emitted as the vector segments already produced by PS4; no canvas or raster screenshot participates.

The current text strategy uses the standard PDF Helvetica/WinAnsi font. Encodable text remains searchable vector text. Unsupported Unicode is replaced deterministically with `?` and returned as an explicit serializer warning rather than being silently dropped. Embedded Unicode fonts are deferred.

## Export safety

Export PDF is visible only in Layout context and shows the current Layout, filename, paper/orientation, and output color mode. Filenames are sanitized and normalized to `.pdf`. Browser download uses a short-lived `application/pdf` Blob URL and reports only that the download was initiated; browser durability cannot be claimed.

PDF output never updates `DocumentFileState`, native filename or handle, saved-state tokens, history, revision, dirty state, recovery state, or DXF. Preparation, serialization, and observable download failures return safely without drawing mutation.

## Deferred

Future work may embed a Unicode font, add native curve operators where the plot scene exposes curve primitives, represent hatch fills directly in the plot scene, support multiple Layout pages, and integrate File System Access API destinations. Raster fallback is intentionally absent rather than being used as a normal output path.
