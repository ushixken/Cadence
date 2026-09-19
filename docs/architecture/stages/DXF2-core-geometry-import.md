# DXF2 — Core geometry import

DXF2 extends the bounded DXF1 parser and isolated replacement-document mapper with native straight polylines, circles, counterclockwise arcs, and full ellipses. The parser continues to emit neutral DXF-oriented values and never constructs Caderact records.

## Supported subset

- `LWPOLYLINE`: ordered planar vertices, straight zero-width segments, open/closed flag.
- legacy `POLYLINE` sequences: planar 2D header followed by `VERTEX*` and one `SEQEND`, with straight zero-width segments and open/closed flag.
- `CIRCLE`: finite planar center and positive radius.
- `ARC`: finite planar center, positive radius, and nondegenerate DXF start/end angles.
- `ELLIPSE`: finite planar center, nonzero major-axis vector, ratio in `(0, 1]`, and a complete parameter turn.

All mapped objects use the isolated store's normal record gateway, giving records and Polyline/Arc features fresh native identities. DXF2 retains the DXF1 Layer 0 and ByLayer policy.

## Polyline policy

Lightweight vertices are associated in source order: each repeated group 10 begins a vertex and its group 20 supplies Y. Group 90 must exactly match the parsed vertex count. Bit 1 of group 70 controls native `closed`; Plinegen bit 128 is harmless. Invalid counts or incomplete vertex pairs are fatal malformed supported data.

Legacy `POLYLINE`, `VERTEX`, and `SEQEND` form one sequence. Sequence members count individually against the entity resource limit. A missing terminator or stray `VERTEX`/`SEQEND` is a fatal structural error.

Any nonzero bulge is skipped with a structured warning because native Polyline has no arc-segment representation. Nonzero constant/vertex width is likewise skipped. Curve-fit, spline-fit, 3D, polygon mesh, polyface, and flagged fitted vertices are skipped rather than reinterpreted. Curves are never tessellated.

## Arc conversion

DXF ARC angles are degrees and describe the counterclockwise path from start to end. Mapping converts degrees to radians and computes the positive modular sweep:

```text
sweep = positiveModulo(endAngle - startAngle, 360°)
```

This preserves minor arcs, major arcs, and arcs crossing 0°. A start of 90° and end of 0°, for example, is a 270° counterclockwise arc rather than a clockwise quarter arc. Start/end points are derived from the normalized start angle plus that sweep. Zero or numerically degenerate sweeps are fatal.

## Ellipse conversion

The native Ellipse stores a center, major-axis vector, and scalar minor radius. DXF group 11/21 maps directly to the major-axis vector and:

```text
minorRadius = length(majorAxis) × minorMajorRatio
```

This preserves rotated ellipses without extracting and reapplying a rotation angle. DXF2 accepts only a full parameter span of `2π`. Partial elliptical arcs are skipped with a warning and are never promoted to full ellipses or approximated.

## Planarity and diagnostics

The shared conservative policy accepts zero elevation/Z, zero thickness, and default extrusion `(0, 0, 1)`. Nonzero Z/elevation/thickness or another extrusion causes a deterministic skip warning. DXF2 does not transform arbitrary OCS coordinates or flatten 3D data.

Malformed supported geometry—missing required values, non-finite numbers, invalid counts, nonpositive radii, invalid ellipse axes/ratios, or broken legacy sequences—fails the complete import atomically. Structurally valid out-of-scope geometry is skipped and reported. Diagnostic aggregation and caps remain owned by DXF1's diagnostic boundary.

## DXF3 boundary

DXF3 owns complete `LAYER` table and entity property mapping, including names, visibility/locking, colors, ByLayer/ByBlock behavior, linetypes, and lineweights. Text, dimensions, blocks, hatch, splines, arbitrary OCS/3D conversion, export, and merge import remain later work.
