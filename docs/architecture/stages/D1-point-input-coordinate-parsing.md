# D1 — Point Input + Coordinate Parsing

## Parser boundary

`PointInput` is a pure, command-independent module. It separates complete numeric-token parsing, A9 unit conversion, Cartesian syntax parsing, and optional relative resolution. It never reads or mutates a document or draft and returns immutable structured results rather than throwing user-facing parser errors.

## Grammar and syntax

A component is a signed integer or decimal optionally followed by whitespace and one supported case-insensitive suffix: `mm`, `cm`, `m`, `in`, or `ft`. The entire token must match; permissive trailing text, exponent syntax, `NaN`, and `Infinity` are rejected. Surrounding whitespace and a leading plus/minus are accepted.

Absolute points use `x,y`. Relative points use `@dx,dy` and require a finite anchor. Both components are mandatory and no third component is permitted. Results are finite document/world coordinates, never screen coordinates.

Bare numbers are interpreted directly in the current document unit. Suffixed components are independently converted through `CaderactUnits.convert`, so mixed inputs such as `1m,250mm` are supported without changing document metadata or rounding stored values.

## Active-command routing

`CommandRouter.submitActiveInput` gives the active session first ownership of typed input without knowing its grammar. A session opts in with `handleInput`. While such a command is active, command autocomplete is suppressed. Idle coordinate text still follows normal U1 execution and cannot implicitly start Line.

Line's handler parses against the active document unit and resolves relative input from the draft's immutable current point. Accepted typed points call the same `LineDraftSession.acceptPoint` method as pointer input. Prompts, preview, single-publication finish, Escape cancellation, Step Undo, and document Undo/Redo therefore remain shared.

Invalid input returns `invalid-input` with `invalid-coordinate`, `invalid-number`, `unsupported-unit`, or `relative-point-without-anchor`. U5 displays the concise red error temporarily and restores the latest active prompt. The active command, draft, revision, state identity, dirty state, and A4 history remain unchanged.

## Deferred

Polar/distance-angle syntax, architectural feet-inches, fractions, cursor-local dynamic input, snapping, Ortho, tracking, Z/3D points, expressions, variables, coordinate history, and additional drawing commands remain deferred.
