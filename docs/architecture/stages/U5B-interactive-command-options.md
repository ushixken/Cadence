# U5B — Interactive Command Options

## Input, prompt, and option ownership

U5B separates three transient concerns. The command input value contains only editable user text. `CommandFeedback` owns presentation of the active prompt in a dedicated `#command-prompt` region. The active command session owns semantic option meaning, value, validation, and activation behavior.

The prompt region is positioned independently above the input, with history above it, so changing prompt text or option controls does not resize the footer. Idle input retains the `Type a command...` placeholder; active prompts and temporary feedback never become input values or placeholders.

## Option descriptor and routing contract

An active session may expose an immutable `options` collection:

```text
{ id, label, value, enabled }
```

It may handle activation through `handleOption(optionId)`. The command router's command-neutral `activateOption` method verifies an active supporting session, routes the semantic ID, and publishes the outcome through the same result lifecycle. Viewport and renderers have no knowledge of controls.

The feedback UI renders descriptors as native inline buttons with an accessible label containing the option name and current value. Mouse click and native keyboard button activation use the same router method. After activation, the command input is cleared and focused so typing can continue without the option retaining unexpected focus.

## Autocomplete Enter behavior

Idle Enter now accepts the current autocomplete result for exact, alias, prefix, and substring matches. With no explicit Arrow selection, index zero is the deterministic active result; therefore `po` launches `Polygon` rather than attempting to execute raw partial text. ArrowUp/ArrowDown and mouse selection keep the same canonical router path.

Fuzzy-only text retains U5's safety rule: it does not implicitly execute until the user explicitly selects a result. Active-command input bypasses autocomplete and routes directly to the current session.

## Polygon NumSides integration

Polygon exposes `NumSides=N` after a valid side count is established, both during center acquisition and radius acquisition. Activating it enters the side-count option phase with N as the current default. Empty Enter retains N; a valid integer from 3 through 1024 updates the draft and returns to the prior point-acquisition phase.

Changing NumSides after center acceptance preserves the immutable center and current transient radius candidate. The preview immediately recomputes with the new N through `PolygonGeometry`; no document, history, revision, dirty, persistence, snapping, or transaction state changes.

Invalid option input remains owned by Polygon, displays its bounded-integer validation feedback, and leaves the option phase active. It is never routed as an idle command and never produces generic invalid-command feedback.

U5B adds no command-option memory. A fresh or U5A-repeated Polygon session starts at the default four-side prompt.

## Future reuse and deferred work

The descriptor and router boundary can later represent command-owned values such as Mode, Radius, or Distance without adding command-specific DOM. U5B does not add Polygon construction modes, popups, property inspection, shortcut customization, command history UI, persistence, or React infrastructure.
