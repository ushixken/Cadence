# AF1 — Minimum CAD command integration boundary

AF1 retains classic ordered scripts, the existing command router, document store, and renderer-neutral scene. It adds no CAD operation and no build system.

## Dependency direction

New operation geometry belongs in a pure planner: `plan(input)` receives all geometry and tolerances explicitly and returns a proposed result. It must not read `window`, the DOM, the document store, selection, or renderer. A command-local session owns phases, prompts, preview state, and calls the planner. The session receives a small application-services object on activation from `CaderactCadCommandExtensions`: current `reader`, `recordGateway`, `groupGateway`, `selection`, typed-point resolver, render request, snap cleanup, the planner, and the router activation context. These services are resolved at activation, so New/Open do not leave registrations holding an old store.

The session must publish through the existing gateway, check its outcome, and use one transaction for an atomic command. It must not write document/history state from preview, nor implement its own pointer resolution or render mathematics. The existing router owns session lifecycle; `Viewport.resolveCommandPointer` supplies the accepted resolved point. Existing `get*Preview` hooks flow through `ViewportScene` to both renderers. FS0–FS6 file safety remains under the existing document/file authorities.

## Adding a command

1. Add a pure planner file and a command-session file. Declare their script tags after `Viewport.js` and before `command-input.js` in `index.html`, in dependency order. Keep their test-harness load order equivalent.
2. In the session file, call `window.caderactCadCommands.register({ name, aliases, planner, createSession })` once at script evaluation. The planner must expose `plan(input)`. `createSession(services)` returns the existing router session contract (`name`, `finish`, `cancel`, optional input/pointer/preview hooks). Do not add a factory to `Viewport.js` or a second command list to `command-input.js`.
3. Add planner unit tests, command lifecycle and transaction tests, and scene/snap tests where applicable. The AF1 bootstrap-parity test checks the current core production/test sequence; extend its coverage when adding extension scripts. Confirm the command is searchable through the existing registry and its pointer acceptance uses the existing resolved-point path.

The compatibility adapter is [CadCommandExtensions.js](../../../src/js/editor/CadCommandExtensions.js). Legacy `window.Caderact*` APIs remain as they are. This seam is not an ES-module conversion: pure planners may later become native modules behind an adapter, without migrating the legacy application at once.
