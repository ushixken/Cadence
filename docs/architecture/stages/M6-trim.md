# M6 — Trim

M6 adds repeatable `Trim` with alias `TR`. It follows the same layering as M1–M5: a framework-independent geometry engine (curve parameterization, intersection, and interval selection) feeds a document-layer planner/publisher, orchestrated by a command-layer session, with a renderer-neutral transient preview.

## Workflow / state machine

Trim starts in a `cutting-edges` phase: cutting edges are picked with the existing D3/D3A conventions (click, Window, Crossing, Ctrl/Meta toggle, preselection/postselection). Enter or quick Space confirms the cutting-edge set (an empty set completes as a history-free no-op) and advances to a `targets` phase, where each click on a target curve trims it against the confirmed cutting edges. The session remains active for repeated target clicks within one invocation; Escape or a second Enter/quick Space ends the command. Confirmed cutting-edge IDs are re-resolved against the *current committed document* on every target action, so a cutting edge removed since confirmation is safely ignored rather than causing a stale-reference error.

## Cutting-edge selection and hit-testing

Cutting-edge selection reuses existing selection machinery verbatim — no new selection semantics were introduced. Target picking distinguishes two coordinates deliberately: the raw screen pointer position is authoritative for *which* curve was clicked (target hit-test), while the snapped/model-space pick is authoritative for the *parameter* handed to `TrimPlanner` (which side/interval to remove). This mirrors the same raw-vs-snapped split used by Move/Copy/Rotate/Scale.

## Geometry engine

`CurveParameter`, `CurveIntersection`, `IntersectionClassifier`, and `TrimIntervals`/`TrimPlanner` are framework-independent: they take curve descriptors and return intersection parameters, interval sets, and plan objects, with no dependency on Viewport, DOM, Canvas2D, WebGPU, CommandRouter, SelectionManager, SnapResolver, DocumentController, or persistent-ID allocation. `TrimPlanner` performs interval/topology selection only — it never touches document records or IDs. Curve intersection, classification, and parameterization are reusable as-is by a future M7 Extend; only the "remove the enclosing interval" step is Trim-specific.

## Document publication and identity

`CaderactDocument.publishTrimPlan(plan)` is the sole place a Trim plan becomes persistent state. It is a pure no-op (no transaction, no allocated ID) for any non-`"planned"` plan status. For a planned trim it resolves each endpoint's `featureIdentityIntent` (`preserve-existing-feature` vs `allocate-new-feature`) at publish time, builds the replacement record under the *original* record ID, builds any sibling records under freshly allocated record IDs, and publishes both in one transaction — rolling back on any construction/commit failure. This guarantees:

- The original record ID is reused for in-place replacement; new sibling records always receive fresh record IDs.
- Line/Arc endpoints: unaffected feature IDs are preserved, genuinely new cut endpoints receive fresh feature IDs.
- Circle→Arc: the original record ID is preserved and the arc receives two fresh endpoint feature IDs (a Circle has no pre-existing endpoint identity to preserve).
- Polyline: unaffected vertex feature IDs are preserved; closed-Polyline seam vertices are not duplicated.
- No ID is ever fabricated outside `newId()`/the identity-intent resolver, and no document mutation happens outside the transaction publication path.

## Transactions, Undo/Redo

Each successful target click that produces a `"planned"` result publishes exactly one transaction, so a middle-split (replace + create) trim is one history entry, not two. Repeated Trim clicks within one command session create independent history entries. No-op, invalid, or unsupported-target results (including the Ellipse case below) never open a transaction and add zero history entries. A failed publication leaves the original document state untouched and the command remains retryable. Undo restores the exact prior records and identities; Redo restores the exact trimmed records and exact previously generated identities (stateId/record replay, not re-derivation).

## Ellipse limitation

Ellipse is fully supported as *cutting-edge* geometry (its intersections and parameterization work like any other curve). Because the persistent schema has no partial-Ellipse representation, `TrimPlanner` explicitly returns `status: "unsupported-target-result", reason: "partial-ellipse-not-persistable"` when an Ellipse is the *target* and a genuinely removable interval exists. This is a safe no-op at the publication boundary — no EllipseArc schema was invented and no silent conversion to Polyline/Arc occurs. No schema or `fileVersion`/`formatVersion` change was made for M6.

## Preview isolation

The transient Trim preview is derived only from `TrimPlanner` output (survivor `Line`/`Arc`/`Polyline` records with no persistent `id`). It never enters document records, history, selection state, persistence, or `SnapResolver`, and allocates no persistent IDs; it clears automatically once a target click commits (or the command ends). The preview is projected through `ViewportScene`'s existing generic Line/Arc/Polyline projection path — the same one used for Move/Copy/Rotate/Scale previews — via a `getTrimPreview()` accessor threaded from the active command session through `Viewport` into `createSceneBuilder`. `ViewportScene` and the renderers (`Canvas2DRenderer`/`WebGPURenderer`) contain no intersection formula, curve equation, tolerance constant, parameter sorting, or Circle→Arc/Polyline topology construction of their own; they only project pre-computed geometry.

## Supported geometry

Line, Circle, Arc, Ellipse (cutting-edge only), and native Polyline all participate in Trim. Rectangle/Polygon are ordinary Line collections and trim like any other Lines. Splines, Rays, XLines, Blocks, Surfaces, and 3D geometry are untouched by M6 and remain unsupported.

## Deferred (not implemented in M6)

Fence, Project, Edge Extend/No Extend, Quick Trim, 3D projection, Erase option, Shift-select Extend, and the Trim Undo sub-option are all deferred. M7 Extend itself is not implemented; it is expected to reuse the geometry engine's curve intersection, finite-domain classification, and parameterization.
