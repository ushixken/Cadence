# L4 — Object Properties Foundation

## Status and boundary

Implemented. L4 establishes persistent object appearance properties and their document APIs. Rendering remains visually unchanged until L5, and the user-facing Properties panel remains L6 work.

## Schema and ByLayer

Every newly created drawable record contains `color`, `linetype`, and `lineweight`. A `null` object value means ByLayer; no display string is persisted. New layers carry explicit defaults of `#e8edf4`, `continuous`, and `0.25`. The color preserves the current committed-geometry appearance; lineweight is a millimetre-style document/plot value rather than a CSS-pixel width.

Supported explicit values are strict `#RRGGBB` colors, stable linetype IDs `continuous`, `dashed`, `dotted`, and `dash-dot`, and lineweights `0.13`, `0.18`, `0.25`, `0.35`, `0.50`, `0.70`, and `1.00`.

`CaderactObjectProperties` is the renderer-neutral pure authority for validation, normalization of legacy omissions, and effective resolution. An object override wins; otherwise the owning layer value is returned. L5 renderers must consume this resolver rather than reproduce ByLayer rules.

## Editing and mixed values

`recordGateway.setProperties(recordIds, patch)` validates the complete patch and every source before opening one transaction. Only visible, unlocked, existing records are editable. IDs, topology feature IDs, geometry, and layer ownership are retained. No-op batches publish nothing. Undo and Redo therefore restore exact override values in one history step.

`reader.aggregateRecordProperties(recordIds)` returns a shared value when all records agree and the exported `MIXED` symbol otherwise. `MIXED` is read-side runtime state and cannot be serialized.

## Persistence compatibility

The file envelope and `fileVersion: 1` remain unchanged. The three fields are optional compatible additions to each strict v1 record and layer shape. Old files with omitted fields load as ByLayer records and appearance-preserving layer defaults; new files serialize all fields deterministically. Invalid values and all other unknown fields remain atomic load failures.

## Command preservation

Move, Rotate, Scale, Mirror, grip replacement, and identity-copy helpers preserve properties naturally through record spreading. Copy and Mirror-copy allocate fresh record/topology identities while retaining overrides. Offset creates fresh geometry on the source layer and copies the source overrides. Trim replacements and any created siblings inherit the target overrides; Extend replacements do likewise.

## Deferred

L5 owns color, linetype, and lineweight rendering and display mappings. L6 owns the full Properties panel and context-menu entry. Custom linetypes, transparency, fills/materials, plot styles, ByBlock, per-viewport overrides, property matching, and layer-property UI are outside L4.
