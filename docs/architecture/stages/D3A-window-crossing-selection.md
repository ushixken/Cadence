# D3A — Window / Crossing Box Selection

D3A is inserted before modify tools so every later operation can consume a predictable multi-object selection without owning drag-selection mechanics itself.

## Interaction and ownership

An idle primary-button press on empty viewport space creates a transient pending interaction. Movement of at least 4 CSS pixels activates the box; release below that threshold delegates to the existing empty-click result. Commands, grips, and Space/Ctrl+Space navigation retain higher pointer ownership and therefore never start a box.

Pointer capture keeps an active drag coherent outside the canvas. Release applies one selection result. Escape, `pointercancel`, lost capture, document replacement, and renderer failure/recovery discard the box without changing selection or document state.

## Directional semantics

- Left to right (`currentX >= startX`) is **Window**: only complete curves contained by the normalized rectangle are returned.
- Right to left (`currentX < startX`) is **Crossing**: contained curves and curves touching or entering the rectangle are returned.

Vertical direction is irrelevant, and crossing the starting X changes the live mode. Normal results replace selection. Ctrl/Meta results apply D3's deterministic toggle policy; an empty modified result preserves selection.

## Geometry query

`SelectionBox` owns reusable pure screen-space rectangle operations. Lines use endpoint containment and clipped segment intersection. Circles use exact radius bounds plus nearest/farthest rectangle-distance tests, which prevents a large enclosing circle from being selected when its circumference never enters the box. Finite Arcs and Ellipses reuse the renderer-neutral adaptive curve representations and test every bounded segment. Boundary contact counts using a small `1e-5` CSS-pixel numerical epsilon.

Current native Line, Circle, Arc, and Ellipse records are supported. Rectangle, Polyline, and Polygon participate as their individual Line records; grouped identity remains deferred.

## Overlay and state

The scene exposes a semantic `selectionBoxOverlay` with mode, normalized screen rectangle, translucent fill data, and renderer-ready boundary segments. Window uses a low-alpha cool-blue fill and solid blue boundary; Crossing uses a low-alpha cool-green fill and dashed green boundary. The fill is expressed as bounded screen-space scanlines so Canvas2D and WebGPU consume identical visual geometry through the existing ordered line-group pipeline. Fill groups render above workspace geometry and below box borders and cursor/snap feedback.

Only start/current screen points, pointer identity, modifier snapshot, active flag, and mode are transiently stored. No document, history, revision, dirty, persistence, snapping, or camera state is changed while dragging. Candidate pre-highlighting, lasso/polygon selection, filters, cycling, sub-objects, and grouped-object selection are deferred.
