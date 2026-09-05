# A11A — Bounded renderer failure recovery

Status: Completed; ready for review.

## Audit finding

A11 allowed every synchronous renderer exception to enter recovery. After a
WebGPU failure, a Canvas2D fallback could construct successfully, schedule its
first redraw, and throw while rendering. Because the preceding recovery promise
had already completed, that exception could start a new recovery, replace the
canvas again, construct another fallback, and repeat without a finite bound.

## Bounded recovery contract

The renderer lifecycle now distinguishes `initializing`, `ready` (usable
WebGPU or another primary renderer), `recovering`, `fallback-active`, and
`failed`.

- A WebGPU runtime failure may start one automatic Canvas2D recovery.
- Canvas2D construction failure enters `failed`.
- A Canvas2D runtime render failure enters `failed` immediately.
- A fallback failure does not replace the canvas or create another renderer.
- Stale renderer callbacks and callbacks received after terminal failure remain
  unable to restart recovery.

There is no automatic retry from `failed`. Manual retry, reload, and renderer
failure UI are deferred.

## State and lifecycle preservation

Terminal renderer failure clears only the active renderer and disposes that
fallback once. It does not replace or mutate the document, history, revision,
state identity, layers, units, persistence state, references, camera, active
Line draft, accepted draft segments, or preview.

The focused regression test proves one canvas replacement for the WebGPU to
Canvas2D transition, one fallback construction, one failing fallback render,
one fallback disposal, bounded observer/navigation rebinding, no queued redraw,
and no restart through the stale fallback callback.
