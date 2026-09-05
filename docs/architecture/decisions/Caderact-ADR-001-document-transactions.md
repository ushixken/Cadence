# ADR-001 — Document mutation, transactions, history, and identity

Status: Accepted by the user. Its 2D foundation has been implemented incrementally through A1–A11; later capabilities in this ADR remain proposals, and the stage documents record intentional scope refinements and current implementation status.
Date: 5 September 2026.
Scope: Caderact's single-user 2D document foundation. No repository changes, production code, renderer redesign, collaboration implementation, or 3D design.

## 1. Decision in brief

Use **a single document controller with staged transactions and exact before/after change sets**.

Commands prepare changes against a read-only document revision. A private draft holds accepted-but-uncommitted work. The controller validates and publishes one complete immutable document state plus its history transition atomically. Undo and Redo restore recorded values; they never rerun geometry solvers or apply inverse arithmetic.

A command session is an interaction, not necessarily a transaction. Line uses one draft and one transaction for the entire accepted session. Repeated Trim uses a transaction per accepted cut. Every command declares its policy; cancellation never guesses based on array length.

Object and subelement IDs are durable logical identities, independent of storage positions and rendering. Topology-changing operations produce explicit reference correspondence, not proximity-based repair.

Use two different state concepts:

- A monotonically increasing **revision** identifies each published transition and rejects stale work.
- A **stateId** identifies an undoable content state and is compared with a saved-state token to determine cleanliness.

This is a hybrid: command intent for UX and diagnostics; exact record changes for history; structurally shared state storage where valuable; optional checkpoint/journal persistence later. It is not event sourcing and does not require a generic CRDT.

## 2. Context, evidence, and limits

Primary context:

- [Caderact 2D foundation research](C:/Users/Ushirou/Pictures/Projects/Cadence/docs/research/2d/Caderact-2D-foundation-research.md), especially sections 5–6, 9–14, 16, and 20–22.
- [Caderact 2D command matrix](C:/Users/Ushirou/Pictures/Projects/Cadence/docs/research/2d/Caderact-2D-command-matrix.md), especially Modify, Units, and Command families.

**Findings from those files:** the proposed foundation already separates model geometry from rendering, requires stable IDs and exact coordinate input, distinguishes Line objects from a Polyline, calls for atomic unit conversion, and preserves whole-session Line cancellation. The research explicitly leaves identity remapping, reference behavior, tolerance contracts, and repeated-command cancellation unresolved.

Those research recommendations are not evidence of Rhino or AutoCAD internals. The current renderer and command capabilities described in the new request are treated as supplied context, not independently certified code behavior.

**This ADR's contribution:** the concrete mutation, history, identity, cancellation, and save-state contracts below. Unless labeled otherwise, the remainder is a Caderact design recommendation.

Supporting architectural evidence, not a dependency selection:

