# DXF1 — DXF import foundation and Line

DXF1 introduces a Caderact-owned, read-only DXF ingestion boundary. It supports bounded ASCII DXF parsing and native planar `LINE` import. DXF remains a foreign interchange format; native persistence remains version 3 `.caderact` JSON.

## Architecture

The production path is:

```text
DXF text
→ bounded tokenizer/parser
→ neutral ParsedDxf
→ Caderact mapper
→ complete isolated document/store
→ canonical document validation
→ one DocumentSession replacement
→ existing viewport/document-replacement cleanup
```

`DxfLimits` owns resource ceilings, `DxfDiagnostics` owns structured diagnostics, `DxfParser` owns syntax and the neutral representation, and `DxfImport` owns canonical document mapping. Parser code does not access the active document, Viewport, commands, selection, or either renderer.

## Neutral representation

`ParsedDxf` contains source metadata (`acadVersion`, numeric `insertionUnits`, and, as of DXF3, `currentLayer`), supported neutral entities, immutable structured diagnostics, and the effective parser limits. DXF3 also adds neutral layer/linetype table collections. DXF handles are retained only for source correlation. They never become Caderact IDs.

## Limits and diagnostics

Defaults bound text length, group-pair count, individual string length, entity count, and diagnostic count. Malformed pairs, invalid group codes, invalid/non-finite required numbers, malformed supported Lines, structural errors, and exceeded limits reject the parse. Repetitive warnings are aggregated and excess diagnostics are summarized.

Diagnostics contain severity, stable code, message, and—where available—section, entity type, handle, and source line index.

## HEADER and units

`$ACADVER` is metadata only in DXF1. Missing `$ACADVER` produces a warning; DXF1 claims only its explicitly supported version-neutral subset.

Official `$INSUNITS` codes supported in DXF1 are 1 inches, 2 feet, 4 millimeters, 5 centimeters, and 6 meters. The mapped Caderact document unit is set while coordinate numbers are retained 1:1. Missing, unitless (`0`), invalid, or unsupported values fail import with a clear diagnostic. DXF1 never guesses physical scale.

## LINE mapping and coordinate policy

Each supported DXF `LINE` becomes one native Caderact Line through the isolated store's record gateway, receiving fresh record and endpoint feature IDs. DXF Layer 0 maps to the imported document's single visible, unlocked, default/current layer named `0`. The normal Standard dimension style remains present and current, preserving document invariants.

DXF1 accepts only zero start/end Z and the default extrusion `(0, 0, 1)`. A structurally valid Line with nonzero Z or another extrusion is skipped with a warning. Coordinates are never silently flattened and arbitrary OCS conversion is not attempted.

## Atomic Open-DXF behavior

Open DXF is replacement-drawing behavior, not merge. Parsing, mapping, record creation, and final schema validation finish in isolation. Only then does the file action replace `DocumentSession` once and invoke normal viewport/document-replacement cleanup. Any earlier failure leaves the active document, history, selection, and viewport intact.

The replacement store has empty history but is deliberately dirty/unsaved. Its suggested filename changes from `name.dxf` to `name.caderact`; subsequent Save uses native persistence.

## Supported and deferred scope

DXF1's original supported scope is ASCII group pairs, `HEADER`, minimally skipped `TABLES`, `ENTITIES`, empty drawings, and planar/default-extrusion `LINE`. DXF2 extends the same boundary with the core geometry documented in `DXF2-core-geometry-import.md`.

Unsupported but structurally valid entities and sections are skipped with warnings. Binary DXF is rejected. DXF3 supplies native layers/properties; text, dimensions, blocks, hatch, spline, MTEXT, arbitrary OCS/3D conversion, export, and merge into an existing drawing remain deferred.
