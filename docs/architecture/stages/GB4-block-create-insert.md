# GB4 — Block creation and insertion

GB4 exposes the GB3 semantic Block foundation through `Block` (`B`) and `Insert` (`I`). Block data remains document-owned semantic data; neither command persists expanded renderer geometry.

## Block lifecycle

`Block` uses current preselection when present, otherwise the normal editor selection phase. It then accepts a unique name and one authoritative resolved base point. Empty name submission chooses the first available deterministic `Block N` name. Explicit duplicate names are rejected rather than renamed.

Eligible sources are Line, Circle, Arc, Ellipse, Polyline, Region, Hatch, Text, and native Dimension records. Groups, Block Instances, stale records, and transient or derived data are excluded. GB4 rejects grouped sources as a unit; it does not silently dismantle Group semantics.

Creation snapshots the selected semantic records in deterministic selected/model order. Sources remain unchanged in model space. Definition members receive fresh globally unique record and topology/feature identities through the document record gateway. Their semantic geometry and object properties are preserved. Coordinates are not rebased: `basePoint` remains metadata, and insertion uses `translation = insertionPoint - A * basePoint`.

Definition creation is one history publication. Cancellation or validation/publication failure creates no definition, changes no source, and adds no history entry. Undo removes the exact definition; Redo restores its exact ID, name, base point, member identities, and order.

## Insert lifecycle

`Insert` resolves an existing definition by exact, case-insensitive name, accepts an authoritative resolved insertion point, a finite positive uniform scale (default `1`), and an angle (default `0`). Rotation is stored in the GB3 canonical interval. Negative/zero/nonfinite scale is rejected; negative scale is not reflection. GB4 creates only non-reflected instances, while preserving the GB3 `mirrored` schema for later commands.

The instance is created on the current layer with normal ByLayer defaults. Its insertion point owns a fresh feature identity. Multiple instances share the same definition but have independent instance and insertion identities. Publication is one atomic history operation and selection changes to the new instance after success.

## Preview and committed display

Both preview and committed display use the same renderer-neutral chain:

`Block Instance → CaderactBlockTraversal → CaderactSimilarityTransform → GeometryTransform.similarityRecord → ViewportScene`

Insert preview supplies transformed semantic records through the existing transform-preview scene contract. Committed display expands visible Block Instances only at the ViewportScene read boundary. Canvas2D and WebGPU therefore consume the same line, curve, fill, and annotation draw groups and contain no Block traversal or transform logic.

Text and Dimensions remain semantic annotation records and flow through the shared annotation geometry. Region, Solid Hatch, and Named Hatch remain semantic records; fill triangles and pattern segments regenerate from their transformed loops. Preview/expanded records are never serialized.

## Interaction boundaries

Definition members are not model-space selections. GB4 adds no Block grips, expanded-member hit testing, Osnap/Track candidates, or measurement traversal. Snap, tracking, and measurement authorities continue reading authoritative model-space records, so an instance cannot prematurely contribute derived candidates. Block creation leaves source geometry intact, so existing source interaction remains unchanged.

## History, persistence, and replacement

Block and Insert each publish independently. Normal LIFO history keeps references valid: inserted instances undo before their referenced definition can be undone, and Redo restores the definition before instances. Persistence stores only definitions and Block Instance records and round-trips their exact semantic identities and transforms.

New/Open document replacement rebinds the existing document-session gateways. Active command teardown clears previews through the standard command lifecycle.

## Explicit exclusions and GB5 surface

GB4 intentionally defers nested Block authoring, Block editing, create-and-replace, Explode, reflection UI, inherited/BYBLOCK properties, Block grips, member selection, bounds/hit testing, Osnap/Track/measurement traversal, and advanced insertion browsers.

GB5 can build on `blockDefinitionGateway`, `recordGateway.createBlockInstance`, `CaderactBlockTraversal`, `CaderactSimilarityTransform`, `GeometryTransform.similarityRecord`, and the renderer-neutral semantic expansion boundary established here.
