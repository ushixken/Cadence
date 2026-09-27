# PS3 — Layout Viewports

Each Layout owns an ordered table of stable Layout Viewports. A viewport stores a Paper Space frame in millimetres, a Model Space view center in document units, a canonical scale denominator, and a persistent lock flag. Model records remain in the single Model geometry table.

Scale means paper:model (`1:50` stores `50`). Projection converts Model document units through `CaderactUnits` to millimetres, divides by the scale denominator, offsets around the viewport's Model center, and clips against the Paper Space frame.

The renderer-neutral scene emits clipped per-style line groups plus selectable frame descriptions. Canvas2D and WebGPU consume the same groups, preserving explicit and ByLayer colors. No Model grid or axes are projected.

Creation, frame move/resize, scale, Model-view pan, lock/unlock, and deletion replace the owning Layout through the existing transaction authority. Locked viewports reject view-center and scale edits while their frame remains available. Native v3 persistence stores exact viewport identities and state; PS2 Layouts migrate to empty viewport tables.

DXF remains Model Space-only. Layout Viewports are not exported or inferred. PS4/PDF stages own plotting and printable output.
