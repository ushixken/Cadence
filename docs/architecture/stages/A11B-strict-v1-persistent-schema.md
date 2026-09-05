# A11B — Strict version-1 persistent schema

Status: Completed; ready for review.

## Audit finding

Before A11B, `CaderactDocument.validateDocument` validated required Line values
but did not reject additional enumerable properties. The transaction controller
could therefore publish a Line containing an unknown field. A8 persistence then
constructed a canonical object containing only known fields, silently losing
the accepted property during save/load.

Deserialization had the same ordering problem: raw file objects were
canonicalized before document validation, so unknown fields in the envelope,
document, units, layers, Lines, or endpoints disappeared before rejection.

## Closed v1 shapes

The unreleased version-1 schema is explicitly closed. `CaderactDocument.V1_FIELDS`
defines the allowed own enumerable fields for the file envelope, persisted and
authoritative document, geometry container, units, layer, Line, and endpoint.
Object and layer tables remain keyed collections whose keys are validated
against contained stable IDs. Unknown properties inside closed values are not
extension data and are rejected.

The canonical Line fields are `id`, `type`, `layerId`, `start`, and `end`.
Canonical endpoint fields are `x`, `y`, and `featureId`. Existing stable IDs and
field meaning are unchanged.

## Validation and persistence contract

Authoritative document validation checks the shared v1 field definitions before
publication. An unknown Line or endpoint property therefore produces a normal
transaction validation failure with no document, revision, history, state ID,
or dirty-state change.

Persistence checks raw JSON shapes before canonical reconstruction. An unknown
property rejects the whole file and is never stripped. Loading creates a
separate store only after complete validation, so a rejected payload cannot
change the active document.

The invariant is: every accepted authoritative persistent field is represented
by v1 serialization, and serialize → deserialize → serialize is exact and
deterministic for canonical v1 state.

## Version and future extension

`fileVersion` remains `1`. This tightens the in-development v1 contract rather
than changing a released file format. Future entity fields, custom properties,
extension bags, or plugin metadata require an explicit schema and versioning
decision; they must not be added only to transaction validation or only to
persistence.

No migration, compatibility shim, extension storage, or new entity type is part
of A11B.
