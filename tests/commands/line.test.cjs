const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

test('first point creates no segment; continuous clicks create independent world-space segments', async () => {
  const b = await browser(); b.launch(); b.point(400, 300);
  assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'), []);
  b.point(450, 300);
  assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'), [{ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }]);
  b.point(450, 250); b.point(500, 250);
  assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'), [
    { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
    { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
    { start: { x: 10, y: 10 }, end: { x: 20, y: 10 } },
  ]);
});
test('live preview updates, starts at last accepted point, and never accumulates in geometry', async () => {
  const b = await browser(); b.launch(); b.point(400, 300);
  for (const x of [420, 430, 450]) {
    b.point(x, 250, 'pointermove'); b.flush();
    assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[5].segments), [400, 300, x, 250]);
    assert.equal(b.read('modelReader.lines().length'), 0);
  }
  b.point(450, 250); b.point(500, 200, 'pointermove'); b.flush();
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[4].segments), [400, 300, 450, 250]);
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[5].segments), [450, 250, 500, 200]);
  b.emit(b.canvas, 'pointerleave'); b.flush();
  assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);
  assert.equal(b.read('modelReader.lines().length'), 1);
});
test('Enter accepts session and clears preview; Escape removes only subsequent session', async () => {
  const b = await browser(); b.launch();
  for (const x of [400, 450, 500, 550]) b.point(x, 300);
  b.point(600, 250, 'pointermove'); b.key('Enter'); b.flush();
  const original = b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))');
  assert.equal(original.length, 3); assert.equal(b.read('activeCommand'), null);
  assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);
  b.launch(); for (const x of [100, 150, 200]) b.point(x, 100);
  assert.equal(b.read('modelReader.lines().length'), 5);
  b.key('Escape'); b.flush();
  assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'), original);
  assert.equal(b.read('pendingLineStart'), null);
  assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);
});
for (const key of ['Enter', 'Escape']) for (const firstPoint of [false, true]) {
  test(`${key} with ${firstPoint ? 'first point only' : 'empty session'} leaves no geometry`, async () => {
    const b = await browser(); b.launch();
    if (firstPoint) { b.point(100, 200); b.point(150, 250, 'pointermove'); }
    b.key(key); b.flush();
    assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y } }))'), []);
    assert.equal(b.read('activeCommand'), null);
    assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);
  });
}
