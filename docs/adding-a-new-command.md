# How to Add a New Command to Cadence

This is a practical, copy-paste-able guide for adding a new drawing/editing command
(like `Line`, `Rectangle`, `Circle`, `Move`, etc.) to Cadence, following the exact
pattern the codebase already uses. It's based on reading `RectangleDraftSession.js`,
`LineDraftSession.js`, `Viewport.js`, `CommandRegistry.js`, and `CommandRouter.js`
directly from the repo.

No build step is involved — Cadence loads plain `<script>` tags in `index.html`,
and each file attaches one namespaced object to `window`.

---

## 1. The three-layer architecture

Every command is split into three layers. Keep them separate — this is the whole
reason the codebase stays clean as commands are added.

| Layer | File | Responsibility |
|---|---|---|
| **Draft session** | `src/js/editor/<Name>DraftSession.js` | Pure state machine: accepts points/input, computes preview geometry, decides when to commit. No DOM, no rendering, no viewport knowledge. |
| **Command session** | inside `src/js/viewport/Viewport.js` (`create<Name>CommandSession`) | Wraps the draft session with prompts, snapping, render requests, and translates draft outcomes into the router's outcome vocabulary (`command-completed`, `invalid-input`, etc). |
| **Registration** | `src/js/editor/command-input.js` | One entry in the `commandRegistry` array: name, aliases, `activate()`. |

Data flows: `command-input.js` → `CommandRouter` → your command session (in `Viewport.js`) → your draft session → `recordGateway` (persists) → `requestRender()` (redraws).

---

## 2. Step-by-step

### Step 1 — Design the interaction on paper first

Before writing code, decide:
- How many points/inputs does it need? (Line = 2+ points, Rectangle = 2 points, Circle = center + radius point)
- What does the preview look like while dragging?
- What geometry does it commit on completion — new `Line` records, or something else?
- Any degenerate cases to reject (zero-length, zero-area, etc.)?
- Any options (like Rectangle has none, Line has "Close")?

Look at `docs/architecture/stages/D4-rectangle.md` for a real example of this design writeup — copy that style for your own command if you want a paper trail.

### Step 2 — Create the draft session file

Create `src/js/editor/<Name>DraftSession.js`. This is a self-contained IIFE that exposes
`window.Caderact<Name>DraftSession`.

Minimal two-point-shape template (based on `RectangleDraftSession.js`):

```javascript
// <Name>DraftSession: command-local draft. Describe what it produces and when it commits.
(() => {
  function copyPoint(point) { return Object.freeze({ x: point.x, y: point.y }) }

  // Pure function: given the accepted points so far, derive preview geometry.
  // Return an empty array/null for "not enough points yet" or "degenerate".
  function derivePreview(first, second) {
    if (!first || !second || first.x === second.x && first.y === second.y) return Object.freeze([])
    // ... compute segments/points/whatever your shape needs
    return Object.freeze([ Object.freeze({ start: copyPoint(first), end: copyPoint(second) }) ])
  }

  function createSession({ createSegment, commitSegments }) {
    let firstPoint = null
    let pointerPoint = null

    function clear() { firstPoint = null; pointerPoint = null }
    function updatePointer(point) { if (firstPoint !== null) pointerPoint = copyPoint(point) }
    function clearPointer() { pointerPoint = null }
    function previewEdges() { return derivePreview(firstPoint, pointerPoint) }
    function acceptedPoints() { return Object.freeze(firstPoint ? [copyPoint(firstPoint)] : []) }

    function acceptPoint(point) {
      const accepted = copyPoint(point)
      if (firstPoint === null) {
        firstPoint = accepted
        pointerPoint = accepted
        return Object.freeze({ status: "first-point" })
      }
      const edges = derivePreview(firstPoint, accepted)
      pointerPoint = accepted
      if (edges.length === 0) return Object.freeze({ status: "degenerate-shape" })

      const records = edges.map(edge => createSegment(edge.start, edge.end))
      const outcome = commitSegments(records)
      if (outcome.status === "committed") clear()
      return outcome.status === "committed"
        ? Object.freeze({ status: "shape-committed", recordIds: Object.freeze(records.map(r => r.id)) })
        : outcome
    }

    function finish() { clear(); return Object.freeze({ status: "no-op" }) }
    function cancel() { clear(); return Object.freeze({ status: "cancelled" }) }

    return Object.freeze({
      acceptPoint, updatePointer, clearPointer, previewEdges, acceptedPoints, finish, cancel,
      get hasFirstPoint() { return firstPoint !== null },
      get firstPoint() { return firstPoint },
      get pointerPoint() { return pointerPoint },
    })
  }

  window.Caderact<Name>DraftSession = Object.freeze({ createSession, derivePreview })
})()
```

