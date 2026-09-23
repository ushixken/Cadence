# DC4 — Stretch, Lengthen, and Align

DC4 adds three AF1 command extensions backed by the pure `DirectEditingPlanner` authority. Planning never mutates the document; sessions project planned replacements through the existing renderer-neutral transform preview and publish through the existing identity-preserving record gateway.

## Stretch

The beta workflow selects editable Lines/open Polylines, captures endpoint or vertex features at a semantic pick, then accepts base and displacement points through the shared resolved-point pipeline. Only captured features move. A capture containing every feature of a record is rejected so Stretch cannot silently degrade into Move. Coincident features can be captured together. Grouped, hidden, locked, closed, and unsupported records are rejected.

## Lengthen

Lengthen supports Line and native Arc records. The endpoint nearest the object pick changes while the opposite endpoint remains fixed. Delta and Total modes reject non-positive Lines and Arc results at or beyond a full circle. Arc radius, sweep direction, record identity, and endpoint feature identities remain native and stable.

## Align

Align accepts two resolved source/destination point pairs and applies a 2D similarity transform. Translation and rotation are always supported; optional Scale uses one uniform factor. Nonuniform scale and shear are impossible by construction. Degenerate point pairs and grouped/uneditable sources are rejected.

All successful commands publish one atomic history entry, preserve record and surviving feature identities plus layer/property state, and support exact Undo/Redo. Block-owned definition geometry is not edited; top-level editable Block Instances may participate in Align through the existing semantic transform authority.
