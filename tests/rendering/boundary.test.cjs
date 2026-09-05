const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser, settle } = require('../helpers/browser.cjs');

test('viewport submits ordered scene groups; scene buffers cannot modify model', async () => {
  const b = await browser(); b.launch(); b.point(400, 300); b.point(450, 250); b.point(500, 200, 'pointermove'); b.flush();
  const scene = b.renders.at(-1); const lines = b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))');
  assert.deepEqual(Array.from(scene.lineGroups, g => g.color), [
    'rgba(167, 175, 187, 0.28)', 'rgba(167, 175, 187, 0.45)', '#984b51', '#3b7658', '#e8edf4', 'rgba(232, 237, 244, 0.65)',
  ]);
  assert.equal(scene.lineGroups[4].segments.length, 0); assert.equal(scene.lineGroups[5].segments.length, 8);
  scene.lineGroups[4].segments.fill(999); scene.lineGroups[5].segments.fill(999);
  assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'), lines);
  b.run('requestRender()'); b.flush();
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[5].segments), [400, 300, 450, 250, 450, 250, 500, 200]);
});
test('render exception starts controlled recovery without mutating geometry', async () => {
  const b = await browser(); b.launch(); b.point(400, 300); b.point(450, 250);
  const lines = b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))');
  const replacementRenderer = { render() {}, resize() {} };
  b.window.createCaderactRenderer = async () => replacementRenderer;
  b.fakeRenderer.render = () => { throw new Error('simulated device failure'); };
  b.flush(); await settle();
  assert.equal(b.run('window.caderactViewport.getRendererState().status'), 'ready');
  assert.equal(b.run('window.caderactViewport.getRendererState().canvasReplacements'), 1);
  assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'), lines);
});
for (const mode of ['missing GPU', 'no adapter', 'device rejection']) test(`Canvas2D fallback before context acquisition: ${mode}`, async () => {
  const gpu = mode === 'missing GPU' ? undefined : {
    requestAdapter: async () => mode === 'no adapter' ? null : { requestDevice: async () => { throw new Error('unavailable'); } },
  };
  const b = await browser({ realRenderer: true, gpu }); b.flush();
  assert.equal(b.run('renderer instanceof window.CaderactCanvas2DRenderer'), true);
  assert.ok(b.drawCalls.length > 0); assert.equal(b.canvas.width, 800);
});
test('normal factory creation prefers WebGPU when it initializes successfully', async () => {
  const b = await browser({ realRenderer: true });
  let type;
  const locked = { clientWidth: 800, clientHeight: 600, getContext(next) {
    if (type && type !== next) return null;
    type = next; return {};
  } };
  b.context.navigator.gpu = { requestAdapter: async () => ({ requestDevice: async () => ({}) }), getPreferredCanvasFormat: () => 'bgra8unorm' };
  b.window.CaderactWebGPURenderer = class { constructor() { this.kind = 'webgpu'; } resize() {} };
  const first = await b.window.createCaderactRenderer(locked);
  assert.equal(first.kind, 'webgpu'); assert.equal(type, 'webgpu');
});

