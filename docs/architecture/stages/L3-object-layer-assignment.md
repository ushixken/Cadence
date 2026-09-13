# L3 — Object Layer Assignment

## Transaction and identity semantics

L3 reuses the document-owned record table and `recordGateway`. The gateway
accepts a stable set of selected record IDs plus one target layer ID, validates
the complete request before opening a transaction, and shallow-replaces only
records whose `layerId` changes. Record IDs, feature IDs, geometry, type, and
all other persistent fields remain exact.

Multi-selection assignment is atomic all-or-nothing. A missing, hidden, locked,
or otherwise non-editable source—or a missing/unusable target—rejects the whole
operation. No subset moves. Target layers must be visible and unlocked; moving
objects into inaccessible layers is deferred. When every record already uses
the target, the result is a no-op with no publication or history entry. Mixed
requests replace only records that need changing in one transaction.

## Explicit panel workflow

The Layers panel header owns one compact **Assign** action. Users select normal
editable geometry, use the existing row action to choose a current/target layer,
then explicitly assign. A simple row click never silently reassigns geometry.
The action is enabled only for a non-empty editable selection, a visible and
unlocked current target, and no active command. It is refused during command or
grip/selection ownership conflicts through the existing command/selection
guards.

Successful feedback reports the moved count and target name. A same-layer
request reports that the selection is already on the target; invalid target and
source statuses use the shared transient feedback surface rather than alerts.

## Selection and current-layer independence

Successful assignment keeps the same selected record IDs. Because the target
is visible and unlocked, highlights and grips reconcile onto the unchanged
identities. Assignment does not alter `currentLayerId`; choosing a row and
assigning are separate document actions. L2 remains solely responsible for
later reconciliation if a target layer is hidden or locked.

## History and persistence

One assignment action produces one document revision, dirty-state transition,
and history entry. Undo restores each record's exact previous layer independently;
Redo restores the target layer. Selection remains stable by record ID.

The existing v1 file schema already persists `layerId`, so Save/Open round-trip
mixed geometry assignments without a version change.

## Deferred L4+

Object color, linetype, lineweight, ByLayer/ByObject resolution, a general bulk
property editor, drag-and-drop assignment, hidden/locked target workflows,
isolation, filters, and nested layers remain deferred.