- Qt's official Undo framework distinguishes individual commands, grouped macros, and a clean state. This supports treating undo grouping and save-state tracking as explicit concepts, without copying Qt's API or implementation. [Qt QUndoStack](https://doc.qt.io/qt-6/qundostack.html).
- Browser storage transactions have their own lifetime, commit, abort, and durability semantics. A CAD editing session must not hold a browser database transaction open while waiting for clicks. [IndexedDB specification](https://www.w3.org/TR/IndexedDB/).
- Transferring a worker buffer can detach it from its sender. Workers must receive owned copies or deliberately transferred disposable data, never buffers still backing authoritative state/history. [MDN transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects).

## 3. Alternatives considered

Let N be total document size, K the changed records, and H the retained history length. Costs below are qualitative design estimates, not browser benchmarks.

| Architecture | Advantages | Disadvantages | Memory and speed | Complexity | Collaboration implications | CAD suitability |
|---|---|---|---|---|---|---|
| Command objects with procedural undo/inverse operations | Natural tool grouping; small transform descriptions; simple initial Line | Deleted information still needs storage; inverse floating-point drift; solver/version dependence; live closures difficult to persist | Often compact, but undo may recompute expensive geometry; destructive operations retain originals anyway | Low initially, high as exceptions grow | Intent useful, but concurrent inverse application unsafe | Useful command shell, unsuitable as sole history authority |
| Full before/after document snapshots | Straightforward exact restoration; easy debugging | Copies untouched geometry; large GC and peak allocation; runtime resources must be excluded | O(N) per edit and roughly O(HN) retention without sharing | Low semantics complexity; serious scale limitations | Coarse conflicts; poor incremental synchronization | Good test oracle and checkpoints, not ordinary edit history |
| Immutable persistent document snapshots | Exact roots; fast state switching; sharing of untouched structure | Requires real persistent storage, not cloning a huge Map; roots retain reachable old data | Typically changed records plus copied tree paths; large edits still cost O(N) | Moderate/high storage engineering | Stable snapshots useful; no automatic conflict solution | Viable backend, but still needs semantic change metadata |
| Semantic operation log/event sourcing | Compact intent for some actions; audit and replay model | Replay needs stable solver versions, tolerances, random IDs and ordering; migrations affect historic events | Compact events may entail expensive replay; checkpoints needed | High, especially cross-version replay | Suitable for a designed synchronization protocol, not sufficient by itself | Excessive as today's source of truth |
| **Exact changed-record change sets plus shared read-only states** | Exact values and IDs; cheap cancellation before publication; portable records; incremental invalidation | Large global edits still large; schema-aware validation and reference effects required | Ordinary history O(K payload); publication cost depends on index structure; bulk conversion O(N) | Moderate; explicit and testable | Leaves transaction metadata and preconditions for future synchronization | **Selected** |

Generic positional JSON diffs are not selected: an insertion at array index 4 is not a CAD identity operation. Typed record changes may later compress into field patches, but they must remain keyed by stable record IDs and preserve complete before/after semantics.

Consequences: more structure than an array and command-specific undo functions; much less machinery than a replicated event-sourced kernel. A large unit conversion cannot be made free merely by calling it a patch.

## 4. Ownership boundaries and state model

| Component | Owns | May do | Must not do |
|---|---|---|---|
| Document data | Persistent model records and settings | Expose read-only snapshots | Expose writable arrays/maps to callers |
| Document controller / transaction manager | Publication gate, state root, revision, history, validation | Stage, validate, atomically publish, Undo/Redo | Execute arbitrary UI callbacks during publication |
| Command/session | Input phases, parameters, cancellation policy, draft handle | Request draft edits and solver preparation | Mutate committed records or directly push history |
| Geometry engine | Pure evaluation and proposed geometry/correspondence | Read supplied inputs; return results or errors | Commit document edits or allocate hidden authoritative identities |
| Reference service | Dependency queries and explicit remap validation | Prepare dependent record changes in same transaction | Silently reconnect to nearest geometry |
| Selection manager | Ephemeral selected IDs/components | Reconcile after publication | Delete or edit model objects itself |
| Renderer and spatial/display caches | Disposable derived data | Read committed state and preview composition | Modify model coordinates or define persistent IDs |
| UI | Presentation and user intent | Dispatch commands/settings edits | Assign document settings directly |
| Persistence | Encoders, checkpoints, write acknowledgments | Serialize pinned committed state; submit validated load | Mutate live state during decoding or claim failed saves succeeded |

Conceptual persistent content includes document ID/name/schema version, units, tolerances, object/layer/style tables, saved settings, explicit references, and ordering where semantically necessary. Runtime history, selection, active draft, camera gestures, GPU buffers, and solver caches live outside that content.

The proposed document's `revision` is controller metadata exposed alongside content, not a user-editable or undo-restored geometry field. A file may record it for diagnostics, but cleanliness must not compare serialized revision numbers.

Represent collections by stable record keys. Ordered paths additionally store an order of stable segment/vertex IDs; order is not identity. Draw order likewise references IDs. Persistence order and map iteration order must not accidentally define drafting behavior.

## 5. Transaction contract

A transaction means: **one validated, atomic, undoable change of persistent document content**. It may create, replace, and remove many objects and settings together.

Examples: one accepted Line session; Move of 15 objects; one cut; Split into several pieces; Delete of 100 objects; a layer creation; a property application; complete model-unit conversion.

### Lifecycle

1. **Begin preparation:** capture document ID, base revision, base stateId, and acquire the single foreground editing lease. Allocate transaction/session IDs. No document mutation.
2. **Stage:** create a private change builder with read-through access to the base state. Operations validate their own input before changing the draft. Accepted steps can accumulate.
3. **Prepare dependents:** compute topology correspondence, reference updates, and explicit invalid/detached states. Include all persistent effects in the same change set.
4. **Validate candidate:** schema, IDs, finite numbers, entity invariants, layer/reference rules, operation preconditions, and resource feasibility.
5. **Seal:** coalesce changes and freeze exact before/after values. Build the candidate state and history record off to the side.
6. **Publish synchronously:** verify the base revision still matches; switch the complete controller envelope containing state, history cursor, and revision. No await, solver, persistence call, or external callback here.
7. **Notify afterward:** enqueue one transition notification for renderer, selection, UI, and persistence. Isolate observer errors.
8. **Rollback before publication:** dispose draft/candidate, release lease, clear previews. The committed document and history never changed.

Terminal builder states are committed or rolled back; neither can be reused. A stale, cancelled, or failed asynchronous result cannot reopen either state.

A no-op transaction publishes nothing: no revision increase, history entry, dirty change, redo invalidation, or empty autosave record. Create-then-delete of a new object coalesces to absence; repeated replacements retain the first before and final after.

### Composition, nesting, and preparation

- Multiple operations per transaction: yes. They see earlier staged changes through the draft view.
- Nested public transactions: no. A helper receives the caller's builder; it cannot commit independently.
- Independent nested editing commands: no initially. Pan/Zoom may run without acquiring a document-editing lease.
- Asynchronous preparation: yes, outside publication, tagged with base revision, request generation, and cancellation token.
- Asynchronous publication or partial visibility: no.
- Initial concurrency: one editing session per document. Another persistent edit is rejected with “Finish or cancel the current command”; do not invisibly queue stale property edits.
- Save may read the pinned committed state while a draft exists; it excludes that draft. Close/open prompts must also consider pending draft changes.
- Undo/Redo cannot interleave with an open draft; command-specific step undo is distinct.

The no-interleaving rule is intentionally conservative. Workers can prepare results and autosave can read snapshots concurrently; this is not a requirement to block the browser thread throughout a session.

### Recorded information

Each history entry contains:

| Field | Meaning |
|---|---|
| transactionId, documentId | Stable operation and document identifiers |
| sessionId, commandName, label | UX/debug grouping, not executable closures |
| authorId | Optional local actor identifier; extensible later |
| changeSetVersion | Version of history/journal record schema |
| beforeStateId, afterStateId | Content-state endpoints |
| baseRevision, publishedRevision | Diagnostics/preconditions; not content identity |
| record changes | Collection + stable ID + exact before/after record or absence |
| singleton changes | Exact before/after units/settings/etc. |
| correspondence | Source feature → destination feature mapping or explicit removal/ambiguity |
| dependency effects | Reference-owner changes, including invalidation |
| summary / estimated bytes | Invalidation hints and history budget accounting |

Record changes contain plain model data, not DOM objects, functions, GPU handles, Maps exposed for mutation, or references to writable command objects. Transaction provenance is not substituted for actual values.

A create records absence → record; a delete record → absence; an edit before → after. Restoring content includes names, IDs, coordinates, metadata, ordering, layer assignment, and reference state—not just geometry.

## 6. Command session and cancellation policies

A session owns prompts, selection phases, transient work, and zero or more transactions. The dispatcher knows its declared policy before starting.

| Tool/workflow | Transaction boundary | Enter/accept | Escape |
|---|---|---|---|
| Continuous Line | Whole session | Publish all accepted segments as one entry | Discard all staged segments and unfinished point |
| Polyline | Whole session | Publish one path | Discard entire staged path |
| Repeated Copy | Whole session initially | Publish all placed copies together | Discard all staged copies |
| Move/Rotate/Scale/Mirror | One accepted placement | Publish result and exit | Discard unaccepted transform |
| Repeated Trim | Each confirmed cut | Exit; earlier cuts already published | Cancel current candidate and exit; earlier cuts remain |
| Repeated Offset | Each confirmed result set | Exit; earlier placements remain | Discard current candidate; retain earlier commits |
| Array | One accepted array operation | Publish all copies or one future array entity | Discard whole candidate |
| Delete selected set | One invocation | Publish complete delete | Before confirmation, discard; after commit use Undo |
| Repeated explicit deletes | Each invocation | No artificial session grouping | Cannot undo previous invocations via Escape |
| Property field / slider | One Apply or completed gesture | Publish final value | Restore draft to gesture-start value |
| Multi-field dialog | One Apply batch | Publish all fields atomically | Discard edits since last Apply |
| Layer create/property change | One explicit action | Publish once | Cancel unaccepted action |
| Unit conversion | Whole operation | Publish complete converted state | Cancel preparation only; after publication use Undo |

These are Caderact policies, not claims about vendor cancellation internals. Repeated Trim/Offset must display that earlier accepted edits remain; do not label their Escape action “Cancel all.” A later whole-session mode would require a distinct declared policy, not ad hoc deletion of prior commits.

### Line, precisely

Starting Line creates a session and empty draft. First click sets A only. Second click stages an actual Line record A–B with a new ID; B becomes the start. It is visually completed but **not yet document-committed**. Subsequent accepted segments are staged similarly.

Enter with three staged segments publishes one transaction and three independent objects. Undo removes all three; Redo restores the same IDs and values. Enter with zero segments creates no history.

Escape disposes the entire draft and live rubber-band segment. Existing document objects are untouched. There is no “starting array length” to truncate and no requirement to undo three already-published transactions.

Session Step Undo removes the last staged segment and restores its start as the current point. This does not touch document history. While a draft command is active, Ctrl+Z routes to its explicit Step Undo if supported; otherwise it tells the user to finish/cancel first. Ctrl+Y is disabled during an active editing session. Repeated Trim exits before document Undo is invoked; it does not implicitly rewind a previous cut inside the open tool.

Command search, text editing, and IME retain their existing input-specific behavior. An Enter consumed to launch a suggestion must not finish the newly launched command. A field may consume Escape to discard field text; an Escape delivered to the Line session cancels that session. Input ownership must be visible and tested.

## 7. Preview and transient scene contract

Use two related but separate transient sources:

1. **Draft results:** accepted session steps not yet committed; stable proposed IDs, visible through a draft read view.
2. **Current candidate overlay:** rubber-band line, transform ghost, highlighted removed interval, offset/fillet/array candidate. Disposable and replaceable on pointer movement.

Neither is part of persistent document content, native export, ordinary autosave, or committed history.

The view composition is: committed document, filtered by a draft replacement/removal mask; staged accepted records; current candidate; interaction markers. Rendering still follows the existing grid/axes/geometry/preview order. This requires only an input boundary, not a renderer redesign.

For Move, show transformed candidates and suppress or ghost the originals; never move originals and then move them back. For Trim, show the exact candidate remaining pieces/removal. For array preview, instances or a capped visualization are permitted, but final model creation must not use a reduced preview as authoritative output.

The active tool's snapping/query view may include its staged accepted segments; unrelated selection and persistence use committed state. Every query declares its view source. Hover-only candidates do not become snap targets by default.

On publish, discard the matching draft and switch the view to the new document together so objects do not flash or duplicate. A preview has a session/generation token; delayed worker or animation results with an old token are ignored. Escape increments the generation and removes the overlay immediately.

Pending draft work has its own `hasPendingEdits` indication. A clean committed document with a staged Line is not “safe to close without asking.” A save during that state reports “Saved committed drawing; active command not included.”

## 8. Stable identity rules

Use opaque generated IDs, unique within the document and collision-checked on insertion. Allocate new IDs for new logical objects. Never derive IDs from coordinates, timestamps alone, array indices, layer names, or GPU slots. UUID-style IDs are a suitable initial representation; exact encoding is an implementation detail.

Deleted IDs are not reassigned to unrelated objects. Undo restores the original IDs; Redo restores the same newly created IDs. Cancelling a draft may waste allocated IDs; do not recycle them. Imports remap collisions before commit.

| Operation | Identity result | Reference consequence |
|---|---|---|
| Move/Rotate/uniform Scale | Preserve object and surviving feature IDs | Same semantic feature, new coordinates |
| Mirror in place | Preserve object and feature IDs | Orientation changes; update parameter/orientation mapping |
| Mirror with copy | New object and feature IDs | Original links remain; copied internal links remap |
| Property/layer assignment | Preserve IDs | Geometry links unchanged |
| Nonuniform scale/type change | Preserve logical object ID if operation remains one-to-one | Features unsupported by new type explicitly invalidate |
| Delete | Retire object and its features from live tables | Dependents become invalid unless user explicitly detaches/deletes |
| Copy | New object and subelement IDs | Within copied set remap; outside references retained and disclosed |
| Split | Retire source; every output gets a new object ID | Explicit one-to-many feature/parameter correspondence |
| Trim, one surviving connected object | Preserve target object ID | Preserve unchanged features; new trim endpoints get new feature IDs |
| Trim, multiple surviving objects | Retire target; all survivors get new IDs | Same replacement/remapping rules as Split |
| Trim removes everything | Delete target only if explicitly intended | Standard deletion effects |
| Extend/vertex edit | Preserve object and existing semantic endpoint/vertex IDs | Endpoint moves but remains that endpoint; removed features invalidate |
| Join two or more objects | Retire all inputs; create one new object ID | Map source portions to new stable component features |
| Explode composite | Retire parent; all resulting objects get new IDs | Map components to outputs; no arbitrary child inherits parent ID |
| Array copies | Preserve source; each new copy gets new IDs | Copy correspondence per occurrence |
| Future associative array | New controller identity plus explicitly modeled occurrences | Do not invent persistent IDs from renderer instance slots |

A split child does not arbitrarily inherit A. Join does not privilege the first-selected source. No-op Split/Join operations leave identity unchanged rather than replacing objects for no reason.

Attribute merge policy is separate: Split/Trim outputs inherit source properties; Join requires a defined output layer/style and reports conflicting names/metadata. Such resolution occurs before acceptance and is recorded. Undo restores the original per-object attributes exactly.

## 9. Subgeometry and association references

Persist a **semantic reference**, conceptually:

- document-scoped object ID;
- stable feature ID when referring to a vertex, endpoint, path segment, or control point;
- semantic selector when appropriate: center, whole curve, or an explicitly defined curve-location anchor;
- optional instance path of stable instance IDs for future block occurrences;
- optional parameter locator plus its definition/version, not a renderer sample index;
- resolution state and diagnostic information on the owning association.

For a Line, allocate two distinct endpoint feature IDs. “Endpoint at A” follows its feature identity through reversal, not whichever coordinate happens to occupy slot zero. A circle can expose a center semantic role without inventing a mesh vertex. A path's vertex IDs and segment IDs survive reordering when the logical features survive.

For curve-location references, distinguish a material/parameter anchor from a derived role such as midpoint. A midpoint dimension refers to the midpoint role and recomputes after an edit. A stored parameter requires an explicit old-domain → new-domain mapping after topology edits. A normalized parameter alone is not a guarantee of stable physical location.

### Resolution states

| State | Meaning | Default behavior |
|---|---|---|
| Resolved | Unique valid target exists | Evaluate against current geometry |
| Remapped | Unique correspondence selected during edit | Store new target; maintain provenance for history |
| Invalid | Target removed, unsupported, or ambiguous | Keep owner with warning and frozen last-known display if useful; do not claim live measurement |
| Detached | User explicitly accepted an independent point/value | Association removed; clearly marked non-associative |

Missing references are allowed only as explicitly invalid associations, never as accidental dangling IDs. Required structural references—object's layer, path membership, block definition—must resolve or the transaction fails. Strong future constraints may forbid invalidation and reject an operation; dimensions can remain as visible invalid annotations.

### Required operation correspondence

A topology proposal returns source object/feature or parameter intervals mapped to destination object/feature or intervals, including reversed orientation and deleted ranges. The reference service updates all affected association-owner records in the same transaction. Undo restores those owner records as well as geometry; it does not try to reverse a lossy remap algorithm.

- **Split:** original endpoint references map uniquely to the child retaining that endpoint. An interior location maps to the child interval containing it. At the exact split point, two child endpoints are possible: use existing semantic side information if available; otherwise mark ambiguous, never choose by array order.
- **Join:** retained source endpoints/interior locations map to new path features. A source's “whole curve length” cannot automatically become whole joined-curve length; use an explicit mapped subrange if the annotation supports it, otherwise invalidate.
- **Trim:** a retained original endpoint survives. A removed endpoint becomes invalid even if a new trim endpoint is nearby. Interior references in deleted intervals invalidate; surviving intervals remap.
- **Vertex edit:** moving a vertex preserves its ID; inserting allocates a new ID; deleting invalidates references to it. Rebuild needs solver correspondence or explicit invalidation, not nearest-control-point guessing.
- **Transforms:** references follow their targets; parametric direction maps account for reflection/reversal.
- **Delete:** an invalid annotation may retain its former target ID for explanation and later explicit repair. That ID is not reassigned.

Object snap candidates themselves are transient. If a future tool creates an associative object from a snap, it captures and validates the semantic reference at acceptance. A Line merely snapped to an endpoint is not automatically a constraint; that is a separate feature decision.

Maintain a reverse dependency index as derived data. It accelerates affected-owner discovery but is reconstructible from saved references. Initial associativity can be minimal, but feature IDs, correspondence result shape, and explicit failure states should exist before topology tools.

## 10. Undo/Redo semantics

History is initially linear per document: retained entries and a cursor. A successful non-no-op commit appends an entry and discards the redo branch. Discarding is part of the successful publication, not something done when a command merely starts.

Undo requires no active editing draft. It applies the selected entry's exact before-side changes to a private candidate, validates structural consistency, and publishes once. Redo applies the after-side. Both update indexes/observers through the same publication gate. Neither calls the original command or geometry solver.

Undo/Redo restore **persistent content**, not the old runtime revision. They preserve IDs, metadata, reference states, units, and numerical values. Memory object identity (the same JavaScript object instance) is not promised; logical and serialized model identity is.

Entity version tokens can identify immutable record values. A changed record gets a new token; restored records may reuse their original token. Because a state can be revisited, asynchronous requests must also check the current publication revision to avoid the A→B→A stale-result problem.

History is not saved in every native file initially. Loading a validated document installs a new runtime epoch, clears editing history, and establishes its saved-state marker. Import into an existing document, unlike Open, is an ordinary undoable transaction.

### Coalescing

Within one draft, keep only original-before/final-after for each record. Keep separate ephemeral step data if the command needs Step Undo.

Do not initially merge separately published transactions based on time. A slider uses a draft for the gesture; a dialog uses a draft until Apply. Later compression must not cross save boundaries, command boundaries, or change labels unexpectedly.

A history integrity/precondition mismatch is an error, not permission to apply a partial undo. Keep current state, disable the affected history path, and report diagnostics. This local-history design must not later be applied blindly over remote edits.

## 11. Unit conversion is a bulk exact-value transaction

Define factor f = old metres-per-model-unit / new metres-per-model-unit. For mm→m, f = 0.001. Compute a candidate document, validate it completely, and publish it as one state. Store old and new actual values, not only f.

**Undo must not multiply by 1/f.** Binary floating-point round trips are not guaranteed to recover original values. Redo likewise restores recorded converted values without rerunning arithmetic.

A schema-owned dimensional field registry determines conversion. Never recursively multiply every numeric property.

| Data | Size-preserving model-unit conversion |
|---|---|
| Point coordinates, radii, line/path widths, model-space offsets | Multiply by f |
| Areas stored as actual quantities | Multiply by f²; recompute derived caches |
| Absolute geometric/join tolerances and model-distance thresholds | Multiply by f |
| Angles, angular tolerances, ratios, counts, opacity, spline weights | Unchanged |
| Layer/style model-length fields, dash lengths, model text height | Multiply by f |
| Plot lineweight and paper-space text/arrow sizes in explicit paper units | Unchanged |
| Hatch model-length definition/origin/spacing | Convert dimensional fields once; dimensionless pattern multiplier unchanged |
| Grid/snap spacing, drawing-frame origin, saved model-space view center/span | Convert dimensional fields |
| Block definition coordinates and instance translations | Each converts once; dimensionless linear transform unchanged |
| Dimension references | IDs unchanged; stored model offsets/tolerance lengths convert |
| Dimension formatting unit, paper unit, insertion policy | Preserve explicit setting unless conversion UI expressly changes it |
| Derived measurement, bounds, tessellation, snap indexes | Invalidate/recompute; not authoritative conversion payload |
| Custom metadata | Convert only declared dimensional values; unknown values are not guessed |

Schema must distinguish a style's model-length fields from physical paper fields. Shared definitions convert once, not once per instance. Unmodeled external references or opaque geometric payloads with unknown units block conversion unless an explicit safe policy exists; do not produce a partially converted drawing.

Current runtime camera parameters are not history, but the viewport observer must preserve framing across unit changes. For a camera using pixels/model-unit, divide that scale by f and multiply its model center by f. This is derived synchronization, not a second model edit. Undo/Redo carry the corresponding unit-change signal.

Preparation can run in a worker and report progress. Check overflow, non-finite values, underflow that destroys required nonzero geometry, unsupported records, and estimated memory before publish. Cancellation during preparation discards the candidate. If the document revision changed, reject and reprepare.

The change set or shared roots retain exact old content. Global edits may need nearly two full geometry states plus working memory. If the operation cannot fit safely, fail before publication or use a later verified disk-backed history strategy; never silently make unit conversion non-undoable.

“Change display format” and “reinterpret model units” are separate transactions. Reinterpret changes scale meaning without coordinate scaling and needs a separate warning; it is not the size-preserving conversion defined here.

## 12. Revision, saved state, and dirty state

Keep the following separate:

| Identifier | Contract |
|---|---|
| documentId | Persistent identity of this drawing |
| runtimeEpoch | New when a document is opened/replaced in a controller |
| revision | Monotonic publication sequence within that epoch |
| currentStateId | Identity of current persistent content state in history |
| savedStateId | State successfully written to the primary save target |
| savedRevision | Diagnostic revision captured by that save, not dirty comparator |
| checkpointStateId | Last recovery/autosave checkpoint; does not necessarily mean user-saved |

Each successful commit, Undo, and Redo increments revision. No-op, preview, cancellation, failed validation, camera movement, and selection changes do not.

Dirty = currentStateId differs from savedStateId, or no primary saved state exists. State IDs are fresh on a new branch. Undo/Redo restore the prior known state ID. They are not computed from a stack index; a new branch can occupy the same index with different content.

| Event | Revision | Current state | Saved state | Dirty |
|---|---:|---|---|---|
| Save | 10 | S10 | S10 | No |
| Edit | 11 | S11 | S10 | Yes |
| Undo | 12 | S10 | S10 | No |
| Redo | 13 | S11 | S10 | Yes |
| Undo, then new edit | 15 | S12-new | S10 | Yes |

Even if a separately executed edit happens to recreate byte-identical content, initially treat it as a different state unless it was normalized to a no-op. Full-document equivalence hashing is not required to detect Undo-to-save correctly. This is conservative, not a false claim of content inequality.

A native save pins a state before serialization. If the user edits during save, successful completion marks that pinned state saved—not the latest state. Serialize writes per primary target to prevent an older save finishing after a newer save and overwriting it. A queued save captures its own state when dispatched. Save failure changes no saved marker.

A save acknowledgment establishes the destination's actual durable/successfully completed snapshot according to that storage API. Exporting DXF/PDF does not mark the native drawing saved. Local recovery autosave updates its own marker unless the user explicitly configured it as primary save.

History pruning must not reuse or equate state tokens. Keep the saved token even if its path is no longer undoable. A dirty document cannot become clean merely because history was compacted.

## 13. Conceptual API and examples

This is API notation, not production JavaScript. Names are illustrative; semantics are normative.

Use an explicit staged builder as the core and a short synchronous transaction convenience wrapper for simple edits:

- controller.snapshot() → immutable content + revision/state token.
- controller.beginEdit(label, sessionId, policy) → exclusive draft handle.
- draft.read / create / replace / remove / changeSettings / applyProposal.
- draft.previewView() → read-only draft composition.
- draft.commit(expectedRevision) → committed, no-op, or structured error.
- draft.rollback(reason) → idempotent discard.
- controller.undo() / redo() → normal atomic publication.
- controller.transact(label, preparation) → convenience for a short noninteractive edit; not a bypass around validation.

A caller proposes replacement content; the builder captures authoritative before-values. Callers cannot falsify the history's before side. Builders reject unknown IDs, duplicate inserts, invalid layer targets, stale proposals, and post-close writes.

### Create Line

Begin Line session → capture base snapshot → create empty draft.
Pick A → command-local start only.
Pick B → draft.create(Line with allocated object/endpoint IDs and resolved Float64 coordinates).
Move pointer → replace only transient candidate B→pointer.
Enter → draft.commit → one entry.
Escape before commit → draft.rollback → no model transition.

### Delete

Take eligible selected IDs → begin “Delete 100 objects.”
Stage removal of all 100 plus required group membership/reference-owner changes.
Validate layer/definition invariants and deletion policy.
Commit once. Undo reinstates exact records and restores invalidated reference owners.

Selection is ephemeral: deletion removes missing IDs from the current selection. Undo need not recreate the previous selection; initially reconcile surviving IDs only. Commands may explicitly select their outputs after commit, outside history.

### Move

Begin “Move 15 objects” → read originals once.
Geometry engine prepares transformed replacements from originals and displacement.
Pointer changes update preview, not the document and not incremental transforms of previous previews.
Accept → stage exact final replacements with the same IDs; validate and publish.
Undo restores exact original records, not a negative translation.

### Trim

Begin one cut draft against current state.
Solver returns surviving geometry plus source-interval correspondence.
Draft applies retained-ID or replacement-ID rule, updates dependent reference owners, validates.
Confirm → publish “Trim.”
Tool may start the next cut against the newly published revision.
Escape then discards only that new candidate. Earlier cuts remain and are undoable.

### Unit conversion

Capture current snapshot and field schema.
Prepare complete converted proposal asynchronously with cancellation/base tokens.
Validate dimensional coverage, finite values, reference consistency, and memory.
Stage settings and all affected records together.
Commit once only if original revision still matches.
Undo/Redo apply recorded sides, never call conversion again.

A solver result is data with provenance and correspondence, not executable authority. An arbitrary callback cannot directly write through controller.snapshot().

## 14. Failure and rollback rules

| Failure | Required result |
|---|---|
| Solver cannot find valid geometry | No document transition; show reason; retain earlier valid draft steps |
| A proposed step creates invalid geometry | Reject that step atomically; do not corrupt existing draft |
| Final transaction validation fails | No publication/history change; keep editable draft when safe or discard with clear reason |
| User cancels | Discard according to declared session policy; already published independent edits remain |
| Worker rejects/crashes/times out | Cancel that preparation; ignore late results; committed state unchanged |
| Stale async result | Reject by document/epoch/revision/generation; no auto-merge initially |
| Allocation/preparation failure | No publication; release candidate resources; report resource limit |
| Renderer/device failure | Keep valid document/history; rebuild cache/use existing fallback; no model rollback |
| Selection/cache observer throws | Keep publication; isolate observer; rebuild its derived state |
| Persistence failure after commit | Keep document and history; report unsaved/recovery failure; retry allowed |
| Journal write failure | Keep in-memory commit; mark recovery behind; do not claim durable recovery |
| Invalid load/import data | Validate isolated candidate first; current document remains unchanged |
| History integrity failure | Fail Undo/Redo atomically; report and preserve current model |

Publication is deliberately tiny and non-reentrant. All likely allocations and validation happen before swapping the envelope. Do not attempt to recover from an out-of-memory browser termination by promising rollback; crash recovery only covers previously durable snapshots/journal records.

Derived dimension display can be recomputed after publication, but persistent dependency status and reference targets must already be consistent. If a future solver-enforced constraint cannot remain valid, reject before publication; renderer latency must not decide model validity.

## 15. Performance and browser memory policy

Ordinary edits store only changed records and required index updates. A 15-object Move must not deep-copy a million-object document.

Use immutable records behind a controlled collection abstraction. Initial small documents may use a simple index implementation, but do not call cloning an entire JavaScript Map “structural sharing.” Before large-document support, use chunked copy-on-write tables or a tested persistent keyed structure. The public transaction contract stays unchanged.

- O(K) changed payload does not imply O(K) total time if the index copies N entries. Measure both.
- Large polyline records may eventually split into stable-ID chunks; until then, changing one vertex copies its owning record.
- Immutable record values can be shared by current state and history; count retained unique data, not only entry counts.
- Batch spatial/index invalidation by changed IDs; rebuild globally only for genuinely global edits.
- Use camera-relative rendering caches without changing Float64 authoritative values.
- Workers receive minimal inputs; do not retain several duplicate whole-document snapshots unnecessarily.
- A transform preview can use derived transform metadata; final commit still stores exact resulting records.
- Validate changed entities and affected dependency closure on ordinary edits; perform whole-document validation for load and bulk conversion.
- Release cancelled drafts, superseded previews, evicted history, and obsolete save snapshots promptly.

Start with a configurable history **byte budget**, not an “unlimited” stack. A tentative desktop default of 128 MiB is a product hypothesis for testing, not a proven safe limit on every device. Count candidate peak memory separately.

Prune oldest complete undo entries first, never half a transaction. Preserve the contiguous retained undo/redo path and saved-state marker. If the newest required history entry exceeds the cap, preflight the operation: offer a deliberate temporary budget increase or reject; do not silently discard its Undo. Disk-backed history is a later extension.

History compaction means checkpointing and dropping unreachable old transitions, not merging geometry or changing currentStateId. It cannot make a dirty drawing clean. Performance release gates should measure 10k, 100k, and 1M simple entities with small edits, global conversion, worker copies, GC, and peak memory before claiming those scales supported.

## 16. Autosave and crash-recovery extension

Keep model commit and storage commit separate. The UI may acknowledge an in-memory edit before durable recovery finishes; expose recovery status honestly.

Future recovery uses a validated checkpoint plus ordered transition records. Record each commit, Undo, and Redo as an **applied transition** with from/to state IDs, runtime sequencing, change-set schema, exact applied side, and transaction/action IDs. A journal of only newly issued commands would fail to recover subsequent Undo.

Persistence writes transition data and its head marker atomically in one short storage transaction. On recovery, load the latest complete checkpoint and replay only a verified contiguous suffix. Stop at a missing or corrupt transition; do not skip forward and invent state.

Checkpoint procedure: pin state S → write checkpoint S successfully → only then discard older journal records covered by S. Retain newer transitions created during the checkpoint write. Use idempotent transition IDs for retry and reject duplicate application.

Recovery replay applies recorded results, not geometry algorithms; this avoids dependence on future solver implementations. Version checkpoint and change-set schemas separately. Migrate a checkpoint in isolation; unsupported old history may be discarded after a valid migration rather than guessed.

Active Line drafts are not in normal autosave. Optional draft recovery later must be a separately labeled session artifact that is offered for restoration, never quietly replayed as committed geometry.

A browser storage transaction is not the same as the long-lived CAD draft. Storage atomicity also does not eliminate quota, eviction, or device-failure concerns. Exact persistence backend and durable-acknowledgment UX are deferred engineering choices.

## 17. Collaboration readiness, not collaboration implementation

Small decisions now:

- Stable document/object/feature/transaction IDs.
- Optional actor identity and versioned serializable change sets.
- Captured before-state preconditions and touched-record sets.
- One mutation gate, explicit intent labels, and explicit topology correspondence.
- No dependence on executable closures or renderer buffers for history.
- Distinct state identity, local revision, and any future server sequence.
- Solvers return results that a future authority can validate.

These permit a later server-sequenced protocol with optimistic local edits. They do **not** make record replacement a conflict-resolution algorithm.

Concurrent property changes could eventually merge by field; concurrent Trim/Split/Join generally need domain-aware conflict handling or rejection/rebase. Whole-record last-writer-wins can destroy another user's geometry and is not selected. Unit conversion requires exclusive document coordination or an explicitly designed rebase policy.

Future collaborative Undo will likely be a new compensating action against current shared state, subject to conflicts—not rewinding the shared document to a local before snapshot. Keep the history service separable so that protocol can change without rewriting every tool.

No server, CRDT, OT algorithm, lock protocol, or BIM dependency system is implemented or specified here.

## 18. Invariants and acceptance tests

### Nonnegotiable invariants

1. Only the controller publishes persistent content.
2. No observer can see a half-applied multi-record transaction.
3. No preview or staged segment appears in ordinary saved content.
4. Stable IDs are never storage/render indices and are not recycled.
5. Undo/Redo restore recorded values, never inverse arithmetic or solver replay.
6. Failed/cancelled preparation leaves committed state, revision, history, and saved marker unchanged.
7. One command's Escape never removes unrelated committed work.
8. Persistent association changes are part of the geometry edit transaction.
9. Required structural references resolve; missing optional associations are explicitly invalid.
10. Revision and dirty-state identity are different.
11. Renderer/persistence failure cannot roll back a valid in-memory model transaction.
12. New edits invalidate redo only after successful non-no-op publication.

### Acceptance suite

Use deterministic fixtures, serialized-content comparisons, ID sets, reference states, transition counts, and observer recordings. “Exact” below means logical record equality and exact numeric restoration; runtime revision is checked separately.

| Test | Expected result |
|---|---|
| Line A–B–C–D then Enter | Three independent objects; one history entry; revision +1 |
| Line with existing objects then Escape | Existing content exactly unchanged; no history/revision change |
| Line first point only, Enter/Escape | No object and no history |
| Undo/Redo Line | All session objects removed/restored together with same IDs |
| Line Step Undo | Removes last staged segment only; global history untouched |
| Suggestion Enter/click/Space | Launch exactly once; no immediate finish |
| Repeated Copy then Escape | All new draft copies discarded; sources unchanged |
| Two Trim cuts then Escape | Two committed cuts remain; pending candidate gone |
| Move/Rotate/Scale | IDs and feature IDs preserved; exact before values on Undo |
| Copy/array | New unique object/feature IDs; Redo reuses recorded IDs |
| Delete then Undo | Complete records, metadata, layer, order, and reference owners restored |
| Split A into B/C | A absent, B/C new; endpoint maps unique; split-point ambiguity flagged |
| Join A/B into C | C new; parents absent; supported subrange refs remap; unsupported whole-role refs invalid |
| Trim one remainder | Object ID survives; deleted endpoint invalid; new endpoint has new feature ID |
| Trim multiple remainders | New result IDs; source retired; correspondence used |
| Vertex insertion/deletion/reversal | Surviving feature IDs stable; removed refs invalid; no slot-based reassignment |
| Unit conversion then Undo | Every dimensional field and original numeric value restored exactly |
| Redo unit conversion | Converted records restored exactly without calling conversion solver |
| Bulk conversion fault at each preparation phase | Original complete state remains; never mixed units |
| Save S, edit T, Undo | Clean at S; revision still increases |
| Undo then new edit | Fresh stateId; redo branch removed |
| Cancel/fail/no-op after Undo | Existing redo branch remains |
| Save S while editing to T | Save acknowledgment marks S, not T; T remains dirty |
| Save failure | Saved marker unchanged; valid model retained |
| Preview then save | Neither preview nor staged accepted segment serialized |
| Clean state plus active draft on close | Pending-edit warning, even though committed content is clean |
| Late worker result after Escape | Discarded by token; no preview resurrection |
| A→B→A while worker pending | Old result rejected by revision even if stateId matches again |
| Renderer/device failure after commit | Model/history unchanged; redraw from current snapshot possible |
| Observer exception | Other subscribers still notified; no rollback |
| History budget pruning | Whole entries only; saved token preserved; no false clean |
| Recovery with commit/Undo/Redo | Reconstructs last durable applied state, not last newly created command |
| Corrupt/incomplete journal suffix | Stop safely at last verified contiguous state |
| Unauthorized mutation attempt | Snapshot cannot be used to alter committed content |
| Large-document small edit | No whole-document deep copy; measured retained/peak memory within budget |

Property-based tests should generate create/edit/delete sequences and compare replayed before/after states against a simple snapshot oracle. Include invalid layer deletion, ID collision, non-finite coordinates, reference cycles where prohibited, duplicate commit attempts, and publish reentrancy.

## 19. Safest incremental implementation roadmap

Each stage is implementation work for a later authorized task, not work performed by this ADR.

| Stage | Work | Exit gate |
|---|---|---|
| 1. Lock behavior fixtures | Capture current Line launch, preview, Enter/Escape, navigation and resize behavior | Existing UX covered before migration |
| 2. Document and ID boundary | Add read-only document schema, stable Line/endpoint/layer IDs, native validation | Existing geometry imported without coordinate changes |
| 3. Transaction core | Create/replace/remove/settings change sets, atomic publication, no-op and failure behavior | Tests prove no partial changes and no external mutation |
| 4. History/state identity | Exact Undo/Redo, monotonic revision, saved-state tokens, redo branching | Save→edit→Undo clean and exact restoration pass |
| 5. Line migration | Replace array writes with session draft and current-candidate overlay | Existing appearance/input preserved; one undo entry; Escape discards only session |
| 6. Read-side migration | Renderer adapter, selection and query access through snapshots/draft view | No duplicate mutable geometry arrays; fallback unchanged |
| 7. Layers and property edits | Stable layer table, controlled assignment/settings changes, gesture drafts | No orphan layer IDs; batch edits atomic |
| 8. Persistence baseline | Versioned native save/load with captured state acknowledgment | Concurrent save/edit and failure tests pass |
| 9. Units | Dimensional field registry, exact bulk transaction and preflight | Round-trip Undo bit/value equality across all supported fields |
| 10. Topology contracts | Split/Trim/Join correspondence and invalid association states | Identity/reference fixtures pass before full tool rollout |
| 11. Scale and recovery | Chunked/shared indexing as needed, byte budgets, workers, checkpoints/journal | Measured large-document and crash fixtures pass |

Build a minimal default layer in stage 2; richer layer tools wait until stage 7. Feature IDs start with Line, even though dimension tools come later.

Migration must have **one authoritative store at every step**. A temporary read-only renderer adapter is acceptable; mirrored writable old/new geometry arrays are not. Convert the existing session state once at a deliberate boundary—prefer idle—not halfway through a user's active Line command. Keep the old renderer implementation and only change its data input adapter as necessary.

Do not ship Undo UI before its exact-value and save-state tests pass. Do not add Split/Join before correspondence rules are implemented. Do not hide failed migration/import by discarding geometry.

## 20. Remaining choices and consequences

Core semantics above are decided by this proposal. Remaining implementation choices do not authorize changing them silently:

- Exact keyed-storage library versus a small custom chunked store; benchmark and license review required.
- UUID encoding and feature-record serialization layout.
- Initial history memory default by target device; 128 MiB is provisional.
- First persistence backend and user-facing recovery durability wording.
- Native file encoding and policy for signed zero; finite geometry values must round-trip as specified.
- How much invalid-association display information to retain before dimensions are implemented.
- Whether future Copy offers an explicit option to detach external associations; initial default retains them visibly.
- Product wording and discoverability for per-cut Trim cancellation.

Benefits: deterministic local history, cheap session cancellation, explicit identity, reliable dirty state, isolated renderer failures, and a migration path from Line without a new geometry engine.

Costs: private draft composition, schema-aware validation, topology correspondence, and memory accounting must be built deliberately. Global edits remain expensive. Local exact-value history is not automatically suitable for collaborative Undo.

**Adoption recommendation:** accept this ADR's contracts before implementing the Document Model. Start with Line-sized records and the existing renderer adapter, but implement the same publication and history rules that later bulk edits will use.
