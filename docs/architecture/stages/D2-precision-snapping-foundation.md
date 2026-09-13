# D2 — Precision / Snapping Foundation

## Resolver architecture and result contract

`SnapResolver` is a pure, reusable pointer-acquisition service. The viewport converts a CSS-pixel pointer position to a raw world point, supplies the current authoritative records, world-to-screen transform, and U4 minor-grid spacing, then passes the resolver's exact point to the active Line session. Line contains no snap policy.

An acquired immutable result contains `snapped: true`, `kind`, a frozen world `point`, `distancePx`, and an optional reference. A miss contains `snapped: false` and the unmodified raw world point. Non-finite candidates never reach a command.

## Screen tolerance and ranking

Tolerance is 10 CSS pixels and is not multiplied by device pixel ratio. Zoom therefore changes its world extent while preserving its visual acquisition size.

Only candidates inside tolerance participate. Candidates more than 0.75 pixels apart are ordered strictly by nearest screen distance. Inside that close/equal window, priority is Endpoint, Midpoint, then Grid; remaining ties use a stable semantic key. Authoritative Lines are sorted by stable record ID and endpoints by feature ID, so incidental table iteration cannot affect results. A substantially closer grid target beats a farther endpoint.

## Candidate types

Line start/end candidates use current authoritative endpoint coordinates and attach the canonical frozen A10 `{kind:"feature", recordId, featureId}` reference. Midpoints are derived at full precision with `start + (end - start) / 2` and receive no persistent identity. Grid candidates round each raw world component to the nearest current U4 adaptive minor-spacing multiple, anchored at world origin; pan is absent from that calculation.

Endpoint and Midpoint are enabled by default while Grid starts disabled. The viewport owns an immutable transient enabled-mode snapshot and passes it into the pure resolver. The existing Grid Snap status button changes only `grid`; endpoint and midpoint remain enabled. This state creates no transaction or persistence field, survives ordinary drawing, and resets to OFF through the existing New/Open viewport reset because no user-preference store exists yet. Independent snap spacing and a full settings model remain future policy.

## Transient marker contract

The current acquired result enters `ViewportScene` as transient state. It becomes one final renderer-neutral line group plus `scene.snapOverlay` metadata. Endpoint uses a 10-pixel square, Midpoint a 10-pixel triangle, and Grid a symmetric 10-pixel hash made from two vertical and two horizontal lines inset 2.5 pixels around the shared center. Grid geometry and marker geometry both retain exact world-to-screen projection; raster alignment never changes their semantic coordinates. Marker dimensions are screen-stable because projection creates them directly in CSS pixels. Canvas2D and WebGPU consume the same segments; neither chooses the snap.

No markers are generated while idle or permanently for committed geometry. Leaving tolerance/viewport, typed input, finish, Escape, or Step Undo clears the current marker.

## Line, typed input, and authoritative state

Pointer movement resolves before rubber-band update, and pointer-down resolves again before `LineDraftSession.acceptPoint`, so preview and stored draft coordinates are identical exact snap coordinates. D1 typed points bypass snapping completely and retain full parsed precision. Mixed typed/snapped workflows share the same draft and one-transaction finish behavior.

Every pointer query enumerates the active document reader. Undo/Redo, deletion, New, and Open therefore immediately change candidates without a second geometry database. Hovering and snapping mutate no document, history, revision, state identity, or dirty state.

## Performance and deferred work

D2 performs a simple deterministic traversal of current Lines and creates transient endpoint/midpoint candidates only for the active point-consuming interaction. No idle preselection or permanent spatial index exists. A replaceable spatial index is deferred until measured scale requires one.

Grips, nearest/intersection/perpendicular/tangent/center/quadrant/extension snaps, Ortho, Polar/Object Snap Tracking, settings/tolerance UI, configurable grid-snap spacing, preference persistence, additional commands, and 3D snapping remain deferred.
## First-point grid acquisition

Grid Snap is available during first-point acquisition and never requires a drafting reference. The point path is raw pointer, optional Ortho/Polar constraint only when the command supplies a reference, then D2A Grid/object resolution. Therefore enabling Ortho or Polar before P1 cannot suppress Grid Snap; after a reference exists, those constraints resume before snapping.

When enabled, Grid Snap is continuous nearest-lattice quantization rather than CSS-pixel aperture acquisition. Each coordinate divides by authoritative grid spacing and uses `floor(value + 0.5)`; exact half-cells therefore select the greater lattice index, including negative coordinates. Object snaps remain aperture-gated and retain D2A ranking precedence when their acquired candidate is closer or inside the existing priority window.
