# D2 — Linear dimension command

## Command and workflow

`Linear` (`DIMLINEAR`, `DLI`) is repeatable and accepts first extension point, second extension point, then dimension-line location. The third accepted point commits one native, non-associative `dimension-linear` record; no source record references are stored. Coincident first and second points are rejected at the second phase using the document-scale floating-point tolerance.

All three phases use the shared pointer authority: constraints, semantic object snaps, object-snap tracking/intersections, Grid, then constrained/free fallback. Typed P5 point forms use the same session acceptance boundary without another snap pass. The custom CAD crosshair remains at the raw pointer while markers, preview, HUD, and acceptance use the resolved point.

## Orientation

Placement compares the P3 distance outside the P1/P2 axis-aligned extent. Distance above/below that extent is the horizontal alternative; distance left/right is the vertical alternative. The larger outside distance wins. Exact ties, including placement inside the extent, select horizontal. This is stateless and deterministic, so identical coordinates cannot flicker or depend on pointer history.

## Preview and presentation

After P2, the session exposes a transient record-shaped definition. `ViewportScene` sends that definition through the same `DimensionGeometry.measure` → `DimensionFormatter` → `DimensionGeometry.derive` path used for committed records. Preview and commit therefore share extension lines, dimension line, filled arrows, text placement, current document style, projection, and DOM annotation ownership; only preview color differs.

Horizontal mode measures `abs(P2.x-P1.x)` and P3 supplies the dimension-line Y. Vertical mode measures `abs(P2.y-P1.y)` and P3 supplies its X. Reversed point order remains valid. Very small spans retain the D1 deterministic finite geometry; collision avoidance and outside-arrow/text fallback are deferred.

## Publication and lifecycle

The record factory assigns the current usable layer, ByLayer properties, stable record/definition feature IDs, and `textOverride: null`. Publication is one document transaction and one history entry. Undo/Redo and v2 persistence preserve the exact record. Hidden dimensions do not render; locked dimensions render but remain outside D2 selection/editing.

Escape cancels the entire draft at any phase. Repeat starts a clean P1 session. Document replacement uses the existing command cancellation/rebind lifecycle, clearing preview, DOM annotation, snap feedback, and Dynamic Input state without partial publication.

## D3 boundary

D2 adds no aligned/angular/radial commands, dimension object snaps, selection, grips, Properties UI, text editing, associativity, named styles, leaders, continued/baseline dimensions, or interchange support.
