# UX1 — CAD Cursor + Interaction Visual System

## Ownership and rendering boundary

`InteractionVisuals` is a renderer-neutral, transient viewport controller. It owns one DOM overlay beneath the viewport host and no document data. The controller is created once for the lifetime of the editor viewport; renderer recovery replaces only the canvas, so it cannot duplicate the cursor overlay.

The overlay is clipped by the existing viewport and has `pointer-events: none`. It is absent from authoritative records, transactions, A4 history, persistence, selection identity, Line drafts, and renderer scene buffers.

## Cursor geometry and coordinate spaces

The crosshair is 32 × 32 CSS pixels with four equal 12.5-pixel arms, a centered 7 × 7 border-box pickbox, and a one-pixel circular center mark. Each arm ends at the pickbox boundary; no crosshair bar is drawn inside the box. The odd pickbox and center-point dimensions use half-pixel origins around the shared `(16, 16)` logical center, while every one-pixel arm also spans equally from `15.5` to `16.5` on its cross axis. This keeps opposite primitives pixel-balanced without changing the authoritative pointer coordinate. CSS dimensions remain fixed across zoom and device-pixel-ratio changes, and no DPR multiplication is applied before browser rasterization.

Cursor events are converted from client coordinates to overlay-host coordinates using `clientX - viewportRect.left` and `clientY - viewportRect.top`. Drawing and snapping retain their separate canvas-local conversion. The overlay's `left` and `top` are the exact raw viewport point, and its single `translate(-50%, -50%)` centers the 32 × 32 geometry there. D2 independently resolves the canvas-local point into world space and owns the snapped Line preview and snap marker. A snap therefore never pulls the cursor away from the physical pointer.

## Interaction states

The controller exposes four bounded visual outcomes:

- idle/select: visible neutral crosshair and pickbox inside the canvas;
- point command: the same stable geometry with a slightly brighter command treatment;
- snap acquired: D2's existing marker remains at the resolved target while the cursor pickbox receives restrained acquisition color;
- outside/unavailable: overlay hidden and normal browser cursor behavior restored.

Navigation temporarily hides the overlay and preserves the existing grab/grabbing cursors. Terminal renderer failure disables the overlay and restores the system crosshair fallback. Reinstalling a usable renderer enables it again.

## Lifecycle safety

Pointer leave clears visibility and snap-acquired presentation. Resize, New, and Open clear stale cursor placement until a fresh pointer event arrives. Canvas replacement binds the current canvas while retaining the one host-owned overlay. No document redraw is requested solely to move the cursor.

## Extensibility boundary

Future interaction visuals should extend the transient controller with explicit state and keep raw-pointer presentation separate from resolved model coordinates. Tool-specific badges, richer selection handles, and tracking visuals must not become persistent geometry or command-owned mutable UI nodes.

Deferred work includes grips, preselection highlighting, aperture sizing UI, crossing/window selection, constraint glyphs, tracking rays, dynamic input, transform handles, 3D cursor systems, and cursor customization settings.
