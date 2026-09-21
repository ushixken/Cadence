# GB11 — Groups + Blocks beta hardening

The GB0–GB10 Groups + Blocks track is beta-ready within the contracts and limits below. GB11 adds no new persistence or runtime authority; it verifies mixed Group/Block workflows, long identity histories, definition refresh, semantic expansion, and DXF interchange against the existing architecture.

## Final ownership contracts

A Group is document-level relationship metadata `{ id, name, memberIds }`. It owns no geometry, appearance, transform, renderer primitive, snap feature, or measurement result. Members remain ordinary model-space records.

A Block Definition is a document-owned reusable ordered collection of native semantic records outside model space. A Block Instance is one model-space record containing a definition reference, insertion feature, and bounded 2D similarity components. `BlockTraversal` and `SimilarityTransform` expand current semantics transiently. Expanded records, path-qualified runtime identities, triangulation, hatch strokes, annotation presentation, hit proxies, and tracking state are never persisted.

## Identity, nesting, and history

Record, feature, topology, Group, definition, and insertion-feature identities share one collision-checked document namespace. Copy and Explode allocate fresh persisted identities; transforms and BlockEdit preserve unchanged identities. Runtime identity is the outer/nested instance path plus semantic member ID and is unique per occurrence but never serialized.

Definition references support repeated and nested use through depth 32. Cycles, stale references, malformed `recordOrder`, noncanonical transforms, identity collisions, and limit violations reject atomically. Interleaved Group Copy, Ungroup, Explode, BlockEdit, Undo/Redo, save/load, and continued creation preserve exact valid identities and references.

## Interaction contract

A hit on a grouped member—including a Block Instance—resolves to the whole Group. Window requires containment of every member; Crossing may acquire the Group through any member. A nested Block leaf resolves only to its outer instance, or to the containing Group when grouped. Groups expose no grips; an ungrouped Block Instance exposes only its insertion grip. Nested members never become persistent selection.

Hidden members are excluded from presentation and interaction. Locked members remain rendered and usable as precision references but cannot be edited; a Group containing a hidden or locked member is conservatively non-editable. Definition-member layers/properties remain authoritative and are not replaced by the outer instance layer.

Object Snap and Track consume transformed native semantic leaves, not renderer primitives. Endpoint, Vertex, Intersection, Midpoint, Center, Quadrant, Perpendicular, Tangent, and Nearest retain the shared 10 CSS-pixel aperture, compound ranking, direct-snap precedence, H/V/Polar/Parallel tracking, four-point acquisition, Osnap-off behavior, and independent Grid behavior. Region, Hatch, and Text remain excluded according to the established policy. The custom CAD crosshair remains at the raw physical pointer while marker, preview, HUD, and acceptance use the resolved point.

Point-to-object and object-to-object measurement expands eligible Line, Circle, Arc, and Polyline leaves with bounded traversal. Heterogeneous Blocks do not acquire invented whole-object radius, length, area, or diameter. Exploded records regain their ordinary native measurement authorities.

## Editing and output

BlockEdit works on an isolated definition snapshot. Move, Copy, Rotate, Scale, Mirror, and Delete stay local until Apply. Apply replaces the definition in one transaction and every instance, renderer scene, snap source, tracking source, and measurement expansion derives the update immediately. Cancel or Escape publishes nothing. Copy gets fresh identities; cycle/depth-invalid Apply is rejected.

Explode recursively produces transformed native curves, Polylines, Region/Hatch semantics, Text, and Dimensions with fresh identities while leaving definitions unchanged. Grouped, locked, or mixed invalid selections reject deterministically. Undo/Redo restores exact pre/post identities.

Canvas2D and WebGPU consume the same `ViewportScene` records. Neither renderer knows about Groups, definitions, nesting, transform composition, selection ownership, or topology. Region loops and Hatch patterns, Text, and Dimensions remain semantic persisted data; all display geometry stays derived.

Native v3 persistence validates before publication and serializes deterministic Group and definition tables. It rejects duplicate identities, stale membership/references, cycles, excessive counts/depth, invalid transforms, malformed semantic members, and runtime fields. Older valid v3 documents remain loadable.

The GB10 DXF boundary supports the documented `BLOCK`/`ENDBLK`/`INSERT` subset, nested and forward references, base points, rotation, uniform signed scale/reflection, explicit Layer 0 approximation, BYBLOCK diagnostics, Text, and supported Dimensions. Region/Hatch export and nonuniform/3D transforms remain atomic errors rather than lossy fallbacks.

## Deterministic limits

- Groups: 10,000; members per Group: 10,000.
- Block Definitions: 5,000; members per definition: 10,000.
- Model-space instances: 100,000; definition edges: 100,000; nesting depth: 32.
- Traversal semantic leaves: 100,000; visits per operation: 1,000,000.
- Expanded scene primitives: 1,000,000; Osnap candidates per pointer evaluation: 100,000.

These are deterministic work bounds. `BlockTraversal.bounds` is available for proven hot paths, while speculative persistent caches remain deferred.

## Known beta limitations and post-beta work

Deferred work includes nested Groups, multiple Group membership, Group appearance, persistent Block subobject selection, attributes, dynamic/parametric Blocks, nonuniform scaling, associative Block-linked Dimensions, richer BlockEdit picking/UI and local history, drawing creation in BlockEdit, rename and Set Base Point workflows, general AutoCAD Layer-0/BYBLOCK equivalence, Region/Hatch DXF support, and arbitrary 3D/OCS Blocks.
