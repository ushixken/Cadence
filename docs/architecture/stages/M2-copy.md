# M2 — Copy

## Command and workflow

Copy is a repeatable modify command. `C` remains Circle's established alias,
so Copy uses the non-conflicting alias `CP`. It reuses M1's preselection and
postselection phases: an existing selection proceeds to base-point input;
otherwise D3 click and D3A Window/Crossing selection remain active until Enter
or quick Space confirms a non-empty selection.

## Copy versus Move

Both commands derive one translation from the accepted base and destination
points and reuse `CaderactGeometryTransform.translateRecord`. Move replaces
stable source records and displays a subdued source ghost. Copy leaves its
authoritative selected sources normally rendered and projects only translated
duplicates through the renderer-neutral preview groups. The shared fixed-size
base marker and displacement guide use the same resolved destination candidate.
No preview record enters the document.

## Identity and publication

Persistent identities are allocated only at final non-zero acceptance through
`recordGateway.copyWithFreshIdentity`, after the editor-owned transform helper
has produced translated geometry. Every duplicate receives a new record ID. Line
and Arc receive fresh endpoint feature IDs, and every Polyline vertex receives
a fresh feature ID in the same semantic order. Type, layer, radius, sweep,
Polyline closure, and all other geometry semantics are retained. Ellipse
`majorAxis` remains an untranslated vector.

All duplicates publish through one `createAll` transaction and one history
entry. Failure publishes nothing and keeps the geometric preview available for
retry; unused non-recycling IDs remain an internal allocator detail. After
success, only the new records are selected. Undo removes the complete copied
set while leaving sources exact, and Redo restores the same copied record and
feature IDs. Zero displacement completes without creating coincident records
or changing document/history state.

## Snapping and lifecycle

Committed source geometry remains eligible for D2A snapping during destination
acquisition because it is useful placement geometry. Transient copies never
enter SnapResolver and cannot create feedback loops. Grid state and Shift
bypass are unchanged. Escape, pointer cleanup, zero completion, and successful
completion clear preview and from-to feedback; renderer recovery rebuilds them
from retained command state. No schema or file-version change is required.

Multiple placement, copy-in-place, arrays, displacement shortcuts, From,
Rotate, Scale, Mirror, grip/sub-object Copy, Ortho, Tracking, and Dynamic Input
remain deferred.
