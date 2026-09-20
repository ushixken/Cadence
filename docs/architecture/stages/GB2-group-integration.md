# GB2 — Group Integration

GB2 integrates GB1 Groups into ordinary CAD interaction while retaining their geometry-free ownership model. Members remain normal model-space records; a Group remains only `{ id, name, memberIds }` relationship metadata.

## Logical selection targets

The selection authority resolves a hit record into either `{ kind: "record", id, recordIds }` or `{ kind: "group", id, recordIds }`. Its public record-ID projection is canonical and expanded, so existing renderer-neutral highlights, command previews, transform sessions, Properties, and Layers consume one deduplicated member set. `selectedTargets()` preserves the logical target representation for interaction code. A Group and one of its members cannot coexist as separate selected targets.

Clicking any eligible member selects every member. A left-to-right Window selects a Group only when every member is contained; a right-to-left Crossing selects it when any member intersects or is contained. Results remain sorted and deduplicated.

## Visibility, locking, and grips

A Group is whole-editable only when every member exists on a visible, unlocked layer. If any member is hidden or locked, no member is exposed as an independent normal selection target and whole-Group selection/editing is refused. Locked members retain the repository's existing rendering and snap/track participation; hidden members retain existing layer behavior.

GB2 exposes no Group or member grips while a Group is selected. This conservative policy prevents partial topology edits and adds no synthetic centroid or Group geometry.

## Editing and identity

Delete removes all members and Group metadata in one existing document transaction. Undo restores the exact Group, records, features, and data; Redo removes the same state.

Move, Rotate, Scale, and non-copy Mirror feed the expanded member set through the existing `CaderactGeometryTransform` functions and publish all replacements in one transaction. Group and member identities remain unchanged according to each native transform's established semantics. Existing multi-record previews show every member, and Escape discards only transient command state.

Copy and copy-mode transforms allocate fresh native record/topology identities first, then publish all copies and a fresh Group in one transaction. Original records and Group remain unchanged. Copied membership is canonical, and copied Groups receive the next deterministic Group name. Partial Group Copy is rejected.

## Layers and Properties

Properties aggregates the expanded member records with the existing common/MIXED/ByLayer rules. Layer, color, linetype, and lineweight edits apply atomically to all members and are rejected when any member is not editable. No appearance or layer field is added to Group metadata. Multiple logical targets flatten to unique record IDs before aggregation or mutation.

## Non-authorities and atomicity

Groups add no renderer geometry, Object Snap candidate, Track origin, measurement object, or persisted interaction state. Selection highlighting is produced solely by highlighting the ordinary member records in the shared scene, preserving Canvas2D/WebGPU parity. Member Osnap, Track, and measurement semantics remain unchanged.

All Group operations validate the complete record set before publication. Failed transforms, copies, property edits, layer assignments, or active-transaction publication attempts leave document, Group metadata, selection, and history unchanged.

## GB3 boundary

GB2 does not add nested Groups, multiple membership, individual-member selection overrides, Group-specific grips or properties, Blocks, Block Definitions, or Block Instances. Those remain future design work.
