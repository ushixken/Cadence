const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');
function near(a, b) { assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} != ${b}`); }
test('actual coordinate functions round trip representative cameras and points', async () => {
  const b = await browser();
  for (const zoom of [0.01, 5, 1000]) for (const [x, y] of [[0, 0], [-123.5, 42.25], [1e6, -1e6]]) {
    b.run(`camera.zoom=${zoom}; camera.panX=213; camera.panY=-74`);
    const p = b.read(`screenToWorld(worldToScreen(${x},${y}).x,worldToScreen(${x},${y}).y)`);
    near(p.x, x); near(p.y, y);
  }
});
for (const middle of [false, true]) test(`${middle ? 'middle' : 'Space-left'} drag pans without drawing or changing geometry`, async () => {
  const b = await browser(); b.launch(); b.point(400, 300); b.point(450, 300);
  const lines = b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'); const before = b.read('worldToScreen(10,20)');
  if (!middle) { b.emit(b.canvas, 'pointerenter'); b.key(' '); }
  b.point(200, 200, 'pointerdown', { button: middle ? 1 : 0 });
  b.point(230, 180, 'pointermove');
  const after = b.read('worldToScreen(10,20)');
  near(after.x - before.x, 30); near(after.y - before.y, -20);
  assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'), lines);
  b.point(230, 180, 'pointerup'); assert.equal(b.read('navigation.getMode()'), null);
});
test('wheel zoom preserves cursor world anchor and model', async () => {
  const b = await browser(); b.launch(); b.point(400, 300); b.point(450, 300);
  const lines = b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'); const anchor = b.read('screenToWorld(173,219)');
  b.point(173, 219, 'wheel', { deltaY: -200 });
  const after = b.read('screenToWorld(173,219)'); near(after.x, anchor.x); near(after.y, anchor.y);
  near(b.read('camera.zoom'), 5 * Math.exp(0.3)); assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'), lines);
});
test('Ctrl-middle drag zoom is horizontal and anchored at drag start', async () => {
  const b = await browser(); const anchor = b.read('screenToWorld(200,200)');
  b.point(200, 200, 'pointerdown', { button: 1, ctrlKey: true });
  b.point(200, 280, 'pointermove'); assert.equal(b.read('camera.zoom'), 5);
  b.point(250, 280, 'pointermove'); near(b.read('camera.zoom'), 5 * Math.exp(0.5));
  const after = b.read('screenToWorld(200,200)'); near(after.x, anchor.x); near(after.y, anchor.y);
});
test('pointer cancel and blur stop navigation; invalid zoom is ignored', async () => {
  const b = await browser();
  for (const stop of ['pointercancel', 'lostpointercapture']) {
    b.point(100, 100, 'pointerdown', { button: 1 }); b.emit(b.canvas, stop, { pointerId: 1 });
    assert.equal(b.read('navigation.getMode()'), null);
  }
  b.point(100, 100, 'pointerdown', { button: 1 }); b.emit(b.window, 'blur');
  assert.equal(b.read('navigation.getMode()'), null);
  b.run('zoomAtScreenPoint(0,10,10); zoomAtScreenPoint(Infinity,10,10)');
  assert.equal(b.read('camera.zoom'), 5);
});
test('resize centers camera, passes DPR, preserves geometry and coordinate round trip', async () => {
  const b = await browser({ realRenderer: true }); b.launch(); b.point(400, 300); b.point(450, 250);
  const lines = b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))');
  b.resize(1000.5, 700.5, 2); b.flush();
  assert.equal(b.canvas.width, 2001); assert.equal(b.canvas.height, 1401);
  assert.deepEqual(b.read('worldToScreen(0,0)'), { x: 500.25, y: 350.25 });
  assert.deepEqual(b.read('screenToWorld(500.25,350.25)'), { x: 0, y: 0 });
  assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'), lines);
  assert.equal(b.drawCalls[0][1], 2);
});
