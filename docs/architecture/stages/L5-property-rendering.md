# L5 — Property Rendering

## Resolution boundary

`ViewportScene` resolves every visible committed record through the L4 `CaderactObjectProperties` authority and emits immutable style batches. Renderers receive only resolved `color`, semantic `linetype`, document `lineweight`, mapped `lineWidth`, dash pattern, and projected primitives. Neither renderer reads document records, layers, nor nullable ByLayer fields.

Object overrides win; `null` resolves dynamically from the owning layer. Hidden records are removed by the document read-side before resolution. Visible locked records retain their normal effective appearance.

## Renderer-neutral mappings

Strict `#RRGGBB` colors are converted once by scene generation to normalized RGBA. Linetypes use CSS-pixel patterns: continuous `[]`, dashed `[8,4]`, dotted `[1,3]`, and dash-dot `[8,3,1,3]`. Patterns therefore remain visually stable through model zoom.

Lineweights retain their millimetre-style document meaning. Viewport display width is `clamp(0.75, lineweight / 0.25, 4)` CSS pixels. This is deliberately a legibility mapping, not print/plot scaling.

## Renderer behavior

Canvas2D applies each batch's resolved color, dash pattern, and width and resets dash and width state after drawing. WebGPU uses the same style data and the shared CPU stroke utility to subdivide dash runs and expand widths into stable parallel screen-space strokes before its existing line-list upload. Curve tessellation remains shared and bounded.

Identical styles are batched together. The legacy default committed group remains intact for compatibility, while non-default committed and property-aware preview batches are inserted at the same draw-order layer before selection feedback.

## Selection and previews

Selection remains a separate high-contrast overlay and never mutates object properties. Source ghosts retain the established subdued feedback color. Move, Copy, Rotate, Scale, Mirror, Offset, Trim, and Extend result previews carry effective source appearance through renderer-neutral property preview batches. Existing generic preview overlays remain available to interaction tests and fallback consumers. New primitive rubber bands retain the established preview color; their committed result resolves from the current layer immediately after publication.

## Live updates and persistence

Scenes resolve styles from the authoritative document on every rebuild, so property edits, layer edits, Undo, Redo, New/Open, and renderer recovery cannot retain stale style caches. Persistence stays at v1 and adds no L5 fields.

## L6 surface

The right-sidebar Properties tab described in [L6-properties-panel.md](./L6-properties-panel.md) edits these same L4 values and relies on this renderer-neutral resolution path for immediate visual updates.

## Deferred

L6 owns the Properties panel and context action. Custom linetypes, transparency, fills/materials, plot styles, print scaling, locked-object fading, and per-viewport overrides remain deferred.
