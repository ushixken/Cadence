# C1 — Command preselection

Selection is transient UI state, but command activation receives an immutable
snapshot of its selected record IDs through the CommandRouter activation
context. Commands opt in by interpreting that snapshot as their first
selection role and validating IDs against the authoritative document records;
commands that do not opt in simply ignore it.

Move, Copy, Rotate, Scale, and Mirror map valid preselection to transform
targets. Trim maps it to cutting edges and immediately enters target picking;
Extend maps it to boundary edges. Delete continues to operate on the current
selection. Offset maps exactly one supported preselected source directly to
its side-selection phase using its current transient Distance value. Invalid,
stale, mixed, unsupported, or count-invalid
preselection falls back to the command's ordinary postselection workflow.

Selection IDs—not geometry copies—are retained. Consumption does not mutate
document/history state and Escape preserves the ordinary selection state.
Future commands must opt in explicitly and document their first-role mapping,
validation, and fallback behavior rather than adding command-name routing in
Viewport.
