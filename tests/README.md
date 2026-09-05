# Stage 1 behavior regression suite

Run `npm test` with Node.js 22 or newer. No npm dependencies or installation are needed. Stage 1 established 40 passing cases. Later suites protect the document boundary, transaction/history core, A5 Line draft migration, A6 read side, A7 layer/property transactions, A8 persistence, A9 units, and A10 topology references; see `docs/architecture/stages/`.

There was no package.json, npm script, installed test stack, or existing test suite when Stage 1 began. Node's built-in test runner and VM provide the smallest dependency-free setup for these classic browser scripts. No production source files were changed.

## Organization

- `commands/input.test.cjs`: name/alias/prefix launch, trimming/case, Enter/Space/click exactly-once dispatch, Tab completion, printable-key routing and field/modifier guards.
- `commands/line.test.cjs`: transient Line drafts, live preview, one-transaction completion, cancellation, Step Undo, failure retention, and clean restart.
- `viewport/navigation.test.cjs`: real coordinate functions, pan, wheel/drag zoom anchors, navigation termination, resize and DPR through the real Canvas2D renderer.
- `rendering/boundary.test.cjs`: scene ordering, buffer isolation, WebGPU-first creation, early fallback, context-exclusive canvas replacement, device-loss/render-exception recovery, and controlled total failure.
- `rendering/scale.test.cjs`: 5,000-record authoritative enumeration, stable ordering, scene projection, and Canvas2D consumption baseline.
- `rendering/read-side.test.cjs`: authoritative document projection, Undo/Redo and external publication rendering, immutable deterministic enumeration, unsupported records, and the shared backend scene contract.
- `document/layers.test.cjs`: layer invariants and immutable reads, atomic lifecycle/property edits, deletion policy, exact history, stale/rollback behavior, branching, and A6 rendering continuity.
- `document/persistence.test.cjs`: deterministic versioned payloads, exact round trips, fresh clean load state, pinned-save acknowledgment, corruption rejection, transient-state exclusion, and loaded-record rendering.
- `document/units.test.cjs`: canonical units, conversions and formatting, transactional metadata changes, exact Undo/Redo, geometry/ID invariance, and persistence validation.
- `document/references.test.cjs`: immutable object/endpoint references, malformed and mismatched targets, current-state edit/history/deletion resolution, and persistence compatibility.
- `helpers/browser.cjs`: isolated browser/event/canvas stubs and deterministic animation-frame flushing.

The harness executes production files in a fresh VM for each test. It reads existing lexical state for assertions instead of adding test-only production exports. Mathematical tests call the actual production functions, not reimplemented formulas.

## Confirmed bindings and observations

- Space + left drag and middle drag pan.
- Ctrl with either supported navigation drag selects horizontal drag zoom; the suite exercises Ctrl-middle.
- Wheel zoom anchors at the cursor; drag zoom anchors at drag start.
- Rubber-band preview is removed on pointer leave; accepted draft segments remain in the transient overlay until finish or cancellation.
- Enter used to launch a suggestion is not also consumed as Line completion.
- Enter publishes a complete Line draft once; Escape discards the uncommitted draft without document publication.

## WebGPU recovery

Before A11, the viewport called the renderer factory again using the same canvas after device loss. If WebGPU had already been acquired, Canvas2D context acquisition could return null. Canvas2DRenderer then failed during rendering.

A11 replaces the locked canvas before late Canvas2D recovery, validates Canvas2D context creation immediately, rebinds viewport interactions once, and redraws current authoritative state. Tests model context exclusivity and verify positive recovery, preserved state, repeated replacement, and controlled total failure. They are not hardware/browser device-loss tests.

Synchronous rendering exceptions are contained and enter the same one-at-a-time recovery path. Failure to create the fallback renderer produces an inspectable failed state rather than an unhandled frame exception.

## Limits and manual follow-up

- No real DOM, browser event default actions, CSS layout, pointer-capture implementation, IME, text composition, visual snapshots, or GPU shader execution is exercised.
- Editable-field tests cover printable typing. Current global Enter/Escape handling occurs before the editable-field guard, so those keys can finish/cancel an active Line from another field. This is documented, not silently fixed or presented as protected field-specific behavior.
- Repeated keyboard events and Ctrl/Alt/Meta shortcuts while already inside command input are not comprehensively covered; modifier tests target global printable routing.
- DPR is injected and backing-store sizing verified; physical display sharpness needs a browser check.
- The suite verifies submitted screen-space geometry/preview arrays and redraw replacement, not actual displayed pixels.
- Real WebGPURenderer GPU calls are not executed; factory control flow is stubbed. Hardware correctness and performance remain out of scope.
- No persistence system exists here; draft/preview separation is tested against authoritative geometry, not a saved file.

Before architecture migration, manually smoke-test in a browser: suggestion launch, A–B–C then Enter, another session then Escape, middle/Space pan during Line, wheel and Ctrl-drag zoom, resize, and input-field focus. Do not interpret the VM suite as a completed browser smoke test.

## Architecture context

The accepted ADR is now at `docs/architecture/decisions/Caderact-ADR-001-document-transactions.md`. Stage 2 did not rewrite it.

A5 changes only Line's command-local draft/publication boundary; it adds no global Undo shortcut, new navigation binding, or renderer redesign.
