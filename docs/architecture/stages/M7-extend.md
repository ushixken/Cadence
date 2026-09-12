# M7 - Extend

M7 adds repeatable `Extend` with alias `EX`. The command follows the same two-phase interaction model as Trim: select boundary objects with the existing D3/D3A click, Window, Crossing, and modifier semantics, press Enter or quick Space to confirm them, then click an endpoint/side of a supported target object to extend it. A second Enter or quick Space finishes the command, and Escape cancels without document changes.

Extend uses the M6 curve foundation rather than renderer or screen-space geometry. `CaderactExtendPlanner.planExtend()` describes the target and confirmed boundaries with `CurveDescriptor`, intersects unbounded target support with finite boundary domains through `CurveIntersection`, and picks the nearest valid intersection in the selected endpoint's extension direction. The picked model-space point determines the target side deterministically; the opposite endpoint is never changed by screen ordering.

Supported target results in this stage are Lines, Arcs, and open native Polylines. Circles and Ellipses participate as boundaries, but as closed target curves they are rejected as `closed-curve-not-extendable`. Ellipses are never converted into a different persistent schema. Rectangle and Polygon edges remain ordinary Line records and extend individually.

Successful publication goes through `recordGateway.publishExtendPlan(plan)`. The publisher verifies the target still exists and that the planned source geometry still matches the current authoritative record before opening one transaction. Lines and Arcs preserve their record IDs and endpoint feature IDs. Open Polylines preserve their record ID and all vertex feature IDs while changing only the selected endpoint vertex coordinate. No-op, invalid, missing, stale, unsupported, and failed plans do not mutate the document, history, revision, dirty state, persistence schema, or selection.

The live Extend preview is renderer-neutral. The command session exposes source records for a subdued stationary ghost and one proposed replacement record for the dominant preview. Canvas2D and WebGPU consume that scene data through the existing preview and source-ghost groups; neither renderer owns Extend semantics. Preview data is transient only and never enters persistence, history, selection, or `SnapResolver`.

Snapping remains D2/D2A-owned. Target clicks use the existing resolved point path, including Shift bypass behavior, while raw pointer hit testing identifies which committed object was clicked. No snap type, tolerance, ranking, grid behavior, or selection semantics were added for M7.

Deferred: Quick Mode, edge/no-extend options, Fence, Project/UCS/View projection, 3D extension, Trim/Extend combined mode, Shift-select Trim/Extend toggle, Lengthen, Fillet/Chamfer, persistent options, and new persistence schemas.
# C1 preselection

Extend maps valid existing selection to boundary edges through the shared
[C1 command preselection](C1-command-preselection.md) contract and proceeds
directly to endpoint target picking.
