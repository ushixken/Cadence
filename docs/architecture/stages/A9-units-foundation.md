# A9 — Units foundation

Status: Completed; ready for review.

## Document unit state

Every Caderact document now contains the persistent singleton
`units: { length }`. The canonical length identifiers are:

- `mm` — millimeters;
- `cm` — centimeters;
- `m` — meters;
- `in` — inches; and
- `ft` — feet.

New documents default to `mm`. Identifiers are exact and case-sensitive; UI
labels are not stored in the document. Display precision is not persistent in
A9 because no document-level formatting preference is yet required.

`CaderactDocument` owns this setting and exposes it through the immutable
`modelReader.units()` read. The viewport and renderers continue to consume only
plain numeric geometry and do not interpret units.

## Numeric meaning and metadata changes

Persistent coordinates remain finite JavaScript Numbers. A stored value is
expressed in the document's current length unit. Changing `units.length` in A9
is metadata-only: it reinterprets those unchanged values and does not preserve
physical size by rescaling geometry.

Consequently a Line endpoint at `25.4` remains exactly `25.4`, with the same
object and feature IDs, when the document unit changes from millimeters to
inches. A future explicit size-preserving conversion operation must be clearly
separate and atomic; A9 does not implement it.

## Unit utility API

`CaderactUnits` is command-agnostic and exposes:

- `supportedLengthUnits` — the frozen canonical identifier list;
- `isSupportedLengthUnit(unit)` — exact identifier validation;
- `conversionFactor(fromUnit, toUnit)` — the numeric source-to-target factor;
- `convert(value, fromUnit, toUnit)` — finite conversion through millimeters as
  the common base; and
- `format(value, unit, precision)` — fixed-decimal deterministic text including
  the canonical suffix.

The conversion basis is 1 cm = 10 mm, 1 m = 1000 mm, 1 in = 25.4 mm, and
1 ft = 304.8 mm. Zero and negative finite measurements are valid. Non-finite
inputs/results, unsupported identifiers, and precision outside integer 0–15 are
rejected. Formatting does not round or mutate stored geometry.

Unit-suffix parsing and command-input interpretation remain deferred; numeric
command input is unit-neutral in A9.

## Transactions and history

The A7 named-collection transaction model exposes the document units singleton
as `settings/units`. `unitGateway.setLengthUnit(unit)` replaces it through one
normal `DocumentController` transaction.

A successful non-no-op change produces one publication, one revision increment,
one state transition, and one history entry. Setting the current unit again or
requesting an unsupported identifier changes no document, revision, history, or
state identity. Undo and Redo restore the exact prior/current unit while leaving
all geometry values and stable IDs unchanged.

## Persistence and version policy

A8 `fileVersion: 1` now includes required `document.units.length`. Layer and
record ordering remain unchanged and deterministic. Save/load/save restores the
exact unit identifier and serialized output. Missing or unsupported unit data is
rejected during complete candidate validation before a loaded store is created.

The file version remains 1. A9 is completing the initial native v1 schema before
external compatibility or migration support exists; it does not invent a v2 or
a migration for the immediately preceding internal baseline. From A9 onward,
v1 unit data is required—an A8-only prototype payload without it is invalid.

## UI boundary and deferred work

The existing footer unit text and menu remain presentation-only and are not
redesigned or bound by A9. Deferred work includes unit selector UI, model-unit
conversion/rescaling, suffix parsing such as `10mm`, feet-and-inches notation,
architectural/engineering formatting, persistent precision preferences, angles,
tolerances, insertion units, snapping changes, and A10+ features.

