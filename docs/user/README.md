# docs/user/

This folder holds the **source content for Caderact's user-facing Help
documentation** (the public help website, eventually `help.caderact.com`).

This is distinct from:

- `docs/research/` — exploration, not user-facing
- `docs/architecture/` — implementation stages, ADRs, internal design

## Rule

A page belongs in `docs/user/` only once the behavior it documents has been
**implemented, tested, and accepted**. Do not document planned or in-progress
features here as if they already work.

If a command's underlying architecture is expected to change (e.g. Line prior
to A5 — Line Draft Migration), do not finalize its user documentation until
that work is accepted.

## Structure (H1)

- `index.md` — source for the Help home page (`help/index.html`)
- `commands/_template.md` — reusable structure for future command docs.
  This is documentation **infrastructure**, not a published command page.

Additional sections (Getting Started, Workspace, Commands, Drafting,
Reference, Troubleshooting) will get their own content here as the
corresponding Caderact functionality is accepted. Empty sections are not
pre-created just to look complete.
