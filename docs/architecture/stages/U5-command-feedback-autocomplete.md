# U5 — Command Feedback + Advanced Autocomplete

## Presentation boundary

`CommandFeedback` owns transient presentation only: the displayed prompt, temporary feedback timer, and at most three recent HUD entries. It owns no document data, command lifecycle, or A4/U2 history. `CommandRouter` remains authoritative and publishes outcomes to the presentation controller.

## Prompt and temporary feedback

The router/session supplies the active prompt through its existing `setPrompt` callback. The UI therefore contains no Line-specific prompt transitions. Temporary results replace only the displayed text, never the stored active prompt or active session. Errors use the red command-input state for 2 seconds, then the latest router prompt is restored. A newer temporary result replaces the previous timer.

Structured command, Undo/Redo, and file outcomes are mapped to concise status/history text where already available. This is a command-area presentation, not a general toast system.

## Recent command HUD

The HUD shows at most three entries, ordered oldest above and newest nearest the active prompt. Entries expire after 4 seconds using independent timers. HUD content is neither persisted nor used for Undo/Redo.

## Ranked autocomplete

`CommandRegistry.search` evaluates the registry's immutable definitions and ranks matches in this order:

1. exact canonical name
2. exact alias
3. canonical prefix
4. alias prefix
5. canonical substring
6. alias substring
7. ordered subsequence

Within a category it prefers earlier starts, fewer subsequence gaps, shorter candidates, then canonical command name as the deterministic final tie-breaker. True nonmatches are excluded and only eight results are returned by the production UI.

Every result contains the matched field, candidate, category, start, gap count, and immutable character indices. The DOM renders characters with element/text APIs; canonical matches emphasize indices in the command name, while alias matches display and emphasize the alias beside the canonical name. No unsafe HTML interpolation or independent DOM rematching is used.

## Execution safety and keyboard behavior

Ranked/fuzzy search is discovery-only. `CommandRouter.execute` still uses exact name/alias and unambiguous prefix matching from the original U1 contract. Raw fuzzy text therefore returns unknown-command. A fuzzy suggestion runs only after click or explicit Arrow navigation followed by Enter. Tab completes the canonical spelling. Space retains raw U1 activation behavior, and active commands cannot be replaced. U2 and U3 modifier shortcuts remain outside this path.

## Deferred

New commands, editable aliases, persistent command history, a full command palette, coordinate/numeric input, dynamic input, snapping, selection, and toolbar redesign remain deferred.
