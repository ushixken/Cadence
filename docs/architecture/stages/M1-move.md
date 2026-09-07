# M1 — Move

## Workflow and phases

Move is a repeatable modify command (`Move`, alias `M`) operating on stable
record IDs in the transient SelectionManager. A preselection starts directly
at `Specify base point`. With no preselection, Move remains in `Select objects`
while the existing D3 click and D3A Window/Crossing paths update selection;
Enter or quick Space confirms a non-empty selection. It then accepts a base
point and a second point through the existing D1/U5C input paths.

Escape cancels any phase without changing the document and retains ordinary
selection. During postselection, an empty confirmation keeps Move active.
Point acquisition owns the viewport and hides grips under the existing command
ownership rule.

## Translation and identity

`CaderactGeometryTransform.translateRecord(record, dx, dy)` is the pure,
renderer-neutral transform boundary. The command derives one vector from
`dx = target.x - base.x` and `dy = target.y - base.y` and applies it equally to
every captured selected record.

- Line translates start and end while retaining endpoint feature IDs.
- Circle translates its center and retains radius.
- Arc translates center, start, and end while retaining radius, sweep, and
  endpoint feature IDs.
- Ellipse translates only its center. `majorAxis` is a vector and is unchanged;
  `minorRadius` is unchanged.
- Polyline translates every ordered vertex while retaining feature IDs and its
  open/closed flag.

Every replacement retains record ID, layer, type, and topology identity. Move
is not Copy and does not change the persistent schema or file version.

## Preview, snapping, and publication

After the base point, the Move session owns one current resolved candidate and
derives one transient translated record collection. ViewportScene suppresses
the selected source records from the normal authoritative pass, then projects
their authoritative positions into a dedicated subdued source-ghost group and
the translated records into the active preview groups. It also derives a fixed
six-CSS-pixel base-point marker and a base-to-candidate displacement guide from
the same candidate driving the translation. These semantic scene groups are
consumed equivalently by Canvas2D and WebGPU; they are not document records,
selection identities, hit targets, or snap candidates. Pointer movement never
changes document, revision, history, or dirty state. Renderer recovery simply
rebuilds all feedback from the retained command state.

Base-point acquisition may snap to all committed geometry. During second-point
acquisition, selected source record IDs are excluded from D2A candidates to
avoid transformed-self feedback; unselected committed geometry and Grid remain
available, and Shift retains its existing temporary bypass behavior. Preview
and final acceptance use the same resolved candidate.

A non-zero Move validates and replaces every record through one short
transaction, producing one revision and one history entry. Failure publishes
nothing and retains the candidate for retry. Zero translation completes as a
no-op without a transaction. Stable IDs mean selection remains on the moved
objects, and Undo/Redo restores exact old/new geometry and identities.

Copy, Rotate, Scale, multiple-copy mode, displacement shortcuts, scalar
constraints, Ortho/Tracking, gizmos, sub-object Move, and grip Move remain
deferred.
