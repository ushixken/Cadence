# DXF8 — Final compatibility audit

DXF8 audits the complete DXF exchange boundary after native Regions/Hatches, Groups, Blocks, advanced annotations, and Layouts were added. The beta contract remains a bounded, renderer-neutral ASCII DXF subset. Import builds and validates an isolated native store before replacement; export validates the current document and preflights every Model-space and Block-definition record before producing output.

## Compatibility matrix

| Native/DXF feature | Import | Export | Beta contract |
|---|---|---|---|
| Line / `LINE` | Supported | Supported | Planar 2D, default extrusion |
| Polyline / `LWPOLYLINE`, legacy `POLYLINE` | Supported | Supported as `LWPOLYLINE` | Straight open/closed vertices; widths, bulges, meshes, fitted and 3D variants are diagnosed and skipped |
| Circle / `CIRCLE` | Supported | Supported | Positive planar radius |
| Arc / `ARC` | Supported | Supported | Clockwise native arcs export as the equivalent counterclockwise DXF locus with a warning |
| Ellipse / `ELLIPSE` | Supported | Supported | Full planar ellipse only; partial ellipses are diagnosed and skipped on import |
| Native Region | Unsupported | Rejected | Never flattened or silently emitted |
| Native solid/named Hatch; DXF `HATCH` | Unsupported | Rejected | Never approximated or silently emitted |
| Layers | Supported | Supported | Name, visibility/off, lock, true color, supported linetype and lineweight |
| ByLayer properties | Supported | Supported | Native null property values |
| Explicit object properties | Supported | Supported | True color plus the supported linetype/lineweight subset |
| ByBlock properties | Lossy import | Not emitted | Diagnosed and mapped deterministically to native ByLayer |
| Single-line Text / `TEXT` | Supported | Supported | Left/Center/Right, height and rotation; nonstandard style is diagnosed and mapped to native annotation presentation |
| `MTEXT` / rich formatting | Diagnosed and skipped | Unsupported | No silent conversion to single-line Text |
| Linear and aligned dimensions | Supported | Supported | Horizontal/vertical linear and semantic aligned forms |
| Angular dimensions | Supported | Supported | Three-point angular form only |
| Radius and diameter dimensions | Supported | Supported | Non-associative semantic snapshots |
| Ordinate, arc-length, center mark/line and other newer AN1 records | Unsupported DXF forms are diagnosed and skipped | Rejected | Baseline/Continue results remain ordinary supported Dimensions |
| Named DIMSTYLE | Supported subset | Supported subset | Numeric presentation fields only; unsupported formatting is diagnosed or rejected |
| AN3 prefix/suffix, tolerance and manual text-placement controls | Lossy input is diagnosed | Rejected | Export never silently drops native dimension controls |
| Leader / MLeader | Diagnosed and skipped | Rejected | No geometry approximation |
| Block Definition / `BLOCK` | Supported | Supported | User definitions, including unused definitions, emitted once |
| Block Instance / `INSERT` | Supported | Supported | Uniform similarity transforms; nested Blocks supported; nonuniform/3D transforms rejected |
| Groups | No DXF Group import | Lossy with warning | Member geometry exports normally; `DXF_EXPORT_GROUPS_FLATTENED` reports that native membership is not preserved |
| Units | Supported | Supported | in, ft, mm, cm, m with 1:1 coordinates |
| Layouts, Paper Space, Layout Viewports, Page Setup | Deliberately unsupported | Deliberately excluded | DXF exchange is Model Space-only |

Unknown or unsupported DXF entities are skipped with bounded structured diagnostics. Malformed instances of supported entities are fatal rather than partially interpreted. Newer CAD operations require no special DXF representation when their published result consists only of supported records.

## Round-trip and fixture policy

Semantic round trips cover mixed geometry, Layers and ByLayer/explicit properties, Text, supported Dimensions/DIMSTYLE, Block Definitions, nested Inserts, transforms, and combined drawings. Native identities are deliberately regenerated on import; comparisons use geometry, properties, layer/style names, Block graph structure, and transforms rather than byte order or record IDs. Deterministic sorting makes a second supported Caderact → DXF → Caderact generation stable after permitted Arc canonicalization.

The repository's original hand-authored AC1018 fixture models common desktop-CAD output with handles, owner references, subclass markers, extra metadata, scientific notation, noncanonical legal table ordering, Layers, Text, DIMSTYLE, DIMENSION, and its anonymous presentation Block. LF, CRLF, and whitespace variants are derived in tests. This is a compatibility sample, not a claim of universal producer/version coverage.

## Layout, import, and file-safety boundaries

Only `document.geometry.objects` enters the DXF `ENTITIES` section. Native Layout/Paper Space records, viewports, page setup, plot configuration, and PDF state are neither exported nor mutated. Imported DXF replaces Model content only through the existing atomic document-replacement path; parsing, mapping, graph validation, or publication failure leaves the active document, history, dirty state, recovery state, and native file state unchanged.

DXF export is read-only. Success, warning, or failure does not create history, increment revision, acknowledge native save, clear dirty state, change filename/handle, or alter Model/Layout data. Unsupported native records in Model space or any Block Definition reject before an external write begins. DXF never becomes the native save target.

## Remaining limitations

The public-beta subset excludes binary DXF, arbitrary OCS/3D geometry, Splines, polyline bulges/widths, partial ellipses, MTEXT/rich fonts, Region/Hatch exchange, Leader/MLeader, Groups as DXF Groups, attributes, array Inserts, nonuniform transforms, full Layer-0/ByBlock inheritance, associative dimensions, ordinate/arc-length dimensions, advanced AN3 dimension formatting, Layout/Paper Space/Viewports, and merge import. Unsupported content is diagnosed, rejected when native export fidelity would be lost, or skipped only under the explicit import policies above.