**Rules for this layer** (taken directly from how existing sessions are written):
- Everything returned to the outside is `Object.freeze`-d — points, arrays, outcome objects. No mutation leaks out.
- Outcome objects always have a `status` string the command session layer will switch on (`"first-point"`, `"degenerate-shape"`, `"shape-committed"`, etc). Name them uniquely to your command so logs/debugging are unambiguous.
- The draft session never touches `window.caderactViewport`, DOM, or rendering. It only knows about points and the two callbacks it's given (`createSegment`, `commitSegments`) — this is what makes it testable in isolation (see `tests/`).
- If your command commits something other than Lines (e.g. a native record type like Polyline), swap `createSegment`/`commitSegments` for whatever gateway methods you need — see `recordGateway` usage in `document/DocumentController.js`.

### Step 3 — Add the command session in `Viewport.js`

In `src/js/viewport/Viewport.js`, add a `create<Name>CommandSession({ setPrompt })` function, alongside `createLineCommandSession` / `createRectangleCommandSession`. This is the contract `CommandRouter` requires — it validates a session has `.name`, `.finish()`, and `.cancel()` at minimum (see `CommandRouter.js` `activate()`).

```javascript
function create<Name>CommandSession({ setPrompt = () => {} } = {}) {
  const draft = window.Caderact<Name>DraftSession.createSession({
    createSegment: recordGateway.createLine,
    commitSegments: recordGateway.createAll,
  })
  let promptPresentation = createCommandPrompt("<Name>", "Specify first point")
  function updatePrompt(instruction) {
    promptPresentation = createCommandPrompt("<Name>", instruction)
    setPrompt(promptPresentation.text, promptPresentation)
  }

  function presentOutcome(outcome) {
    requestRender()
    if (outcome.status === "first-point") {
      updatePrompt("Specify next point")
      return Object.freeze({ status: "input-accepted", command: "<Name>", kind: "point", outcome })
    }
    if (outcome.status === "shape-committed") {
      clearSnap()
      return Object.freeze({ status: "command-completed", command: "<Name>", outcome })
    }
    if (outcome.status === "degenerate-shape") {
      updatePrompt("Second point must differ from the first")
      return Object.freeze({ status: "invalid-input", reason: "degenerate-shape", command: "<Name>",
        message: "<Name> requires a non-degenerate shape", outcome })
    }
    updatePrompt("Unable to commit; draft preserved")
    return Object.freeze({ status: "invalid-input", reason: "commit-failed", command: "<Name>", outcome })
  }

  function handlePointerDown(point) { return presentOutcome(draft.acceptPoint(point)) }
  function handlePointerMove(point) { draft.updatePointer(point); requestRender() }
  function handlePointerLeave() { draft.clearPointer(); clearSnap(); requestRender() }

  function handleInput(input) {
    clearSnap()
    const parsed = window.CaderactPointInput.parseAndResolve(input, {
      currentUnit: modelReader.units().length,
      anchor: draft.firstPoint,
    })
    if (parsed.status !== "point-resolved") {
      const messages = {
        "invalid-coordinate": "Enter a point as x,y",
        "invalid-number": "Coordinate values must be finite numbers",
        "unsupported-unit": `Unsupported unit${parsed.unit ? `: ${parsed.unit}` : ""}`,
        "relative-point-without-anchor": "Relative point requires a previous point",
      }
      return Object.freeze({ status: "invalid-input", reason: parsed.reason, command: "<Name>",
        message: messages[parsed.reason] || "Invalid coordinate" })
    }
    return presentOutcome(draft.acceptPoint(Object.freeze({ x: parsed.x, y: parsed.y })))
  }

  function finish() {
    clearSnap(); draft.finish(); requestRender()
    return Object.freeze({ status: "command-completed", command: "<Name>" })
  }
  function cancel() {
    clearSnap(); draft.cancel(); requestRender()
    return Object.freeze({ status: "command-cancelled", command: "<Name>" })
  }
  function getSnapCandidates() {
    return draft.acceptedPoints().map((point, index) => Object.freeze({
      kind: "draft-point", point, stableKey: `<name-lowercase>-draft:${index}`,
      reference: Object.freeze({ kind: "draft-point", index }),
    }))
  }

  requestRender()
  return Object.freeze({
    name: "<Name>", draft, finish, cancel,
    handlePointerDown, handlePointerMove, handlePointerLeave, handleInput,
    getPreviewLines: draft.previewEdges, getDraftPoints: draft.acceptedPoints, getSnapCandidates,
    hasPointerPreview: () => draft.hasFirstPoint,
    get prompt() { return promptPresentation.text }, get promptPresentation() { return promptPresentation },
  })
}
```

