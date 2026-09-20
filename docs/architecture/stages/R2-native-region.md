# R2 — Native Region and explicit Region command

R2 adds a persistent semantic `region` record. A Region owns an immutable snapshot of one or more validated R1 boundary loops; it does not reference or consume its source objects. Each record, loop, edge, and finite edge endpoint has a stable identity. Outer loops are counter-clockwise, holes are clockwise, and nesting depth determines filled/hole/island parity.

## Creation

`Region` (`REG`) uses normal editor selection followed by Enter. Supported sources are one closed straight-segment Polyline, Circle, full Ellipse, or an already ordered closed Line/Arc chain. Multiple non-touching or nested loops are accepted when R1 can classify them unambiguously. Open, branching, touching, intersecting, self-intersecting, degenerate, unsupported, or excessive input is rejected without publication. Successful creation publishes exactly one Region in one transaction and retains every source record.

## Integration

Regions render as boundary-only geometry through the renderer-neutral scene and inherit ordinary layer and ByLayer/object properties. Boundary or filled-interior selection selects the whole Region; holes do not select, while nested islands do. Window/Crossing queries use the complete boundary. One centroid whole-object grip translates the semantic record.

Move, Copy, Rotate, Scale, Mirror, Delete, Undo, and Redo operate on the whole record. Copy assigns fresh identities throughout the topology. Mirror reverses loop traversal so canonical orientation and hole parity remain valid. Bounds are derived from exact semantic edges. Region boundaries intentionally contribute no Object Snap or Track candidates in R2.

## Persistence and interoperability

Region is an additive format-v3 record. Save/Open preserves exact topology, properties, nesting metadata, and identities; older v1/v2 migration remains unchanged. Region is drawing state, not a preference. DXF export rejects a native Region explicitly as unsupported rather than flattening or silently losing its semantics.

Deferred work includes automatic boundary discovery from unordered/intersecting geometry, splitting and healing, fill/hatch rendering, Boolean operations, associative source links, Region-specific Osnap/Track, and DXF REGION/HATCH interoperability.
