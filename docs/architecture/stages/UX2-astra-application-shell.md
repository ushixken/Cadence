# UX2 — ASTRA application shell

## Status

Implemented as the production presentation shell. The shell composes existing editor authorities; it does not own CAD state.

## Structure

The desktop workspace is ordered as one consolidated branded application-menu row, a distinct CAD collection-tab row, one active icon-and-label tool row, persistent SVG quick-tools rail, dominant viewport, integrated Layers/Properties panel, dedicated command-history band, Model-only strip, command line, and drafting/status controls. At constrained widths the collection rows scroll or compress and nonessential labels disappear while the viewport, command line, and core drafting controls remain available.

The centered top document title/save presentation is a projection of `DocumentFileState` and `DocumentController`; it is not repeated in the drafting status bar. The far-right utility menu owns no state and delegates Settings to its existing controller. `Ctrl/Cmd+K` focuses the established command input rather than requiring persistent search chrome. The Model strip intentionally exposes no paper-space or layout fiction.

## Authority boundaries

- Tool-strip, quick-rail, and search actions resolve and execute through the existing `CaderactCommandRegistry` and `CaderactCommandRouter`.
- File/Edit/View/Window/Help are application-menu concepts. Draw/Modify/Annotate/Layers/Blocks/Measure/Drafting/Custom are presentation-only CAD collection tabs. Edit delegates Undo/Redo to the existing history controller.
- Category selection, search results, and flyout visibility are runtime UI state only and never enter the document, history, persistence, or recovery systems.
- Units continue through the document unit gateway and existing footer controller.
- Viewport sizing, pointer projection, snapping, tracking, dynamic input, selection, rendering, Layers, and Properties retain their existing owners.
- Command feedback continues to use `CommandFeedback`; the shell projects its existing history element as a non-interactive absolute overlay inside the workspace, offset beyond the quick-tools rail and anchored just above Model without participating in layout.
- The light/neutral UX1 token system remains the UI foundation. Canvas appearance remains independently owned by viewport/user preferences.

## Extension rule

New supported commands may be surfaced by adding their registered canonical name to a category or quick-tool button. Shell code must never instantiate command sessions or duplicate command definitions. Custom workspace persistence, paper space, and layout tabs are deferred.
