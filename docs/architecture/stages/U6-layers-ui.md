# U6 — Layers UI

## Ownership and placement

The compact Layers panel sits at the right of the viewport. It is a projection of `DocumentSession.reader.layers()` and the active document's `currentLayerId`/`defaultLayerId`; it owns no layer database. A controller history subscription refreshes it after transactions and Undo/Redo. Session replacement unsubscribes the old controller and binds the new one.

## Current layer

U6 adds `layerGateway.setCurrent`, the smallest missing A7 operation. It writes `currentLayerId` through the existing `settings` transaction collection, producing one normal A4 history entry and state identity. Selecting a row invokes that gateway. New Line records continue reading the authoritative current layer in `recordGateway.createLine`. Save/Open already round-trip `currentLayerId` through v1 persistence.

## Create, rename, and delete

Create proposes the first unused deterministic `Layer N` name. Explicit names still pass through A7 trimming, non-empty, and case-insensitive uniqueness validation. Rename uses a simple browser prompt and the existing gateway, preserving the stable layer ID and all references.

Delete invokes A7 directly. The default layer is visually identified and its delete control is disabled. Default, referenced, current, missing, or otherwise invalid deletion never moves or deletes objects and never publishes partial state. Successful deletion is one transaction; Undo/Redo restore/remove the exact identity.

## Feedback and interaction

A7 failure statuses map to concise U5 temporary errors. Rename/delete controls do not select the row. No hover-only menus or panel-global event listeners are added. Interactive object reassignment remains unavailable because Selection does not yet exist.

## Active-command policy

All layer mutations, including switching current layer, are disabled and deterministically blocked while a command is active. A Line draft can therefore never accumulate segments created against different current-layer states. Finishing or cancelling re-enables controls through the existing router subscription.

## History and persistence

Create, rename, current-layer change, and successful delete use A4 transactions only. The UI has no separate history. New shows its canonical default/current layer. Open restores exact layer IDs, names, default/current identity, and object references; the list rebinds immediately.

## Deferred

Visibility, locking, colors, linetypes, lineweights, transparency, plot properties, grouping/filtering/order, object selection, Properties UI, bulk reassignment, drag/drop, and an advanced manager remain deferred.
