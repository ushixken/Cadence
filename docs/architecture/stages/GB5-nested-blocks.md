# GB5 — Nested Blocks and transform composition

GB5 makes Block Instances valid members of Block Definitions. A nested member is always a semantic reference to an existing definition; authoring never copies the referenced definition, flattens its geometry, or persists expanded scene records.

## Authoring and ownership

The `Block` command accepts selected model-space Block Instances alongside the native GB4 member types. Groups remain rejected. Snapshotting an instance preserves its referenced definition, insertion point, canonical rotation, positive uniform scale, explicit `mirrored` flag, layer, and object properties while assigning a fresh member record ID and insertion feature ID. The selected source and referenced definition remain unchanged.

Definition publication continues through `blockDefinitionGateway`. Consequently the GB3 document validator—not command-specific graph logic—is authoritative for missing references, cycles, depth, global identity uniqueness, edge limits, and malformed transforms. Failed validation publishes no definition or history entry.

## Composition and reflection

`CaderactBlockTraversal` recursively composes only `CaderactSimilarityTransform` matrices. For parent `P` and child `C`, the combined transform is `P × C`; linear parts and translations therefore follow `Aparent × Achild` and `Aparent × tchild + tparent`. Semantic source records are transformed once from their definition-local coordinates by the final composed transform.

Uniform scale remains positive. Reflection remains an explicit determinant state and is never represented by negative scale. A reflected parent and reflected child compose to a non-reflected transform. Rotation extracted for semantic record transformation is canonical and finite.

## Runtime identity and determinism

Each traversal entry includes its source definition/member identity, ordered `instancePath`, composed transform, and a runtime-only `semanticId` containing the complete outer-to-inner instance path plus member ID. Repeated references to one definition are distinguishable even when their underlying member IDs are shared. Definition-table enumeration order and unrelated definitions do not affect traversal order or output.

Runtime paths and semantic IDs are derived state. They are never stored in documents or save files.

## Validation and resource limits

Persisted graph validation rejects direct and indirect cycles, stale references, noncanonical/nonfinite transforms, duplicate identities, more than 32 definition levels, and more than 100,000 reference edges. Existing definition/member/model-instance limits remain 5,000, 10,000, and 100,000.

Traversal independently enforces depth 32, 100,000 emitted semantic records, and 1,000,000 visits. These runtime checks apply even to unvalidated input and bound wide or exponential-looking reuse graphs.

## Rendering and interaction

Nested display retains the renderer-neutral GB4 chain:

`outer instance → BlockTraversal → composed SimilarityTransform → transformed semantic records → ViewportScene → Canvas2D/WebGPU`

Neither renderer recurses or owns Block semantics. Top-level layer visibility gates expansion, and hidden member layers are filtered at the scene read boundary. Definition-member metadata is otherwise preserved.

Text height and rotation, Dimension defining points, Region loops, and Hatch loops/pattern parameters transform from semantic authority. Annotation presentation, arrows, text, triangulation, and named-pattern segments regenerate after composition. Runtime annotation IDs use path-qualified semantic record IDs, preventing collisions between repeated instances.

Selection hit proxies expand nested geometry only for conservative hit and window tests, map every leaf back to the outer model-space Block Instance ID, and never expose definition-member IDs. Select All includes outer instances. These proxies do not enter snapping, tracking, measurement, persistence, or history.

## History and persistence

Nested definition creation remains one atomic history entry. Standard history order restores referenced definitions before their dependent definitions/instances and removes dependents before definitions. Persistence stays format v3 and serializes only definition references and semantic instance transforms. Loading uses the same graph and record validation authority and rejects malformed, cyclic, over-depth, stale, or identity-colliding nested data.

## Explicit exclusions and GB6 surface

GB5 does not add Block Edit, Explode, nested subobject selection, grips, Osnap/Track traversal, measurement traversal, reflected Insert UI, or BYBLOCK inheritance.

GB6 may build on path-qualified traversal entries, outer-instance selection proxies, the shared semantic expansion boundary, `blockDefinitionGateway`, and the existing similarity/record transform authorities without introducing renderer-owned or persisted expansion.
