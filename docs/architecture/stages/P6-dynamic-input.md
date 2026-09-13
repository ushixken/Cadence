# P6 — Dynamic Input

P6A adds a read-only, screen-space cursor HUD. `DynamicInput` owns an immutable
runtime state containing visibility, cursor position, current router/session
prompt, normalized display fields, and clamped/flipped viewport placement. A
small DOM adapter renders that state above the canvas; it has no document,
history, hit-testing, or renderer ownership.

The HUD reads the final authoritative point candidate after Ortho, Polar,
Object Snap, Object Tracking, and Grid resolution. Distance and angle therefore
describe exactly the model point a click would accept. First-point phases show
world X/Y; referenced phases show Distance/Angle, with Radius, Rotate Angle, or
Scale Factor used where those semantics are available. Formatting is isolated
from the underlying Number precision and currently trims distance values to
three decimals while displaying angles to two decimal degrees.

Placement uses fixed CSS-pixel offsets and flips left/up near viewport edges.
The HUD is hidden while idle, in selection or navigation ownership, outside the
viewport, and after completion, Escape, replacement, or document replacement.
`dynamicInputEnabled` is a persistent user preference defaulting on and never
enters drawing files or history.

P5 remains the only numeric parser and exact model-space resolver. P6A owns the
live display; P6B adds an immutable active-field/text buffer and explicit
keyboard ownership. With the command bar unfocused, numeric characters activate
the first meaningful editable field. Pointer updates continue refreshing context
without overwriting that buffer. Enter submits the buffer through the existing
command router and P5-backed session handler. Invalid input stays active; the
first Escape cancels only HUD editing. The command bar always takes precedence.

Editable support is Distance for referenced point phases, Circle Radius, Rotate
Angle, and Scale Factor. The controller supports deterministic forward/reverse
Tab cycling when a phase exposes multiple editable fields. Line and Polyline
Angle remain read-only because angle-only input has no unambiguous retained
distance contract. First-point coordinate editing, combined distance/angle
locking, detailed settings, and richer field sets remain deferred.
