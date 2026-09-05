# A10 — Topology and reference contracts

Status: Completed; ready for review.

## Purpose and boundary

A10 defines stable document-oriented references for the topology that current
Line records already own. A reference contains IDs only. It does not contain an
array position, insertion order, renderer index, screen coordinate, history
position, or direct object/feature pointer.

`CaderactReferences` owns reference construction, shape validation, and
resolution. `CaderactDocument` remains the authoritative owner of records and
feature IDs; `DocumentController` remains the owner of edits and history.
References do not own state or bypass transactions.

## Canonical reference shapes

Whole-record reference:

```json
{"kind":"object","recordId":"<stable object ID>"}
```

Line endpoint reference:

```json
{"kind":"feature","recordId":"<stable object ID>","featureId":"<stable endpoint ID>"}
```

`createObjectReference(recordId)` and
`createEndpointReference(recordId, featureId)` return frozen objects in this
canonical property order. `isReference(value)` validates the exact shape,
including non-empty IDs and no extra fields. References are ordinary
JSON-compatible values and hold no live model pointers.

The generic `feature` kind is intentionally limited by the resolver to supported
current topology. It leaves room for later record types without pretending A10
has introduced generic edge, face, vertex, or B-rep topology.

## Line topology identity

- A Line object's identity is its existing stable record `id`.
- Its start endpoint identity is `start.featureId`.
- Its end endpoint identity is `end.featureId`.
- Endpoint coordinates are values, not identity.

Changing coordinates while preserving the endpoint feature IDs preserves the
same topology. An operation that semantically replaces topology must use new
feature IDs; an old feature reference then correctly becomes unresolved. A10
does not alter Line creation or duplicate endpoint identity elsewhere.

## Current-state resolution

`createResolver(reader)` binds a resolver to an authoritative document reader.
Every `resolve(reference)` call obtains a fresh `reader.snapshot()` and resolves
against that current state.

Successful object resolution returns the current immutable record. Successful
feature resolution returns the current immutable Line record, the current
endpoint value, and semantic role `start` or `end`. These are resolution results,
not pointers stored inside the reference.

Deterministic unsuccessful outcomes are:

- `invalid-reference` for malformed or non-canonical shapes;
- `unresolved / missing-record` when the record no longer exists;
- `unresolved / feature-not-in-record` when the feature ID is not owned by the
  referenced record; and
- `unresolved / unsupported-record-type` when a current record has no A10
  feature-resolution contract.

No fallback searches another record for a supplied feature ID. The record and
feature pair must match.

## Transactions, history, and deletion

Geometry replacement still goes through the existing record transaction API.
When replacement preserves record and feature IDs, the same references resolve
to the updated coordinates. Undo and Redo make those references resolve to the
exact historical current values because resolution always reads the current
authoritative document.

Deleting a record makes both its object and endpoint references unresolved; the
reference value itself remains valid. Undoing deletion restores the original
record and feature identities, so the same references resolve again. References
have no independent history or lifecycle registry.

## Persistence boundary

A10 adds no document-level reference registry and no persistent schema field.
Reference values can be encoded and decoded directly with JSON when a future
feature needs to store one. Current Line record and endpoint IDs already survive
A8 serialization exactly, so a detached reference resolves against a loaded
document containing those IDs.

`fileVersion` remains 1 because durable document schema did not change.

## Future extension rules and deferred work

Future snapping, selection, dimensions, constraints, Trim/Extend, Offset, and
dependency systems may consume this ID-based contract. New topology kinds must
define semantic ownership, stable identity, replacement behavior, validation,
and current-state resolution before becoming valid reference targets.

Deferred beyond A10: snapping, selection state, intersections, dimensions,
constraints, Trim/Extend, Offset dependencies, a reference registry, generic
edge/face/vertex or B-rep topology, 3D topology, and A11+ work.

