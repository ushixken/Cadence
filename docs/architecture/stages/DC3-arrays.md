# DC3 — Rectangular, Polar, and Path Arrays

DC3 adds three non-associative AF1 command extensions. `ArrayPlanner` is the pure authority for placement transforms and safety validation; `ArrayCommands` owns command phases, renderer-neutral previews, resolved-point input, and atomic publication through the existing document gateway.

## Semantics

- Rectangular arrays retain the source at row 0 / column 0 and create independent copies for every other row/column position. Signed row and column spacing is supported.
- Polar arrays retain the source at angle zero. Full 360° arrays divide by the item count and never generate a duplicate at 360°; partial arrays include the requested terminal fill angle. Positive angles are counter-clockwise and negative angles clockwise.
- Path arrays accept a resolved source base point and an editable Line or open Polyline path. Copies are sampled by cumulative path distance. DC3 deliberately keeps source orientation fixed; tangent alignment is deferred.

All generated records receive fresh record and topology identities, retain their source layer/properties, publish as one history transaction, and become the resulting selection. Source records remain unchanged. Hidden, locked, unavailable, or grouped selection is rejected rather than flattened. A maximum of 500 generated records prevents accidental runaway publication.

Preview records are derived from the same immutable transform plan used for commit and enter `ViewportScene` through the existing transform-preview contract. No array geometry or command state lives in `Viewport.js`, renderers, document persistence, or history.
