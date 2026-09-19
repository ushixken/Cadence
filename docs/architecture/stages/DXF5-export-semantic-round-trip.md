# DXF5 — Export and semantic round trip

DXF5 adds deterministic ASCII DXF export for Caderact's supported interchange subset and verifies semantic Caderact → DXF → Caderact round trips. Native version 3 `.caderact` remains the authoritative persistence format; export is a read-only interoperability action.

## Version and writer architecture

The writer emits AutoCAD 2004 ASCII DXF (`$ACADVER = AC1018`). This is the earliest selected target that covers the modern entities used here and group 420 true color. The architecture is:

```text
validated native document snapshot
→ pure DXF export mapper/writer
→ deterministic ASCII group pairs
→ optional file-action download
```

`DxfExport` does not reuse parser state, access the viewport, or mutate the document. It emits minimal `HEADER`, `TABLES`, and `ENTITIES` sections followed by `EOF`. Handles are omitted because they are optional for this supported entity subset; consequently no internal Caderact ID is exposed. Layers sort by semantic name and records by semantic content, excluding record/feature IDs.

## Numbers and units

Numeric serialization accepts finite values only, normalizes negative zero to `0`, and otherwise uses JavaScript's shortest round-trip-safe decimal representation. Writer-owned constants are authored directly to avoid accumulated floating noise. NaN and infinities never reach output.

Native `in`, `ft`, `mm`, `cm`, and `m` map to `$INSUNITS` values 1, 2, 4, 5, and 6. Coordinates are not rescaled. An unsupported unit fails export.

## Layers and properties

Layers preserve name, off/visible state, locked bit, color, native linetype, and lineweight. Layer colors are written as true color with a signed fallback ACI carrying visibility. The native current layer becomes `$CLAYER`. Layer and record IDs are never serialized.

Object `null` properties write as BYLAYER (`62=256`, `6=BYLAYER`, `370=-1`). Explicit colors use group 420 true color, supported linetypes use deterministic CONTINUOUS/DASHED/DOTTED/DASHDOT definitions, and native lineweights become DXF hundredths of a millimeter. DXF5 never emits BYBLOCK.

## Geometry and Text

- Line maps to `LINE` with planar endpoints.
- Straight open/closed Polyline maps to `LWPOLYLINE`, preserving vertex order and bit 1 closure.
- Circle maps directly to planar `CIRCLE`.
- Positive native Arc sweep maps to counterclockwise DXF start/end degrees. A negative mirrored Arc swaps its geometric endpoints and exports the identical visible locus counterclockwise, with `DXF_ARC_DIRECTION_CANONICALIZED`; it never exports the complementary arc.
- Full Ellipse maps center, major-axis vector, minor/major ratio, and a `0..2π` parameter interval. A native record whose stored minor radius exceeds the stored major-axis length fails explicitly rather than silently changing representation.
- Text maps content, height, rotation, layer/properties, and Left/Center/Right justification. Center and Right write group 11/21 as the authoritative alignment point. Non-ASCII UTF-16 code units and literal backslashes use deterministic `\\U+XXXX` encoding compatible with DXF4.

## Unsupported records and file action

DXF5 fails the entire export if any native record type is unsupported. Dimensions therefore produce `DXF_EXPORT_UNSUPPORTED_RECORD`; they are not silently omitted or exploded. Invalid documents and unrepresentable values likewise fail before a file is written.

File → Export DXF writes a sibling `.dxf` download through the existing file adapter. It does not change the native filename, acknowledge a save, clear dirty state, modify history/revision, or replace the document.

## Guarantee and DXF6 boundary

DXF5 guarantees semantic round trip for the documented subset: geometry, Text anchors/alignment/rotation, layer assignment/state, supported properties, and units. It does not guarantee byte-for-byte or source-structural preservation of arbitrary input DXF.

DXF6 owns DIMENSION/DIMSTYLE. BLOCK/INSERT, real BYBLOCK, HATCH, SPLINE, MTEXT, arbitrary Text Styles/fonts/linetypes, partial ellipses, 3D/OCS, binary DXF, and merge import/export remain deferred.
