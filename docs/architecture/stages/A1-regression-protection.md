# A1 — Regression protection

Status: Completed and accepted.

## Purpose

A1 established a behavior-regression safety net before Caderact's document
architecture migration began. Its purpose was to capture the editor behavior
that already existed, not to redesign it. Later stages could then change data
ownership and internal boundaries while tests continued to identify accidental
changes to observable command, drawing, navigation, and rendering behavior.

At A1 completion the suite contained exactly 40 passing tests and no failures.
The historical test distribution was:

- 19 command and input cases;
- 7 Line interaction cases;
- 7 viewport/navigation cases; and
- 7 rendering-boundary and fallback cases.

## Test foundation

A1 introduced the dependency-free Node test entry point and the small VM-based
browser harness. The harness loaded the production classic scripts in an
isolated context and supplied only the DOM, event, canvas, animation-frame, and
renderer behavior needed by the tests. Assertions exercised production
coordinate and command functions rather than reimplementing their logic.

This was regression protection rather than a browser conformance suite. It did
not simulate full layout, browser text insertion, pointer capture, IME,
composition, physical display output, or real GPU execution. Manual browser
smoke testing remained necessary for visual and hardware behavior.

## Protected command and input behavior

The command tests captured the behavior present at A1 completion:

- `Line`, `l`, uppercase aliases, mixed-case/trimmed input, and the accepted
  prefix selected Line with Enter or Space;
- command confirmation launched Line exactly once rather than immediately
  finishing it;
- clicking the suggestion used the same launch path, while Tab completed the
  spelling without launching;
- printable keyboard input outside another editable field focused and populated
  the command input;
- Escape cleared an unfinished command search; and
- printable input in other fields and Ctrl/Alt/Meta combinations was not
  hijacked by global command typing.

These tests captured existing routing behavior. A1 did not introduce a command
manager, history shortcuts, or a new command lifecycle.

## Protected Line behavior

Before A2–A5, Line used viewport-local completed geometry. A1 protected that
historical behavior:

- the first point created no completed segment;
- subsequent clicks created continuous independent Line segments in world
  coordinates;
- the rubber-band preview followed the pointer from the latest accepted point;
- pointer movement redrew rather than permanently accumulating preview pixels;
- Enter kept the completed session and removed its preview;
- Escape removed only segments created by the current Line session, preserving
  earlier geometry; and
- Enter or Escape with no segment, including a first-point-only session, left no
  unfinished geometry.

This was specifically the pre-migration behavior. A1 did not contain stable
document/object/feature IDs, transactions, document history, state identity, or
the later `LineDraftSession` architecture.

## Protected viewport and navigation behavior

A1 exercised the actual viewport coordinate and navigation functions:

- screen/world conversion round-tripped representative points and zoom levels;
- Space plus left drag and middle-button drag panned without creating Line
  geometry;
- wheel zoom preserved the world point beneath the cursor;
- Ctrl-middle horizontal drag zoom remained anchored at its drag-start point;
- pointer cancellation, lost capture, and window blur ended navigation;
- invalid zoom values were ignored; and
- resize recentered the initial view, respected device-pixel ratio, preserved
  geometry, and retained coordinate round-tripping.

A1 captured these bindings as they existed. It did not add new navigation
behavior or a camera architecture migration.

## Protected rendering behavior

The rendering tests established the existing renderer boundary and scene order:

- the viewport submitted grid/boundary, axes, completed geometry, and preview
  line groups in their established order;
- disposable scene buffers could not mutate model geometry;
- a renderer exception did not mutate existing geometry;
- Canvas2D fallback was selected when WebGPU, an adapter, or a device was
  unavailable before WebGPU context acquisition; and
- device-loss handling retried the renderer factory using the same canvas.

These tests did not introduce the later authoritative document read-side or
claim pixel-identical Canvas2D/WebGPU output.

## Known WebGPU recovery defect

A1 intentionally captured, but did not fix, the known late WebGPU fallback
defect. Once a canvas had acquired a WebGPU context, recovery could retry the
factory on that same canvas and then select Canvas2D. The 2D context could be
null or unusable because of canvas context exclusivity, causing rendering to
fail.

The known-defect test passes by demonstrating that failure path. It is a
regression marker, not proof that recovery works, and it does not represent a
hardware device-loss test.

A11 later fixed this defect by replacing a WebGPU-locked canvas before
Canvas2D recovery and converting the expected-defect regression into positive
recovery coverage.

## Architectural role

A1 is the safety baseline for the staged migration:

```text
A1  behavior regression protection
 -> A2 authoritative document and stable IDs
 -> A3 transaction controller
 -> A4 history and state identity
 -> A5 transient Line draft
 -> A6 authoritative persistent rendering read-side
```

The later stages were allowed to adapt internal test observations when ownership
changed, but they retained the protected user-visible intent. A1 itself did not
introduce any of those later-stage architectures.

## Non-goals and deferred work

A1 added no `CaderactDocument`, stable identities, transaction system,
Undo/Redo, `stateId`, save-state tracking, Line draft abstraction, authoritative
`records()` rendering, layer/property transactions, persistence, snapping, new
CAD commands, renderer redesign, framework migration, or WebGPU recovery fix.

Its sole architectural decision was to establish executable regression evidence
before those changes began.

## Historical evidence

This backfill was reconstructed from the Stage 1 test files as recorded with
the initial document-boundary work, the contemporaneous `tests/README.md`, the
A2 and A3 stage notes, ADR-001's migration sequence, and repository history.
The original loop-expanded test definitions account for all 40 A1 cases; later
document tests and architecture behavior were excluded from the A1 baseline.