Then add it to the export line near the bottom of `Viewport.js`:

```javascript
window.caderactViewport = { ..., create<Name>CommandSession }
```

**Notes:**
- `name` in the returned object must exactly match the command's registered `name` in Step 5 (`CommandRouter.activate` checks `session.name !== definition.name`).
- If your preview is just line segments, expose them as `getPreviewLines` — the scene builder (`ViewportScene.js`) already wires a generic `getPreviewLines()` hook into rendering, so you get preview drawing for free (see line ~78 of `Viewport.js`'s `sceneBuilder` setup).
- If your command needs a *non-line* preview (a circle, an arc, a filled region, a ghost of moved objects — like `Circle`, `Arc`, `Move` do), you'll need to add a new getter (e.g. `getCirclePreview`) to both your session and to the `sceneBuilder` config object, then teach the renderer(s) (`Canvas2DRenderer.js`, `WebGPURenderer.js`) to draw it. Copy how `getCirclePreview` is wired for a working example.
- `handleOption` is optional — only implement it if your command has options like Line's `Close`.

### Step 4 — Load the new file in `index.html`

Add a `<script>` tag for your new draft session file, near the other `*DraftSession.js` entries and **before** `Viewport.js` (which references `window.Caderact<Name>DraftSession` at load time):

```html
<script src="./src/js/editor/<Name>DraftSession.js" defer></script>
```

Order matters for anything `Viewport.js` reads eagerly, but since everything is `defer`red and `Viewport.js` is loaded after all the draft sessions, just keep your new script above the `Viewport.js` line and you're safe.

### Step 5 — Register the command

In `src/js/editor/command-input.js`, add one entry to the `commandRegistry` array (kept alphabetically sorted by name in the file, though the registry itself re-sorts internally so this is just for readability):

```javascript
{ name: "<Name>", aliases: ["<Alias>"], repeatable: true, activate: context => window.caderactViewport.create<Name>CommandSession(context) },
```

Field meanings (from `CommandRegistry.js`):
- `name` — required, must be unique (case/hyphen/underscore-insensitive against all other names+aliases).
- `aliases` — array of short forms users can type instead (e.g. `Rectangle` → `Rect`).
- `priority` — optional number, only affects ranking when multiple commands share a prefix match (see `Polyline`'s `priority: 10` to win over `Polygon` for the `P` prefix).
- `repeatable` — set `true` if pressing "repeat last command" (however that's bound in the UI) should be able to re-run this command.
- `activate(context)` — must return your command session object. `context` provides `setPrompt`.

That's it — the command bar's autocomplete, fuzzy search, and execution all come for free once it's in this array.

### Step 6 — Write tests

Check `tests/` for the existing pattern (there's very likely a `RectangleDraftSession.test.js` or similar — mirror its structure) and add a `<Name>DraftSession.test.js` that exercises:
- first point acquisition
- preview geometry at various pointer positions
- degenerate rejection
- successful commit → correct records produced
- cancel/finish mid-draft

Keep these tests hitting only the draft session (Step 2), not the Viewport wiring — that's the whole point of separating the layers.

### Step 7 — Document it (optional but expected for finished commands)

Copy `docs/user/commands/_template.md` to `docs/user/commands/<name>.md` and fill it in — but only once the command is implemented, tested, and stable (the template file says as much at the top). For your own design notes while building it, follow the style of `docs/architecture/stages/D4-rectangle.md`.

---

## 3. Quick checklist for a new two-point/line-based command

- [ ] `src/js/editor/<Name>DraftSession.js` created, exposes `window.Caderact<Name>DraftSession`
- [ ] `create<Name>CommandSession` added to `Viewport.js`, exported in `window.caderactViewport`
- [ ] `<script>` tag added to `index.html`, before `Viewport.js`
- [ ] Entry added to `commandRegistry` in `command-input.js`
- [ ] Preview wired (either free via `getPreviewLines`, or new hook added to `sceneBuilder` + renderers)
- [ ] Degenerate case(s) handled and rejected with a clear prompt message
- [ ] Tests added under `tests/`
- [ ] (Once stable) user doc page added under `docs/user/commands/`

## 4. If your command isn't point-based

Not every command drags out points — `Delete`, for example, acts on the current selection immediately. Look at `createDeleteCommandSession` in `Viewport.js` for the minimal shape a command session can take (no draft session at all, just `finish`/`cancel`/`name`). Use that as your starting point instead of the draft-session pattern if your command doesn't need a multi-step interaction.
