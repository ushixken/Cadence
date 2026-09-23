# DC1 — Fillet and Chamfer

DC1 adds the first commands implemented through the AF1 CAD-command extension boundary. `Fillet` (`F`) and `Chamfer` (`CHA`) support two editable native Line records. Their command sessions do not live in `Viewport.js`; the viewport supplies only a narrow editable-Line hit-test adapter and the established rendering/document services.

## Planning and geometry

`CornerModificationPlanner` is pure and document-free. It intersects the two infinite Line supports, derives one selected ray from each raw pick location, and returns either a frozen plan or a structured failure. The selected rays determine which finite portions survive.

- Fillet radius `0` trims or extends both selected portions to the mathematical corner without creating an Arc.
- A positive Fillet radius produces two tangent points and one native tangent Arc. A radius whose tangent points exceed the safely available selected portions is rejected.
- Chamfer accepts one equal distance or two ordered distances. One distance may be zero; two zero distances are rejected as degenerate.
- Parallel/coincident supports, identical records, degenerate Lines, ambiguous corner picks, excessive values, and zero-length results are rejected without mutation.

The plan carries replacement geometry, new geometry, feature-identity intent, preview geometry, and source snapshots. It never allocates persistent identities or mutates the model.

## Command and preview ownership

The AF1 sessions use the existing CommandRegistry/Router, UX4 prompt/option presentation, and command feedback. `Radius` and `Distance` are available through the same clickable option and typed-input paths. Correctable invalid numeric input remains active and editable.

Preview uses the existing renderer-neutral record preview contract. The two source Lines are visually replaced by planned transient Lines and, when applicable, the transient Arc or chamfer Line. The committed result is built from the same plan.

## Publication and lifecycle

`recordGateway.publishCornerPlan` revalidates source existence, editability, group ownership, and exact source geometry before opening one transaction. It preserves each original Line record ID, preserves the surviving endpoint feature ID, allocates the modified endpoint identity, and creates the new Arc/Line with fresh identities. Undo and Redo therefore restore exact records atomically.

Hover, failed planning, locked/hidden objects, failed publication, and Escape do not mutate document, history, revision, or dirty state. Completion and cancellation clear transient preview/snap state.

Deferred: Polyline-wide operations, Line/Arc and Arc/Arc combinations, variable radius, multiple/repeat mode, and 3D geometry.
