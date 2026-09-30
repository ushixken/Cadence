# PS3 — Layout Viewports

Each Layout owns an ordered table of stable Layout Viewports. A viewport stores a Paper Space frame in millimetres, a Model Space view center in document units, a canonical scale denominator, and a persistent lock flag. Model records remain in the single Model geometry table.

Scale means paper:model (`1:50` stores `50`). Projection converts Model document units through `CaderactUnits` to millimetres, divides by the scale denominator, offsets around the viewport's Model center, and clips against the Paper Space frame.

The renderer-neutral scene emits clipped per-style line groups plus selectable frame descriptions. Canvas2D and WebGPU consume the same groups, preserving explicit and ByLayer colors. While a Model View is active, the scene also projects its Model grid and X/Y axes into the fixed Paper Space frame; these remain editor feedback and never enter PlotScene/PDF output.

New documents create Layout1 with one default Model View inside the printable area. The New Layout dialog makes the same contract explicit: a user chooses the name, paper setup, and either no initial Model View or one automatically fitted Model View; the default is one. Cancel publishes nothing and Create is one Layout transaction. The shared Model-extents authority fits visible geometry, Text, dimensions/annotations, Regions/Hatches, and transformed nested Block content. Existing persisted Layouts are loaded exactly as saved, including intentionally blank Layouts. The public UI calls the secondary two-corner operation **Add View**; `LayoutViewport` remains the internal document/schema term.

Paper Space presentation keeps three boundaries distinct: the physical sheet edge is primary, the printable/margin boundary is a quiet non-interactive guide, and Model View frames communicate selection, activation, and lock state. Activating a Model View clips Model geometry, grid, and axes to that view frame. Its grid and axes consume the same canvas appearance authority as Model Space, including Light, Dark, and Custom palettes. The raw crosshair continues to follow ordinary pointer movement only while the pointer is inside the active view; leaving it visually returns to Paper Space without mutating or deactivating the view.

Creation, frame move/resize, scale, Model-view pan, lock/unlock, and deletion replace the owning Layout through the existing transaction authority. Locked viewports reject view-center and scale edits while their frame remains available. Native v3 persistence stores exact viewport identities and state; PS2 Layouts migrate to empty viewport tables.

DXF remains Model Space-only. Layout Viewports are not exported or inferred. PS4/PDF stages own plotting and printable output.
