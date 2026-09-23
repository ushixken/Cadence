# DC2 — Join, Split/Break, and Generic Explode

DC2 uses the AF1 extension boundary for four user-facing commands: `Join` (`J`), `Split` (`SPL`), `Break` (`BR`), and `Explode` (`X`). Their command implementations remain outside `Viewport.js`; the viewport supplies only a narrow editable Line/open-Polyline picking adapter.

## Join

`JoinPlanner` is pure and uses a fixed model-space tolerance. It accepts native Lines and open Polylines that form one unambiguous endpoint-connected chain. Two Lines must additionally be collinear. Every selected record must share layer and explicit object properties.

The plan preserves the first selected record ID and surviving feature identities. Other source records are removed in the same transaction. A Line-only collinear result remains one native Line; a mixed or bent chain becomes one native open Polyline. Gaps outside tolerance, branching, closed Polylines, unsupported records, incompatible properties, grouped records, and non-editable records are rejected without mutation.

## Split and Break

`SplitBreakPlanner` is pure. Split divides an editable Line or open Polyline at one exact interior model point. The original record ID remains on the portion containing the original start; the sibling receives a fresh record ID. Original outer feature identities survive and each new split seam receives an independent feature identity.

Break is an explicit two-point Line workflow. It removes the bounded interval between two exact interior points and publishes the two surviving Line portions atomically. Endpoint, off-entity, coincident, closed-Polyline, and unsupported cases are structured failures.

After object selection, Split and Break use the normal resolved-point pipeline. Osnap, Track, typed coordinates, raw-crosshair separation, and Dynamic Input ownership remain unchanged. Renderer-neutral previews use the same planned pieces later passed to publication and create no history.

## Generic Explode

Explode is registered once through AF1. Its dispatcher inspects the complete selection and delegates Block Instances to the existing `recordGateway.explodeBlockInstances` authority. The block traversal, identity, nested-transform, persistence, and transaction algorithms are not duplicated. Entities without an established explode semantic return clear non-mutating feedback.

## Transactions and lifecycle

Join and Split/Break publication gateways validate exact source snapshots, current editability, and group ownership before beginning one transaction. Undo and Redo restore exact source/result records. Hover, preview, invalid input, unsupported dispatch, publication failure, and Escape leave document, history, revision, and dirty state unchanged.

Deferred: fuzzy/healing joins, closed-Polyline joining, curve joining, Arc/Circle splitting, Polyline two-point Break, and new explode semantics for entities that do not already define them.
