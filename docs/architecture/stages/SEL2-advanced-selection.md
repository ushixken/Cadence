# SEL2 — Advanced selection workflows

SEL2 extends the existing `SelectionManager` and SEL1 `ProfessionalSelection` authorities. Every operation remains editor state: it creates no document transaction, revision, history entry, dirty-state change, native persistence, or DXF data.

## Workflows

- **Previous Selection** retains the last non-empty meaningful SelectionManager snapshot and restores only identities that remain selectable in the current Model/layer-isolation context.
- **Last-created Selection** maintains creation ranks from authoritative document publications. Undo, Redo, and deletion reconcile surviving identities deterministically.
- **Invert Selection** computes the complement of the current selection against authoritative editable records. Hidden, locked, Layout, and isolated-out records are excluded. Existing Group expansion and Block Instance identity remain authoritative.
- **Selection Sets** support Save, Update, Select, and Delete using stable model record IDs. Missing members are ignored safely when a set is recalled.
- **Select Filter** combines the existing Type and Layer criteria with ByLayer/explicit/exact color and Block Definition criteria. It is intentionally not a general query language.

These workflows are exposed through the shared command registry/router as `PreviousSelection`, `SelectLast`, `InvertSelection`, `SelectionSet`, and `SelectFilter`, with compact aliases. They are also available from the viewport selection surface for existing UI integrations.

## Selection Set ownership

Named sets are session-owned and scoped to the active drawing. They clear on document replacement. Caderact's native document schema has no selection-set collection or persistence/history semantics; silently treating these sets as drawing data or global workspace data would create ambiguous cross-document identities. A future persistent named-set feature requires an explicit native schema and migration stage.

## Cycling feedback

The deterministic SEL1 candidate order and Tab / Shift+Tab / Enter / Escape behavior are unchanged. Candidate snapshots now include a readable label containing semantic type, layer, and Block Definition name where applicable.

## Performance

Filtering and Invert operate in one pass over the authoritative editable record collection. No screen hit results are stored, and no additional geometry projection or full-record cloning is introduced. Geometric SEL1 workflows retain the PERF2 spatial-query path.