test('initialization failure after WebGPU context acquisition replaces the canvas for Canvas2D', async () => {
  const b = await browser({ realRenderer: true });
  let type;
  const locked = { clientWidth: 800, clientHeight: 600, getContext(next) {
    if (type && type !== next) return null;
    type = next; return {};
  } };
  const calls = [];
  const context2d = Object.fromEntries(['setTransform', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke'].map(name => [name, () => calls.push(name)]));
  const fresh = { clientWidth: 800, clientHeight: 600, getContext: next => next === '2d' ? context2d : null };
  b.context.navigator.gpu = { requestAdapter: async () => ({ requestDevice: async () => ({}) }), getPreferredCanvasFormat: () => 'bgra8unorm' };
  b.window.CaderactWebGPURenderer = class { constructor() { throw new Error('initialization failed after context acquisition'); } };
  const recovered = await b.window.createCaderactRenderer(locked, { replaceCanvasForFallback: canvas => {
    assert.equal(canvas, locked); return fresh;
  } });
  recovered.render({ deviceScale: 1, backgroundColor: '#000', width: 10, height: 10, lineGroups: [] });
  assert.equal(recovered.context, context2d);
  assert.ok(calls.includes('setTransform'));
});

test('viewport device loss replaces the canvas once and requests Canvas2D recovery', async () => {
  const b = await browser(); const original = b.canvas, seen = [];
  const recovered = { render: scene => b.renders.push(scene), resize() {} };
  b.window.createCaderactRenderer = async (canvas, options) => { seen.push({ canvas, options }); return recovered; };
  b.fakeRenderer.onDeviceLost(); await settle(); b.flush();
  assert.equal(seen.length, 1);
  assert.notEqual(seen[0].canvas, original);
  assert.equal(seen[0].canvas, b.canvas);
  assert.equal(seen[0].options.preferCanvas2D, true);
  assert.equal(b.run('window.caderactViewport.getRendererState().canvasReplacements'), 1);
  assert.ok(b.renders.length > 0);
});

test('replacement preserves camera and draft while navigation binds exactly once', async () => {
  const b = await browser(); b.launch(); b.point(400, 300); b.point(450, 250); b.point(500, 200, 'pointermove');
  b.point(200, 150, 'wheel', { deltaY: -20 });
  const before = b.read('({camera:{...camera},document:modelReader.snapshot(),history:documentController.historyInfo,draft:window.caderactCommandRouter.activeSession.draft.draftSegments(),preview:window.caderactCommandRouter.activeSession.draft.preview()})');
  const recovered = { render: scene => b.renders.push(scene), resize() {} };
  b.window.createCaderactRenderer = async () => recovered;
  b.fakeRenderer.onDeviceLost(); await settle();
  const after = b.read('({camera:{...camera},document:modelReader.snapshot(),history:documentController.historyInfo,draft:window.caderactCommandRouter.activeSession.draft.draftSegments(),preview:window.caderactCommandRouter.activeSession.draft.preview()})');
  assert.deepEqual(after, before);
  const panBefore = b.read('camera.panX');
  b.point(100, 100, 'pointerdown', { button: 1 }); b.point(110, 100, 'pointermove', { button: 1 }); b.point(110, 100, 'pointerup', { button: 1 });
  assert.equal(b.read('camera.panX'), panBefore + 10);
});

test('repeated recovery replaces rather than accumulates canvases and ignores stale renderer loss', async () => {
  const b = await browser(); const renderers = [];
  b.window.createCaderactRenderer = async () => {
    const next = { render() {}, resize() {} }; renderers.push(next); return next;
  };
  const originalRenderer = b.fakeRenderer;
  originalRenderer.onDeviceLost(); await settle();
  renderers[0].onDeviceLost(); await settle();
  originalRenderer.onDeviceLost(); await settle();
  assert.equal(b.run('window.caderactViewport.getRendererState().canvasReplacements'), 2);
  assert.equal(b.document.querySelector('canvas'), b.canvas);
  assert.equal(renderers.length, 2);
});

test('Canvas2D creation failure produces a controlled failed viewport state', async () => {
  const b = await browser();
  b.window.createCaderactRenderer = async () => { throw new Error('Canvas2D canvas context unavailable'); };
  b.fakeRenderer.onDeviceLost(); await settle();
  assert.deepEqual(b.read('window.caderactViewport.getRendererState()'), {
    status: 'failed', error: 'Canvas2D canvas context unavailable', canvasReplacements: 1,
  });
  assert.equal(b.run('renderer'), null);
});

test('Canvas2D runtime failure is terminal and cannot restart recovery', async () => {
  const b = await browser();
  b.launch(); b.point(400, 300); b.point(450, 250); b.point(500, 200, 'pointermove');
  b.point(200, 150, 'wheel', { deltaY: -20 }); b.flush();
  const before = b.read('({camera:{...camera},document:modelReader.snapshot(),history:documentController.historyInfo,draft:window.caderactCommandRouter.activeSession.draft.draftSegments(),preview:window.caderactCommandRouter.activeSession.draft.preview()})');
  let renderCalls = 0, destroyCalls = 0, factoryCalls = 0;
  const fallback = {
    kind: 'canvas2d', resize() {},
    render() { renderCalls += 1; throw new Error('persistent Canvas2D render failure'); },
    destroy() { destroyCalls += 1; },
  };
  b.window.createCaderactRenderer = async () => { factoryCalls += 1; return fallback; };

  b.fakeRenderer.onDeviceLost(); await settle();
  assert.equal(b.run('window.caderactViewport.getRendererState().status'), 'fallback-active');
  assert.equal(b.run('window.caderactViewport.getRendererState().canvasReplacements'), 1);
  assert.equal(b.flushOne(), true);

  assert.deepEqual(b.read('window.caderactViewport.getRendererState()'), {
    status: 'failed', error: 'persistent Canvas2D render failure', canvasReplacements: 1,
  });
  assert.equal(factoryCalls, 1); assert.equal(renderCalls, 1); assert.equal(destroyCalls, 1);
  assert.deepEqual(b.observerStats, { observeCount: 2, disconnectCount: 1 });
  assert.equal(b.canvas.listeners.pointerdown.length, 2);
  assert.equal(b.canvas.listeners.pointermove.length, 2);

  b.run('requestRender()'); fallback.onDeviceLost(); await settle();
  assert.equal(b.flushOne(), false);
  assert.equal(factoryCalls, 1); assert.equal(renderCalls, 1); assert.equal(destroyCalls, 1);
  assert.equal(b.run('window.caderactViewport.getRendererState().canvasReplacements'), 1);
  assert.deepEqual(b.read('({camera:{...camera},document:modelReader.snapshot(),history:documentController.historyInfo,draft:window.caderactCommandRouter.activeSession.draft.draftSegments(),preview:window.caderactCommandRouter.activeSession.draft.preview()})'), before);
});
