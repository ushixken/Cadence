# P2 — Polar Tracking

Polar is a runtime drafting constraint shared with P1 Ortho. Persistent Polar defaults to off with a 45° increment. Ortho and Polar are mutually exclusive persistent settings.

The pointer path is raw model point → effective constraint → D2A snap resolution → preview/acceptance. Typed coordinates bypass constraints. Effective Ortho is active when neither persistent Polar nor its Shift inversion suppresses it; effective Polar is persistent Polar while Shift is not held. With both persistent constraints off, Shift temporarily enables Ortho.

Polar measures `atan2` in model coordinates from each command's existing Ortho reference. It acquires only within a 10° window of a 45° direction; otherwise the pointer remains free. Equal angular ties choose the increasing angle index. An acquired direction projects the original radial distance to that ray before D2A snapping.

Line, Polyline, Rectangle, Move, Copy, and Mirror reuse the P1 reference contract. The guide is a transient renderer-neutral viewport ray; it is never selectable, snappable, persisted, or included in history. Future Settings work may expose the increment through `setPolarIncrementDegrees`.
