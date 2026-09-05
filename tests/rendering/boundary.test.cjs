const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser, settle } = require('../helpers/browser.cjs');

test('viewport submits ordered scene groups; scene buffers cannot modify model', async () => {
  const b = await browser(); b.launch(); b.point(400, 300); b.point(450, 250); b.point(500, 200, 'pointermove'); b.flush();
  const scene = b.renders.at(-1); const lines = b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))');
  assert.deepEqual(Array.from(scene.lineGroups, g => g.color), [
    'rgba(167, 175, 187, 0.28)', 'rgba(167, 175, 187, 0.55)', '#984b51', '#3b7658', '#e8edf4', 'rgba(232, 237, 244, 0.65)',
  ]);
  assert.equal(scene.lineGroups[4].segments.length, 4); assert.equal(scene.lineGroups[5].segments.length, 4);
  scene.lineGroups[4].segments.fill(999); scene.lineGroups[5].segments.fill(999);
  assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'), lines);
  b.run('requestRender()'); b.flush();
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[4].segments), [400, 300, 450, 250]);
});
test('render exception is currently uncaught but does not mutate geometry', async () => {
  const b = await browser(); b.launch(); b.point(400, 300); b.point(450, 250);
  const lines = b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))');
  b.fakeRenderer.render = () => { throw new Error('simulated device failure'); };
  assert.throws(() => b.flush(), /simulated device failure/);
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
test('KNOWN DEFECT: recovery after WebGPU context acquisition selects unusable 2D context', async () => {
  const b = await browser({ realRenderer: true });
  // Fresh locked canvas models native getContext exclusivity, without hardware.
  let type;
  const locked = { clientWidth: 800, clientHeight: 600, getContext(next) {
    if (type && type !== next) return null;
    type = next; return {};
  } };
  b.context.navigator.gpu = { requestAdapter: async () => ({ requestDevice: async () => ({}) }), getPreferredCanvasFormat: () => 'bgra8unorm' };
  b.window.CaderactWebGPURenderer = class { resize() {} };
  const first = await b.window.createCaderactRenderer(locked);
  assert.ok(first); assert.equal(type, 'webgpu');
  b.context.navigator.gpu.requestAdapter = async () => null;
  const recovered = await b.window.createCaderactRenderer(locked);
  assert.equal(recovered.context, null);
  assert.throws(() => recovered.render({ deviceScale: 1 }), /setTransform/);
});
test('viewport device-loss handler retries factory on same canvas', async () => {
  const b = await browser(); const seen = [];
  b.window.createCaderactRenderer = async canvas => { seen.push(canvas); return b.fakeRenderer; };
  b.fakeRenderer.onDeviceLost(); await settle();
  assert.deepEqual(seen, [b.canvas]);
});
