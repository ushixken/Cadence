# SEL1 — Professional Selection

SEL1 extends the existing transient `SelectionManager`; it does not introduce document-owned selection or a second command-selection authority.

`ProfessionalSelection` is the pure screen-space geometry/query boundary. Fence tests every open fence segment against projected semantic entity geometry. Window Polygon requires every projected entity segment endpoint to be inside the polygon; Crossing Polygon also accepts boundary intersections. Curves use the same adaptive Circle, Arc, Ellipse, Region/Hatch, annotation, and dimension geometry authorities used by rendering and existing rectangular selection. Expanded Block members retain the outer instance ID, so model-space Blocks remain one semantic selection target. Group expansion continues through the existing selection target resolver.

The viewport owns only transient interaction state: acquired polygon/fence points, the live renderer-neutral preview, and overlapping-pick cycling. `Tab`/`Shift+Tab` move deterministically through distance/ID-ordered candidates, `Enter` accepts the highlighted candidate, and `Escape` dismisses cycling. A single candidate follows the original click path unchanged.

Fence, Window Polygon, and Crossing Polygon are commands while idle. During an existing command selection phase, typed `F`, `WP`, or `CP` starts the same transient controller and returns to the requesting command after completion. `SIMILAR`, `TYPE <entity-type>`, and `LAYER <name>` likewise update the shared selection. Select Similar matches semantic record type plus layer; type/layer queries read only current editable model-space records, preserving hidden and locked policies.

All selection operations are session state only: they create no document transaction, history entry, revision, dirty state, or persisted data.
