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

P5 remains the only numeric parser and exact model-space resolver. P6A does not
own keyboard input. Editable fields, Tab cycling, command-bar synchronization,
and detailed Dynamic Input settings are deliberately deferred to P6B.
