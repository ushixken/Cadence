# P5 — Precision Numeric Input

P5 owns numeric interpretation and exact model-space resolution. P6 may
visualize and edit these values near the cursor, but must reuse P5 rather than
introducing a second numeric-input engine.

`PrecisionInput` is DOM-free and document-free. It builds on the existing D1
unit-aware point parser and normalizes absolute points (`x,y`), relative
Cartesian points (`@x,y`), scalars, degree angles, and polar points
(`@distance<angle`). Values must be finite; malformed text and invalid
command-specific values leave the current session retryable.

For a point phase with a reference, a bare positive distance resolves from the
latest authoritative constrained/snap-resolved pointer direction. It is model
space only: `reference + normalize(direction) * distance`. Without a valid
direction it is rejected rather than fabricated. Polar input is independent of
the pointer and follows world coordinates: 0 degrees is +X and 90 degrees is
+Y.

Pointer candidates continue through constraints and snapping. Typed precision
values resolve directly to exact model coordinates and are accepted without a
second Grid/Object Snap/Tracking/Ortho/Polar pass. Line, Polyline, Rectangle,
Circle, Arc, Ellipse, Polygon, Move, Copy, Rotate, Scale, Mirror, and Offset
reuse this input authority where their phase accepts a point, distance, angle,
or factor. P5 deliberately adds no mouse-following HUD, expression parser,
units UI, or cursor editing controls; those remain P6 or later work.
