# S2 — Grid Appearance

Grid appearance is user preference state, never CAD document state. Defaults preserve the prior appearance: `#a7afbb` at 28% for minor grid lines, `#a7afbb` at 45% for major lines, and a major interval of 5.

Settings exposes Show Grid plus minor/major color and opacity controls and a major interval selector. Values are validated by `CaderactUserPreferences`, persisted in its versioned payload, and update the shared viewport scene immediately. Canvas2D and WebGPU consume the same renderer-neutral scene colors and segment groups. Major interval changes styling classification only: grid spacing, origin anchoring, units, and Grid Snap are unchanged. Reset restores these defaults without document mutation.

Axes use the same preference path: X axis is the horizontal `y = 0` line and defaults to `#984b51`; Y axis is the vertical `x = 0` line and defaults to `#3b7658`, both at full opacity. Show Grid hides minor, major, and both axes together. Axis appearance never affects snapping or geometry.
