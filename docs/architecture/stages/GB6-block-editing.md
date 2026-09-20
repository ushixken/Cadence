# GB6 — Block editing and redefinition

`BlockEdit` (`BE`) opens one Block Definition in an isolated working workspace. The live definition, model-space records, instances, selection, history, and persistence remain untouched until Apply succeeds.

The workspace deep-copies the definition while preserving its ID, name, read-only base point, member order, and all unchanged member/feature identities. It owns a separate member selection and supports Move, Copy, Rotate, positive uniform Scale, Mirror, and Delete. The command-line beta surface accepts exact definition names and the operations `Select`, `Move`, `Copy`, `Rotate`, `Scale`, `Delete`, and `Apply`; the workspace API supplies the same operations for editor UI integration. Adding new drawn geometry, Groups, layer/property panels, renaming, and base-point editing are deferred.

Native members reuse `GeometryTransform.similarityRecord`. Nested Block Instance transforms compose through `CaderactSimilarityTransform`; their referenced definition IDs are never flattened or copied. Copy allocates fresh record and feature identities through the document record gateway. Unchanged records retain their identities and deleted identities are not reused.

While editing, model-space scene records are suppressed and the working definition is rendered through the existing Block traversal, semantic transform, ViewportScene, annotation, Region, and Hatch authorities. Canvas2D and WebGPU remain unaware of BlockEdit. Definition-member selection never enters the model-space `SelectionManager`; existing model selection is restored unchanged on exit.

Apply constructs one complete replacement and publishes through `blockDefinitionGateway.replace`. The normal document validator owns identity, reference, cycle, depth, topology, transform, and resource validation. A failed Apply keeps the live definition and all instances unchanged. A successful Apply creates exactly one document-history entry; Undo and Redo restore the exact old and edited definitions. Instances are not rewritten: direct and transitive references update automatically through traversal.

Cancel or Escape closes and discards the workspace without document history. Temporary edits and selection are never persisted. Save/load after Apply stores only the replacement definition and existing instance references using format v3.

Text, Dimensions, Region, Solid Hatch, Named Hatch, and nested instances remain semantic throughout editing. Presentation text/arrows, triangulation, and pattern segments regenerate from the edited records. Committed Block Instances remain excluded from global Osnap, Track, and measurement.

GB7 can build a richer member-selection UI, local edit history, drawing creation, property editing, renaming, and a deliberate Set Base Point workflow on top of `CaderactBlockEditWorkspace` without changing atomic replacement or renderer ownership.
