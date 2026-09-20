# GB3 — Block Definition and Instance Foundation

GB3 introduces the non-interactive semantic foundation for reusable Blocks. A Block Definition is document-owned content outside model space. A Block Instance is an ordinary model-space record that references one Definition and applies a uniform similarity transform. Expanded geometry is never persisted.

## Schemas and identity

A Definition has the closed shape `{ id, name, basePoint, records, recordOrder }`. `records` contains native Line, Circle, Arc, Ellipse, Polyline, Region, Hatch, Text, Dimension, or nested Block Instance records. `recordOrder` is the complete, duplicate-free deterministic member order. Definitions have unique case-insensitive names of at most 128 characters and finite base points. Groups and transient/derived geometry are not valid members.

A model-space Block Instance has `{ id, type: "block-instance", layerId, color, linetype, lineweight, definitionId, insertionPoint, rotation, scale, mirrored }`. Its insertion point owns a feature ID. Rotation uses the canonical interval `(-π, π]`, scale is positive, finite, and uniform, and `mirrored` is Boolean. Nonuniform scale has no representation.

Definition IDs, member record and feature IDs, Instance IDs, and insertion feature IDs participate in the existing global non-recycling identity space. Runtime expansion allocates no persisted identity. Definition-member identities remain exact across history and persistence.

## SimilarityTransform

`CaderactSimilarityTransform` is the pure matrix authority. It stores `worldPoint = A × localPoint + t`, validates that `A` is a nonsingular uniform orthogonal scale (optionally reflected), and exposes identity, component construction, point/vector application, composition, inverse, determinant, decomposition, reflection state, scale extraction, and canonical-angle normalization.

For an Instance, `t = insertionPoint - A × definition.basePoint`. Reflection is represented by a negative determinant while reported scale remains positive. Composition is `Acombined = Aparent × Achild` and `tcombined = Aparent × tchild + tparent`. Invalid, nonfinite, singular, nonuniform, and overflowing operations fail.

`CaderactGeometryTransform.similarityRecord` reuses the established native scale, mirror, rotate, and translate semantics. It transforms semantic Region/Hatch loops, Text, and Dimension definition geometry; triangulation, hatch strokes, and annotation presentation remain derived.

## Document APIs and history

The model reader provides deterministic `blockDefinitions()` and `blockDefinition(id)` queries. The Block Definition gateway provides atomic create, replace, remove, and graph-validation operations. Removal is refused while any model-space or nested Instance references the Definition. The normal record gateway constructs Block Instances with fresh record/insertion identities.

Definition mutations and Instance publication use normal document transactions. Validation failure publishes nothing and creates no history. Undo/Redo restore exact Definition/member/Instance identities and data.

## BlockTraversal

`CaderactBlockTraversal.traverse(document, instance, limits)` resolves Definitions in `recordOrder`, composes transforms through nested Instances, and returns immutable semantic leaves. Each leaf includes its source record, Definition ID, composed transform, complete Instance path, and an unambiguous runtime semantic ID derived from that path and member ID.

Traversal is pure: it mutates nothing, allocates no persisted IDs, and persists no cache or expansion. It independently rejects missing Definitions, cycles, excessive depth, semantic-record overflow, and visit overflow even after document validation.

## Cycles and limits

Definition-reference graphs are validated deterministically on every transaction and persistence load. Direct and indirect cycles are rejected. The maximum nesting depth is 32, inclusive.

The beta limits are 5,000 Definitions, 10,000 members per Definition, 100,000 model-space Instances, 100,000 definition-reference edges, 100,000 semantic leaves per Instance traversal, and 1,000,000 traversal visits per operation.

## Persistence and deferred integration

Format v3 stores Definitions deterministically by Definition ID and members in `recordOrder`; Instances persist only their semantic reference and transform fields. Older v3 documents without `blockDefinitions` load with an empty table. Strict loading rejects stale references, identity collisions, invalid transforms, cycles/depth overflow, malformed ordering, excessive counts, and unexpected fields.

GB3 intentionally adds no Block/Insert commands, expanded rendering, definition-member selection, grips, subobject editing, Osnap, Track, measurement, or DOM annotation expansion. Canvas2D and WebGPU remain unaware of Blocks. GB4 can consume the reader, Definition gateway, Instance constructor, SimilarityTransform, semantic record transform, and bounded traversal APIs for renderer-neutral display integration.
