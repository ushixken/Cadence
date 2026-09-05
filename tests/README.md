# Stage 1 behavior regression suite

Run `npm test` with Node.js 22 or newer. No npm dependencies or installation are needed. Stage 1 established 40 passing cases. Later suites protect the document boundary, transaction/history core, and A5 Line draft migration; see `docs/architecture/stages/`.

There was no package.json, npm script, installed test stack, or existing test suite when Stage 1 began. Node's built-in test runner and VM provide the smallest dependency-free setup for these classic browser scripts. No production source files were changed.

## Organization

- `commands/input.test.cjs`: name/alias/prefix launch, trimming/case, Enter/Space/click exactly-once dispatch, Tab completion, printable-key routing and field/modifier guards.
- `commands/line.test.cjs`: transient Line drafts, live preview, one-transaction completion, cancellation, Step Undo, failure retention, and clean restart.
- `viewport/navigation.test.cjs`: real coordinate functions, pan, wheel/drag zoom anchors, navigation termination, resize and DPR through the real Canvas2D renderer.
- `rendering/boundary.test.cjs`: scene ordering, buffer isolation, renderer exception, early fallback, and known late-fallback defect.
- `rendering/read-side.test.cjs`: authoritative document projection, Undo/Redo and external publication rendering, immutable deterministic enumeration, unsupported records, and the shared backend scene contract.
- `helpers/browser.cjs`: isolated browser/event/canvas stubs and deterministic animation-frame flushing.

The harness executes production files in a fresh VM for each test. It reads existing lexical state for assertions instead of adding test-only production exports. Mathematical tests call the actual production functions, not reimplemented formulas.

## Confirmed bindings and observations

- Space + left drag and middle drag pan.
- Ctrl with either supported navigation drag selects horizontal drag zoom; the suite exercises Ctrl-middle.
- Wheel zoom anchors at the cursor; drag zoom anchors at drag start.
- Rubber-band preview is removed on pointer leave; accepted draft segments remain in the transient overlay until finish or cancellation.
- Enter used to launch a suggestion is not also consumed as Line completion.
- Enter publishes a complete Line draft once; Escape discards the uncommitted draft without document publication.

## Known defect: WebGPU recovery

The viewport calls the renderer factory again using the same canvas after device loss. If WebGPU was already acquired and recovery subsequently falls back, Canvas2DRenderer accepts a null 2D context and rendering throws. The factory also catches failures occurring after WebGPU context acquisition, so the risk is not limited to device-loss recovery.

Two focused tests establish the path: the viewport retries with the same canvas, and the factory returns an unusable fallback under a context-exclusive canvas stub. The known-defect test **passes by demonstrating the defect**, not by proving recovery works. Replace its expectation when recovery is intentionally fixed. This is not a hardware/browser device-loss test.

Rendering exceptions currently propagate out of the scheduled frame. Tests show that a thrown render does not change existing model geometry; they do not claim automatic recovery or UI error containment.

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
