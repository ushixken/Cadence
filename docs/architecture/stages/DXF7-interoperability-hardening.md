# DXF7 — Interoperability hardening and beta audit

DXF7 audits the complete DXF1–DXF6 import/export pipeline without expanding its CAD feature scope. The supported subset is beta-ready for explicit, semantic ASCII DXF interoperability—not general AutoCAD compatibility.

## Pipeline and audit findings

Import remains `ASCII DXF → bounded parser → immutable neutral values → isolated native store → native validation → one document replacement`. Export remains `validated semantic document → deterministic mapper/writer → AC1018 ASCII`. Neither path reads renderer output or DOM state. Canvas2D, WebGPU, native geometry, and annotation rendering contain no DXF-specific behavior.

Two correctness gaps were fixed:

- A supported `DIMENSION` must now contain exactly one integer group 70 type flag. Its absence is malformed input and fails atomically instead of silently becoming linear type 0.
- Unsupported DIMSTYLE semantics now produce stable warnings. Nonzero tolerance/alternate-unit flags produce `DXF_DIMSTYLE_SEMANTICS_UNSUPPORTED`; negative `DIMGAP` imports its safe absolute spacing while explicitly warning that the text-box flag was not preserved.

## Fixture strategy

The repository contains a small original, hand-authored AC1018 fixture under `tests/fixtures/dxf`. It follows the public group-code specification and models common desktop-CAD output: noncanonical but legal section/table ordering, handles, owner references, subclass markers, extra application metadata, scientific numeric notation, Layers, Text, DIMSTYLE, DIMENSION, and an anonymous dimension block. Tests derive LF, CRLF, and group-code whitespace variants without relying on installed CAD software, network access, or copyrighted sample drawings.

## Supported-subset matrix

| DXF feature | Import | Export | Limits |
|---|---|---|---|
| LINE | Supported | Supported | Planar, default extrusion |
| LWPOLYLINE / legacy POLYLINE | Supported | Exported as LWPOLYLINE | Straight 2D open/closed vertices; no bulges or widths |
| CIRCLE | Supported | Supported | Positive radius, planar |
| ARC | Supported | Supported | Finite counterclockwise locus; clockwise native arcs canonicalize to the same locus |
| ELLIPSE | Supported | Supported | Full planar ellipse; stored major axis must remain major on export |
| TEXT | Supported | Supported | Single-line, Left/Center/Right, native height/rotation; no rich formatting/fonts |
| Layers | Supported | Supported | Name, visibility/off, locking, color, supported linetype/lineweight |
| BYLAYER properties | Supported | Supported | Native null property values |
| Explicit properties | Supported | Supported | True color, supported linetypes and lineweights |
| BYBLOCK | Fallback with warning | Not emitted | General block inheritance deferred |
| Units | Supported | Supported | in, ft, mm, cm, m; coordinates remain 1:1 |
| Linear dimensions | Supported | Supported | Horizontal/vertical only |
| Aligned dimensions | Supported | Supported | Semantic definition and placement points |
| Angular dimensions | Three-point type 5 | Three-point type 5 | Two-line/arc-length forms unsupported |
| Radius / Diameter dimensions | Supported | Supported | Non-associative semantic snapshots |
| Named DIMSTYLE | Supported | Supported | Seven mapped numeric presentation fields |
| Dimension text override | Simple import/export | Simple import/export | No compound `<>`, rich formatting, tolerances, or multiline content |
| Anonymous dimension blocks | Ignored as presentation | Minimal deterministic blocks | Never imported as duplicate geometry |
| BLOCK / INSERT | Explicitly unsupported | Deferred | No native Blocks or BYBLOCK inheritance |
| MTEXT, HATCH, SPLINE | Explicitly unsupported | Deferred | No approximation |
| Partial ellipse, OCS/3D, binary DXF | Explicitly unsupported | Deferred | No flattening or binary decoding |
| Merge import | Deferred | N/A | Open replaces atomically |

## Parser, diagnostics, and resource policy

Untrusted input is limited to 8 MiB text, 500,000 group pairs, 16,384 characters per value, 100,000 entities, 10,000 table entries, and 100 distinct diagnostics by default. Overrides used by tests must be positive safe integers. Repeated identical warnings aggregate by stable severity/code/message/section/entity type; distinct warnings beyond the cap produce `DXF_DIAGNOSTIC_LIMIT` rather than unbounded output.

Malformed supported semantics are fatal. Valid but unsupported entities or presentation details are warnings and are skipped or safely downgraded only where documented. Resource violations have dedicated errors. File actions expose structured diagnostics in their result and show warning counts through the existing feedback system without parser stack traces.

## Numerical and round-trip policy

DXF numeric input must be finite. Native validation remains the final geometry authority; corrupt values are never clamped into valid geometry. Tests cover scientific notation, negative and near-zero coordinates, coordinates at ±1e12, radii down to 1e-9, arcs crossing zero, highly eccentric valid ellipses, and awkward dimension placement.

Exact decimal fields are expected to survive JavaScript shortest-round-trip serialization. Derived angular comparisons use an absolute tolerance of `1e-12` radians in regression assertions. Round-trip identity is semantic: internal record, feature, layer, and style IDs deliberately change. After the first permitted Arc direction canonicalization, a second Caderact → DXF → Caderact generation produces identical DXF and stable classifications, geometry, properties, layers, styles, overrides, and anonymous block references.

## Determinism, performance, and mutation

Layers and styles sort by semantic name; records sort by semantic content with layer/style names substituted for internal IDs. Anonymous dimension blocks follow that record order as `*D1`, `*D2`, and so on. Equivalent documents with fresh internal identities serialize identically.

Parser iteration, layer/style reference lookup, semantic mapping, and diagnostic aggregation are linear apart from deterministic `O(n log n)` export sorting. A 2,000-entity structural smoke test exercises parse, isolated import, validation, and export without timing-dependent assertions. Existing maximum limits remain the security boundary for larger hostile files.

Import failures leave the active document, history, revision, and records unchanged. Export success and failure are read-only: filename, save acknowledgement, dirty state, history, revision, current layer/style, records, IDs, and features are unchanged.

## Security and file boundary

DXF remains data. Codes and numeric values are parsed without evaluation. Text and names never become HTML in the DXF pipeline; a script-looking Text payload remains inert native text. Unicode decoding recognizes only bounded `\U+XXXX` forms, and decoded control characters are rejected by the native Text/dimension rules. Binary input, NUL-bearing text, incomplete pairs, invalid group codes, pathological strings, and limit excesses fail before publication. Export uses the existing file adapter and does not derive filesystem paths from DXF contents.

## Beta verdict and deferred work

**DXF BETA-READY** for the matrix above. The fixture corpus, hostile-input tests, numerical edges, repeated semantic round trip, deterministic output, stress smoke test, document atomicity, export non-mutation, and renderer-neutrality all pass.

The beta label is intentionally narrow. General BLOCK/INSERT and BYBLOCK inheritance, Hatch, Splines, MTEXT, arbitrary Text Styles/fonts/linetypes, partial ellipses, associative dimensions, arbitrary rotated/ordinate/arc-length dimensions, tolerances/GD&T, alternate units, rich dimension formatting, custom arrow blocks, arbitrary OCS/3D, binary DXF, and merge import remain deferred beyond DXF7.
