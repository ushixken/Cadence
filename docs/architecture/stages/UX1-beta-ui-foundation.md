# UX1 — Beta UI Foundation and Design Tokens

UX1 establishes the reusable visual foundation for the beta editor without changing the application shell or any CAD interaction authority.

## Ownership

`src/css/base.css` is the single authority for semantic UI tokens. Component styles consume those tokens from `menu-bar.css`, `editor-page.css`, and `home-page.css`. Compatibility aliases remain temporarily so later UX stages can migrate components incrementally without coupling visual work to layout changes.

The default application chrome is light and neutral. The viewport remains a deliberate dark technical work surface because the current renderer-neutral scene colors, CAD cursor, geometry, grips, snaps, tracking guides, and previews are designed for that contrast. Theme switching is deferred.

## Token groups

- Typography: system UI and technical monospace stacks, compact size and line-height roles.
- Density: a small spacing scale, desktop control heights, and restrained radii.
- Surfaces: app, chrome, panel, control, popup, selection, overlay, and viewport roles.
- Content: primary, secondary, muted, disabled, borders, and separators.
- Interaction: accent, hover, pressed, disabled, selection, and focus-ring roles.
- Feedback: success, warning, error, and information roles.
- CAD semantics: selection, grips, Osnap, Track, axes, locked/hidden layers, crosshair, and viewport HUD roles.
- Elevation: popup/dialog shadows and named stacking levels.

## Accessibility

The former global focus-outline removal is gone. Keyboard-interactive elements receive a shared high-contrast focus ring. Composite controls such as the command field expose focus through their containing shell. Reduced-motion preferences collapse decorative animation durations without altering interaction behavior.

## Invariants

UX1 does not change DOM order, shell dimensions, responsive breakpoints, command routing, viewport geometry, pointer resolution, rendering state, drafting logic, document/history state, persistence, or file-safety behavior. The raw CAD crosshair and authoritative resolved-point presentation remain separate.

## Deferred

- Application-frame and document-title work belongs to UX2.
- Menu information architecture belongs to UX3.
- Toolbars, status-bar reorganization, settings expansion, theme switching, and workspace persistence remain deferred.
