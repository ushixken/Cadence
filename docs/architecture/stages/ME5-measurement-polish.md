# ME5 — Measurement polish and final audit

## Command inventory and discoverability

The beta measurement surface is `Distance` (`DI`, `DIST`), `Length` (`LEN`), `Radius` (`RAD`), `Diameter` (`DIA`), `Area`, `Perimeter` (`PERIM`), `Angle` (`ANG`), `DistanceObject` (`DOBJ`), `MinDist`, and `DistanceSum` (`DSUM`). Names and aliases remain owned by the command registry and repeat through the normal router policy. A compact Measure group under Tools launches those same canonical commands; it contains no separate command state.

## Formatting and interaction contract

`CaderactMeasurement` owns exact model-space calculations. Linear results use the document's linear unit, area uses the squared unit, and angles use degrees. Result summaries use `Label = value` clauses. Dynamic Input remains transient: Distance shows distance and angle, Angle shows the included angle, and DistanceSum shows segment and total. Object-pick commands do not manufacture irrelevant HUD fields.

Measurement previews are renderer-neutral scene data. Distance, point-to-object, and minimum-distance connectors share the temporary measurement style; Angle supplies its ray/arc approximation; DistanceSum supplies its current segment. Canvas2D and WebGPU consume the same scene contract, and completion, cancellation, pointer leave, command replacement, and document replacement clear transient feedback.

## Selection, visibility, and document isolation

Single-object commands accept one valid visible preselection. Multiple or unsupported selections fall back to explicit picking. Visible locked geometry remains measurable; hidden geometry is excluded. Unsupported picks stay retryable and identify the required geometry or known unsupported case.

Measurements never publish records, properties, layers, revision, dirty state, or history. Properties derives intrinsic values from `CaderactMeasurement`; it does not duplicate formulas. Point-to-Polyline work is linear in segment count and Polyline-to-Polyline work is pairwise; moderate inputs require no cache or spatial-index complexity at this stage.

## Unsupported and deferred

Ellipse nearest distance and perimeter, arbitrary region discovery, Arc sector/segment area, spline/NURBS measurement, measurement history, persistent annotations/dimensions, parametrics, and constraints remain deferred. Copy Result is also deferred until a shared clipboard/action authority exists rather than adding a measurement-only browser integration.

With registry naming, formatting, Dynamic Input, previews, preselection, visibility, Properties reuse, lifecycle, and document isolation covered by the regression suite, the current non-persistent Measurement subsystem is beta-ready within this matrix.
