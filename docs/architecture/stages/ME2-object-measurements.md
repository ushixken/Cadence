# ME2 — Object measurements

## Shared authority

`CaderactMeasurement.measureRecord(record)` is the sole DOM-free object-measurement authority. Commands and the Properties panel consume its full-precision `Number` results; formatting occurs only at the ME1 `CaderactUnits.format` presentation boundary.

## Supported geometry

| Record | Exact measurements | `Length` meaning |
| --- | --- | --- |
| Line | Length | Segment length |
| Circle | Radius, diameter, circumference | Circumference |
| Arc | Radius, diameter, signed sweep, arc length | `abs(sweep) × radius` |
| Polyline | Total length, vertex count, closed state | Consecutive segments plus last-to-first only when persistent `closed` is true |
| Ellipse | Major/minor radii and diameters | Deferred; no undocumented perimeter approximation |

Duplicate or coincident Polyline vertices contribute zero safely. Closure is never inferred from coincident endpoints. `Length`, `Radius`, and `Diameter` complete after one object; `LEN`, `RAD`, and `DIA` are aliases and normal repeat-last behavior applies.

## Selection and isolation

A single visible supported preselection completes immediately. Multiple or unsupported preselection falls back to an explicit pick. Picks use authoritative visible records rather than editable records: visible locked geometry is measurable, while hidden geometry is not interactively available. Unsupported picks remain retryable.

Measurements are observational. They do not publish transactions, alter records, dirty the document, change revision, or create Undo/Redo history. The Properties panel shares the same authority and refreshes through its existing selection/document subscriptions.

ME3 defers area and perimeter work. ME4 defers included angles, point-to-curve and object-to-object distance, and cumulative distance. ME5 defers richer measurement UI, result copying, and optional history/panels.
