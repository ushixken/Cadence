# PERF2B — Camera / scene separation

PERF2B keeps the established logical all-record `ViewportScene.createScene()` contract while adding an idle Model-space render path that separates stable document presentation from camera and editor feedback.

## Scene boundary

The scene is divided as follows:

- **Stable world presentation:** committed geometry, resolved entity/layer appearance, expanded Block presentation, Hatch triangles, and annotation geometry/content. Coordinates use a camera-neutral presentation space whose Y direction already matches the renderer screen convention.
- **Camera-dependent presentation:** the camera transform, adaptive grid and axes, viewport dimensions, and projected annotation positions.
- **Transient editor overlays:** selection, grips, command previews, transform ghosts, and other session-owned feedback.
- **Drafting feedback:** the raw-pointer crosshair, resolved snap marker, Track/Extension/OnParallel guides, and Dynamic Input.
- **Paper Space / Layout:** layout viewport projection, scale, and clipping remain on the established complete screen-scene path because they are intrinsically viewport dependent.

`createRenderScene()` returns the stable `worldGeometry` layer by identity and rebuilds only the camera-dependent screen layer during eligible camera navigation. `createScene()` remains the authoritative complete logical scene for compatibility, tests, Layout, PlotScene/PDF, and consumers that do not opt into the separated renderer contract.

## Renderer contract

Canvas2D applies the supplied camera transform while drawing world presentation, then restores the screen transform for grid and overlays. WebGPU projects the same stable presentation into its existing screen-space vertex stream; semantic circle, arc, and ellipse descriptors are retained until after camera projection so adaptive tessellation remains zoom-correct. Both renderers consume the same `worldGeometry`, `cameraTransform`, and screen-overlay data.

The fast path is deliberately conservative: active commands, active grip edits, or a non-empty selection retain the complete scene path so existing overlay and preview semantics cannot become stale. Idle, unselected Model-space pan and zoom reuse stable world geometry.

## Invalidation

World presentation is invalidated by the existing authoritative boundaries:

- document/history publication, covering geometry, properties, layers, Blocks, Hatch, and annotations;
- document replacement, including New/Open/Recovery;
- canvas theme/palette changes that affect resolved presentation;
- layer-isolation changes.

Camera pan, zoom, resize, and DPR changes do not invalidate world presentation. Grid-only appearance remains in the camera-dependent layer. Layout rendering stays on the complete scene path, so Layout viewport scale and clipping behavior are unchanged.

## Safety and limitations

The separation does not alter document state, history, dirty state, native persistence, DXF, PlotScene, or PDF. It performs no view culling and preserves the logical all-record scene.

Camera-only renders still traverse and submit visible world primitives in both renderers. WebGPU also rebuilds its projected/uploaded vertex stream. PERF2B removes document presentation reconstruction; persistent GPU buffers, renderer-side retained batches, and safe culling remain possible later optimizations.
