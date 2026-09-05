# A11 — Scale and recovery

Status: Completed; ready for review.

## Confirmed recovery defect

Before A11, the viewport handled WebGPU device loss by calling
`createCaderactRenderer` again with the same canvas. A browser canvas keeps the
context mode it first acquires: after `getContext("webgpu")` succeeds,
`getContext("2d")` on that canvas can return `null`. The old
`Canvas2DRenderer` constructor accepted that null context, so recovery appeared
to succeed and then failed on the next call such as `setTransform`.

The same failure was possible when WebGPU initialization threw after acquiring
the context but before returning a usable renderer. This was a canvas/context
lifecycle defect, not a document or scene defect.

## Canvas and renderer ownership

`CaderactViewportCanvas` is the narrow owner of render-canvas replacement. It
clones the existing canvas without listeners, preserves its attributes and
backing dimensions, replaces it in the same DOM position, and exposes the one
current canvas plus a diagnostic replacement count. Renderers never manipulate
application DOM.

The viewport owns rebinding. On replacement it disposes the previous navigation
binding and resize observation, binds navigation and Line pointer handling once
to the new canvas, and observes that canvas. The single window resize listener
is not duplicated. Because the replacement is a clone, the canvas tag,
id/class/ARIA attributes, CSS layout role, and CAD cursor styling are retained.
The normal resize path then synchronizes CSS size and DPR backing dimensions.

## Initial creation and late recovery

Normal initialization remains WebGPU-first. Missing GPU support, a missing
adapter, or device-request failure occurs before WebGPU context acquisition and
falls back on the original canvas.

If initialization fails after acquiring a WebGPU context, the renderer factory
requests a fresh canvas from the viewport lifecycle callback before constructing
Canvas2D. `Canvas2DRenderer` now rejects a missing 2D context immediately rather
than creating an unusable renderer.

For device loss or a synchronous render exception, the viewport:

1. ignores notifications from stale renderer instances;
2. clears the active renderer and enters `recovering` state;
3. destroys available WebGPU resources;
4. replaces and rebinds the canvas once;
5. requests Canvas2D explicitly on the fresh canvas;
6. applies current CSS dimensions and DPR; and
7. requests a new scene from the current A6 authoritative read side.

Only one recovery promise may run at a time. Stale renderer notifications do
not append canvases or duplicate bindings. A11A closes the remaining repeated
fallback-render failure gap: a Canvas2D runtime failure now enters the terminal
controlled `failed` state without another replacement or automatic retry.

## Preserved state and failure behavior

Canvas replacement does not recreate the camera, document store, controller,
Line draft, scene builder, persistence state, or reference resolver. Tests prove
that pan, zoom, committed document content, history information, and an active
Line draft/preview remain unchanged through recovery. Navigation on the new
canvas applies each gesture once, and the recovered render receives a scene
built from current authoritative and transient state.

`caderactViewport.getRendererState()` exposes `initializing`, `ready`,
`recovering`, or `failed`, plus a controlled error message and canvas replacement
count. If Canvas2D creation also fails, the viewport retains no stale renderer,
reports `failed`, and does not start an automatic retry loop. A later explicit
recovery policy or UI may build on this state.

## Scale baseline

The A11 scale test publishes 5,000 Line records in one normal transaction, then
checks authoritative stable-ID enumeration, A6 scene projection, one history
entry/revision, and Canvas2D scene consumption. It produces all 20,000 committed
segment coordinates and consumes at least 5,000 Line segments without model
mutation.

The exercised architecture remains full-table validation/publication,
O(N log N) stable-ID sorting, and linear scene projection/render consumption.
No accidental quadratic behavior or correctness failure was observed at this
baseline, so A11 makes no speculative storage or rendering optimization.

This is a practical regression size, not a performance benchmark or production
capacity guarantee. Runtime varies by machine and is intentionally not asserted.

## Deferred performance and recovery systems

Deferred beyond A11: spatial indexes, dirty regions, incremental scene diffs,
GPU geometry caches, chunking, level of detail, workers, WASM, benchmark suites,
automatic retry/backoff UI, renderer status UI, hardware WebGPU fault injection,
and 3D rendering.
