# M3 — Rotate

## Workflow

Rotate is a repeatable command with the non-conflicting alias `RO`. It reuses
M1/M2 preselection and postselection: D3 click and D3A Window/Crossing remain
active until Enter or quick Space confirms a non-empty selection. Point input
then follows three phases: center `C`, reference `R`, and target `T`.

## Copy option

Rotate exposes the transient U5B option `Copy=No/Yes`, defaulting to `No` for each command session. `No` replaces the selected records as normal. `Yes` leaves sources authoritative and creates fresh-identity rotated copies in one atomic history entry, selecting only those copies after publication. The live preview keeps the original records visible and shows only the transformed copy preview; it does not create records, snap candidates, or selection targets. Undo removes the copies and Redo restores their exact generated identities. Persistent remembered Copy preferences are deliberately deferred.

The signed rotation is derived from `atan2(R-C)` and `atan2(T-C)` and normalized
deterministically to `(-π, π]`. Equivalent geometry remains visually continuous
at the branch cut, so M3 does not accumulate turns. Direct typed angles,
Reference options and angle constraints remain deferred.

## Transform semantics and identity

`CaderactGeometryTransform.rotatePoint` and `rotateRecord` own all rotation
math. Line endpoints, Circle centers, Arc center/start/end, and every ordered
Polyline vertex rotate about `C`. Ellipse centers rotate about `C`, while the
Ellipse `majorAxis` direction vector rotates about the origin; radii, Arc
sweep, Polyline closure, record/layer IDs, and every topology feature ID remain
unchanged. Rectangle and Polygon collections rotate as selected native Lines.

## Preview and feedback

After valid `C` and `R`, the command derives every preview record using one
shared live angle. ViewportScene suppresses selected sources from the normal
pass, renders them as the same subdued stationary transform ghost used by
Move, and renders rotated records through the dominant preview groups. The
semantic overlay provides three distinct fixed-screen-space markers: a strong
center diamond/cross, a secondary reference diamond, and an active target
square/cross driven by the authoritative live candidate. The center appears
immediately after acceptance, the reference after its acceptance, and the
target only while its candidate is valid. Two renderer-neutral radial guides
(`C→R` and `C→T`) terminate at those exact marker centers. The optional angle arc is intentionally deferred because
the radial guides fully communicate M3 without adding a new curved-guide
contract. Ghosts, guides, and previews are neither document records nor
selection/snap targets; Canvas2D and WebGPU consume the same scene groups.

During target acquisition, selected source IDs are excluded from D2A to avoid
self-feedback. Unselected committed geometry and Grid remain available, and
Shift preserves its standard temporary bypass behavior.

## Commit and lifecycle

Center equal to reference and target equal to center are rejected without
mutation. Angles within `1e-12` radians of zero finish as history-free no-ops.
A valid rotation replaces all selected records atomically through one
transaction/history entry, retaining their selection through stable IDs.
Failure publishes nothing and preserves preview for retry. Undo/Redo restores
the exact original/rotated records and identities. Escape, pointer cleanup,
completion, and zero-angle completion clear all transient feedback; renderer
recovery reconstructs it from command state.

Rotate Copy, direct angles, constraints, Ortho/Tracking, grip/sub-object and 3D
rotation, gizmos, Scale, and Mirror remain deferred. Persistence schema and
file version are unchanged.
