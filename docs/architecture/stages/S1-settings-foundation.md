# S1 — Settings Foundation

`CaderactUserPreferences` owns application preferences independently of the CAD document. It stores a versioned `{ version: 1, preferences }` localStorage payload, ignores unknown fields, merges missing fields with defaults, normalizes malformed values, and survives storage failures.

Defaults are grid visible on, Grid Snap off, Ortho off, Polar off, and Polar increment 45°. Preferences are subscription-ready runtime state and are never included in document serialization, revision, dirty state, or history.

Transform defaults also use this authority. `mirrorCopyEnabled` defaults to
true and is written by Mirror's existing Copy command option; it persists with
the user profile and Reset to Defaults restores it without changing drawings.

Grid Snap, Ortho, Polar, and Polar increment are initialized from preferences and written back through the shared viewport setters. Ortho/Polar mutual exclusion is normalized deterministically in both preferences and the drafting authority. New/Open resets document interaction state only and preserves user preferences. Future settings categories can use this same authority.

The existing Settings menu opens a compact accessible Drafting dialog. Its controls subscribe to the same preference and viewport authorities as the footer, apply changes live, close with Escape, focus the close control on open, and return focus to the menu trigger on close. Reset restores and persists S1 defaults without touching document state.

UI ownership: the footer/status bar owns frequent drafting toggles (Grid Snap, Ortho, Polar, and related snap controls). Settings owns deeper customization and defaults; S1 currently exposes Show Grid and Reset while reserving Grid appearance controls for S2.
