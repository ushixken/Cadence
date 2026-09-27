# PS1 — Model / Layout foundation

PS1 adds document-owned Layout definitions without moving or duplicating the existing Model Space geometry table. The native v3 document owns `layouts` and `layoutOrder`; each Layout has a globally validated ID, a unique case-insensitive name, and an A4 landscape paper-metadata placeholder (`297 × 210 mm`) for PS2.

## Authorities

- `CaderactDocument` validates Layout identity, names, order, and paper metadata.
- `layoutGateway` publishes create, rename, delete, and reorder operations through the existing `DocumentController` transaction/history authority.
- `CaderactLayoutContext` owns only the ephemeral editor context: `model` or `layout:<id>`. Switching does not publish document state, create history, or dirty the drawing.
- The context reconciles to Model when Undo, Redo, deletion, New, Open, or Recovery makes the active Layout unavailable.

## Workspace and command boundary

The bottom strip renders compact Model/Layout tabs with horizontal overflow, creation, rename, delete, and drag reorder. Layout context is an architecturally distinct blank workspace in PS1. Model records remain authoritative and unchanged, but are not projected or selectable in Layout context. Existing Model commands are unavailable there until Paper Space command semantics exist.

## Persistence and exchange

Native v3 persistence round-trips Layout IDs, names, ordering, and paper metadata. Existing v1/v2 files and v3 files without Layout data migrate deterministically to `Layout1`; Model geometry is preserved exactly.

DXF import/export remains Model Space-only in PS1. Layout definitions are deliberately not emitted to, or inferred from, DXF until explicit Layout/DXF interoperability is designed. This preserves the existing DXF semantic contract without pretending unfinished Paper Space exchange exists.

## Deferred

PS2 and later stages own paper sizes, margins, printable areas, Paper Space records, layout viewports, viewport scales, plotting, and PDF output.
