# GB10 — DXF Block / Insert interoperability

GB10 maps a deliberately bounded DXF `BLOCK`/`ENDBLK`/`INSERT` subset to native Caderact Block Definitions and Block Instances. DXF remains an interchange boundary: handles are not persisted, imported records receive fresh native identities, and native format version 3 gains no DXF fields.

## Import pipeline

The bounded group-code parser reads `BLOCKS` into neutral definitions and parses their members through the same entity parser used for model-space `ENTITIES`. Import then creates a case-insensitive name table, establishes all definition identities, resolves model and nested `INSERT` references (including forward references), validates the complete native graph, and returns one isolated store. Missing or duplicate names, malformed termination, cycles, excessive depth/resources, and unsupported transforms reject the complete import; no valid prefix is published.

Anonymous/system names beginning with `*` are not user definitions. They are skipped with an explicit diagnostic, which retains the existing DIMENSION anonymous-block convention without importing paper-space or generated blocks as user content.

## Geometry and properties

Definition members use the existing safe DXF subset: Line, Polyline, Circle, Arc, full Ellipse, Text, and the supported Dimension forms. Nested INSERT remains a nested Block Instance. Region and Hatch remain unsupported; export preflight rejects a definition containing either rather than flattening or silently dropping it.

Explicit member layers and supported explicit/BYLAYER properties use the DXF3 mapping. A member on DXF Layer 0 remains explicitly on native Layer 0; Caderact does not emulate AutoCAD's insertion-layer inheritance. BYBLOCK color is diagnosed and mapped deterministically to native ByLayer, as in the existing property policy. BYBLOCK linetype and lineweight pass through the existing fallback mapping. This is an intentional visual/semantic approximation, not a claim of full BYBLOCK support.

## Transform mapping

The DXF BLOCK base point is preserved directly. Definition members are not translated; runtime placement continues to use `translation = insertionPoint - A × basePoint` through the native similarity-transform authority.

DXF rotation degrees are converted to canonical native radians. Scales must be finite, nonzero, and uniform within relative tolerance `1e-9`: `abs(sx) == abs(sy)`. Positive axes map to normal scale; negative X maps to native reflection; negative Y maps to reflection plus 180° rotation; two negative axes map to normal scale plus 180° rotation. Native scale is always positive. Export emits the deterministic inverse representation: normal `(s, s)` or reflected `(-s, s)`, with rotation in degrees. Z scale must be the harmless DXF default `1`; 3D transforms and nonuniform scale reject.

## Export and round trips

Export preflights model space and every definition member before producing output. Every valid user definition, including unused definitions, is emitted exactly once in deterministic name order. Model-space instances and nested members emit `INSERT` references; definitions are never duplicated per instance and groups are never converted into blocks. Text and supported Dimensions remain semantic entities. DIMENSION's generated anonymous blocks remain separate from user definitions.

Round trips guarantee supported semantic equivalence, shared-definition structure, base points, instance transforms, member order, layers, and properties—not reproduction of native record, feature, or definition IDs. A DXF import followed by native save/load uses the ordinary v3 persistence and all imported instances immediately use normal block rendering, selection, Osnap, tracking, and measurement paths.

## Limits and incompatibilities

Both DXF parser limits and native graph limits apply: 5,000 definitions, 10,000 members per definition, 100,000 model instances, 100,000 reference edges, and nesting depth 32. General AutoCAD BLOCK compatibility is outside this beta: attributes, arrays, layouts/paper space, arbitrary 3D transforms, nonuniform scaling, full Layer-0 inheritance, full BYBLOCK inheritance, Region/HATCH interchange, and DXF Groups are not supported.

GB11 should harden interoperability fixtures, hostile/resource cases, diagnostics, and cross-product round trips without moving DXF semantics into runtime traversal or rendering.
