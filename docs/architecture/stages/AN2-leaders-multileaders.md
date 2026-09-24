# AN2 — Leaders and Multileaders

Leader and Multileader are native semantic records in the existing annotation/dimension family. They share named dimension styles for arrow size/type, text height, text gap, and the captured landing length; they also inherit current-layer and ByLayer properties. Plain multiline content uses the existing annotation text rendering path and `textOverride` validation rather than a second text formatter.

`Leader` owns an ordered feature-bearing vertex list, one text position, content, and landing. `Multileader` owns one or more stable feature-bearing branches, each with independently identified vertices, plus one shared text position/content block. Add Leader and Remove Leader operate on the transient command draft; publication remains one atomic record/history operation.

Both commands consume resolved viewport points. Empty or invalid content remains retryable, Escape removes only the transient draft, and preview creates no history. `DimensionGeometry` is the renderer-neutral presentation authority for segments, filled arrowheads, landing, text, bounds, hit primitives, and semantic grip descriptors. Shared selection, grips, Properties, transforms, layers, blocks, persistence, and history therefore treat each annotation as one object.

DXF import/export intentionally keeps the established unsupported-type guard. The current DXF layer has no faithful native MULTILEADER mapping, so AN2 does not silently explode annotations into Lines and Text. Rich text, fields, tables, block content, dogleg style management, and associative source references remain deferred.
