# UX11 — Modal and settings UI hardening

## Shared dialog presentation

`caderact-dialog` is the shared presentation contract for compact application
dialogs. It standardizes theme-token surfaces, borders, elevation, headings,
tabs, body scrolling, controls, action rows, close affordances, and visible
focus treatment without becoming a new dialog or state authority. Preferences,
Drafting Settings, file-safety prompts, Page Setup, PDF Export, and Dimension
Styles use this contract. Plot Preview remains a purpose-built large preview
surface while retaining the same semantic theme tokens.

Dialogs size from their content and are constrained to the viewport. Preferences
uses a fixed header and tab strip with an internally scrolling body. Page Setup
keeps its title and action row reachable while its fields scroll. At narrow
widths, settings rows stack without allowing controls to escape the viewport.

## Preference boundary

Preferences exposes application and workspace state from
`CaderactWorkspacePreferences`. Its Appearance and Workspace resets remain
strictly scoped. The `Reset Drafting Defaults` action is rendered only while
the same dialog is operating as Tools → Drafting Settings and continues to use
`CaderactUserPreferences`; it is hidden and unavailable in Preferences mode.
Neither surface mutates document history, revision, dirty state, native files,
or DXF state.

## Accessibility and keyboard ownership

The existing dialog titles, labels, tab roles, Escape handling, and focus
restoration remain authoritative. Preferences now contains Tab navigation
within the open modal. Shared close controls have accessible names and an
explicit interactive/focus-visible treatment in both UI themes. This preserves
the UX10 rule that the top modal owns keyboard input before background commands.
