# P3 — Object Snaps

Object Snap remains a single D2/D2A `SnapResolver` concern. Its user-level
preferences provide a master `objectSnapEnabled` gate and independently stored
mode settings; Grid Snap remains a separate continuous lattice quantizer.
Defaults enable Endpoint, Midpoint, Center, Intersection, and Vertex while
leaving Quadrant, Nearest, Perpendicular, and Tangent disabled to avoid noisy
acquisition. Preferences never enter a drawing, history, revision, dirty
state, or CAD file; New/Open preserve them and Reset restores these defaults.

All object candidates are CSS-pixel-aperture candidates and share the resolver's
distance-first, deterministic near-tie ranking. Grid is ranked last and is
continuous. Static candidates work for first-point acquisition; contextual
Perpendicular and Tangent require a command reference point and must not invent
one. Center applies to Circle, Arc, and Ellipse; Arc midpoint is evaluated on
the stored sweep, never on the opposite circle point.

Same-coordinate deduplication preserves one authoritative point and primary
`kind`, while `kinds` retains every contributing semantic meaning in priority
order. References are likewise retained as metadata. This allows an Endpoint
that is also an Intersection to remain one accepted coordinate while presenting
`End, Int`; Grid and Draft Point never enter an Object Snap compound label.

Intersection reuse is limited to reliable existing M6/M7 curve-domain helpers.
Ellipse/general-curve contextual snaps and a spatial index remain deferred;
future intersection expansion must retain domain filtering and bounded
candidate work.

The renderer-neutral SnapOverlay renders exactly the resolver winner: Center is
a center-marked circle, Intersection an X, Quadrant a crossed diamond, Vertex
a compact square, Nearest a dot, Perpendicular a right angle, and Tangent a
small circle with tangent stroke. Labels are `End`, `Mid`, `Cen`, `Int`, `Near`,
`Perp`, `Tan`, `Quad`, and `Vertex`, joined in resolver-priority order;
the overlay is cleared whenever snapping is lost or the command ends.
