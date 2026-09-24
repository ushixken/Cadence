# UX9A — Professional Layers

UX9A presents the existing document-owned layer system as a compact CAD layer manager. It introduces no second layer store. Layer identity, names, current status, visibility, locking, color, object ownership, validation, history, and persistence remain in `CaderactDocument` and its gateways.

## Panel contract

Each row projects the authoritative current-layer indicator, visibility, lock state, color, and name. Compact row actions select that layer's model objects, move the current selection to the row's layer, isolate the layer, rename it, or request safe deletion. The layer context menu exposes the same selection, assignment, and isolation workflows. Active commands disable document-changing layer controls under the existing layer-action guard.

Create, rename, delete, current-layer changes, visibility, locking, and color are ordinary document transactions. Deletion remains conservative: the default layer cannot be deleted, and a nonempty layer must be emptied or reassigned first. Changing layer color updates ByLayer presentation through the existing renderer-neutral property resolution; explicit per-object colors are never rewritten.

## Selection and assignment

Select Layer Objects delegates to the viewport's SEL1 `selectByLayer` query and the shared `SelectionManager`. It creates no document transaction, revision, history entry, dirty state, or persistence data.

Move Selection to Layer delegates to `recordGateway.assignLayer`, exactly like Properties and the context menu. The operation validates the complete editable selection and publishes one transaction while preserving record IDs, geometry, feature identities, and explicit appearance overrides. Group selection continues to expand through the existing selection authority, so all model-space members move together. Block Instances move as model records; Block Definition members are not rewritten from ordinary model space.

## Isolation ownership

Layer isolation is ephemeral viewport/workspace state, not persistent layer visibility. The viewport filters its renderer-neutral records, selection queries, object snaps, tracking geometry, and point interactions to the isolated layer. Entering isolation prunes selection outside that layer and clears stale snap/tracking state. Unisolate restores document-defined visibility without rewriting any layer.

Isolation creates no document transaction, history, revision, dirty state, native-file data, or DXF state. It clears on document replacement and automatically releases if its referenced layer is deleted. The Layers panel owns only presentation and actions; the viewport owns the temporary filter because it already coordinates rendering and interaction visibility.

## Persistence and interoperability

Layer color, flags, identity, current layer, and record ownership continue through native v3 persistence and existing DXF layer mapping. Isolation is intentionally excluded. New geometry and annotations still inherit the authoritative current layer and ByLayer properties.

Deferred features include layer groups/filters, saved layer states, per-viewport overrides, plot/print controls, custom linetypes, drag reorder, and configurable layer columns.
