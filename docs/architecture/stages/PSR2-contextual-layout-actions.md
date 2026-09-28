# PSR2 — Contextual Layout actions and local feedback

The Model/Layout strip owns one contextual Layout action group. Model Space
removes that complete group from layout and keyboard navigation. A valid active
Layout reveals Create Viewport, viewport Scale and Lock, Plot Preview, and PDF
Export. Scale and Lock remain disabled until a Layout viewport is selected;
plot actions require a valid active Layout. The group scrolls internally at
constrained widths instead of causing page overflow.

`CaderactApplicationFeedback` remains the single transient application-feedback
authority. Notifications may optionally supply an anchor and a placement target.
Anchored notices render in a pointer-transparent viewport layer, align toward
their initiating control, sit above the associated action group, and clamp to
safe viewport margins. They preserve the existing alert/status semantics and do
not move focus.

Active notices use a stable severity, message, and source identity. Repeating an
equivalent action reuses the existing notice and refreshes its dismissal timer;
different messages or sources remain independent. Plot Preview and PDF Export
use distinct stable sources. Model-context PDF invocation remains safely rejected
without switching workspaces or mutating drawing state.
