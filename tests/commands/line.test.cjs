'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

const persistentState = b => b.read(`({
  objects: modelReader.snapshot().geometry.objects,
  revision: documentController.currentRevision,
  stateId: documentController.currentStateId,
  history: documentController.historyInfo,
  savedStateId: documentController.savedStateId,
  savedRevision: documentController.savedRevision,
  dirty: documentController.isDirty
})`);

test('Line start, first point, and accepted draft segments do not mutate persistent state', async () => {
  const b = await browser();
  b.run('window.__lineBaselineToken = documentController.captureStateToken(); documentController.markStateSaved(window.__lineBaselineToken)');
  const before = persistentState(b);
  assert.equal(before.dirty, false);
  b.launch();
  assert.deepEqual(persistentState(b), before);
  b.point(400, 300);
  assert.deepEqual(persistentState(b), before);
  b.point(450, 300); b.point(450, 250); b.point(500, 250);
  assert.deepEqual(persistentState(b), before);
  assert.equal(b.read('lineDraft.segmentCount'), 3);
  assert.equal(b.read('documentController.hasOpenTransaction'), false);
  assert.equal(b.run('Object.isFrozen(lineDraft.draftSegments())'), true);
  assert.equal(b.run('Object.isFrozen(lineDraft.draftSegments()[0].start)'), true);
});

test('accepted draft segments and rubber-band preview render only in the transient overlay', async () => {
  const b = await browser(); b.launch(); b.point(400, 300);
  for (const x of [420, 430, 450]) {
    b.point(x, 250, 'pointermove'); b.flush();
    assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[5].segments), [400, 300, x, 250]);
    assert.equal(b.read('modelReader.lines().length'), 0);
  }
  b.point(450, 250); b.point(500, 200, 'pointermove'); b.flush();
  assert.equal(b.renders.at(-1).lineGroups[4].segments.length, 0);
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[5].segments), [400, 300, 450, 250, 450, 250, 500, 200]);
  b.emit(b.canvas, 'pointerleave'); b.flush();
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[5].segments), [400, 300, 450, 250]);
  assert.equal(b.read('modelReader.lines().length'), 0);
});

test('Enter publishes a multi-segment Line once and one A4 Undo/Redo restores exact records', async () => {
  const b = await browser();
  b.run('window.__existingLine = recordGateway.createLine({x:-5,y:-6},{x:-7,y:-8}); recordGateway.createAll([window.__existingLine])');
  const beforeStateId = b.read('documentController.currentStateId');
  const historyBefore = b.read('documentController.historyInfo.cursor');
  b.launch();
  for (const point of [[400, 300], [450, 300], [450, 250], [500, 250]]) b.point(...point);
  const draft = b.read('lineDraft.draftSegments()');
  assert.equal(draft.length, 3);
  b.key('Enter'); b.flush();
  assert.deepEqual(b.read('modelReader.lines().slice(1)'), draft);
  assert.equal(b.read('documentController.currentRevision'), 2);
  assert.equal(b.read('documentController.historyInfo.cursor'), historyBefore + 1);
  const committedStateId = b.read('documentController.currentStateId');
  assert.notEqual(committedStateId, beforeStateId);
  assert.equal(b.read('activeCommand'), null);
  assert.equal(b.renders.at(-1).lineGroups[4].segments.length, 16);
  assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);

  assert.equal(b.run('documentController.undo()').status, 'undone');
  assert.deepEqual(b.read('modelReader.lines()'), b.read('[window.__existingLine]'));
  assert.equal(b.read('documentController.currentStateId'), beforeStateId);
  assert.equal(b.run('documentController.redo()').status, 'redone');
  assert.deepEqual(b.read('modelReader.lines().slice(1)'), draft);
  assert.equal(b.read('documentController.currentStateId'), committedStateId);
});

test('Escape discards several draft segments without changing document or A4 history', async () => {
  const b = await browser(); const before = persistentState(b);
  b.launch(); for (const x of [100, 150, 200, 250]) b.point(x, 100);
  const allocatedIds = b.read('lineDraft.draftSegments().map(line => line.id)');
  assert.equal(allocatedIds.length, 3);
  b.key('Escape'); b.flush();
  assert.deepEqual(persistentState(b), before);
  assert.equal(b.read('activeCommand'), null);
  assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);
});

test('Line Step Undo walks draft segments backward without invoking document Undo', async () => {
  const b = await browser(); const before = persistentState(b);
  b.launch(); for (const x of [400, 450, 500, 550]) b.point(x, 300);
  assert.equal(b.read('lineDraft.segmentCount'), 3);
  for (const [expected, endpointX] of [[2, 20], [1, 10], [0, 0]]) {
    assert.equal(b.window.caderactViewport.stepUndoActiveCommand().status, 'step-undone');
    assert.equal(b.read('lineDraft.segmentCount'), expected);
    assert.equal(b.read('lineDraft.preview().start.x'), endpointX);
    assert.deepEqual(persistentState(b), before);
    b.flush();
    assert.equal(b.renders.at(-1).lineGroups[5].segments.length, expected * 4 + 4);
  }
  assert.equal(b.window.caderactViewport.stepUndoActiveCommand().status, 'no-step');
  assert.deepEqual(persistentState(b), before);
  b.point(475, 250, 'pointermove'); b.flush();
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[5].segments), [400, 300, 475, 250]);
});

test('a failed final commit is atomic and preserves the active draft for retry', async () => {
  const b = await browser(); b.launch(); b.point(400, 300); b.point(450, 250);
  const draft = b.read('lineDraft.draftSegments()'); const before = persistentState(b);
  // Publish a conflicting record ID before Line finishes. Line can acquire its
  // short lease, but staging fails and its transaction must roll back cleanly.
  b.run('window.__conflict = lineDraft.draftSegments()[0]; recordGateway.createAll([window.__conflict])');
  const beforeFailure = persistentState(b);
  b.key('Enter'); b.flush();
  assert.deepEqual(persistentState(b), beforeFailure);
  assert.equal(b.read('activeCommand'), 'line');
  assert.deepEqual(b.read('lineDraft.draftSegments()'), draft);
  assert.equal(b.read('documentController.hasOpenTransaction'), false);
  assert.notDeepEqual(beforeFailure, before);
  b.run('documentController.undo()');
  b.key('Enter');
  assert.deepEqual(b.read('modelReader.lines()'), draft);
  assert.equal(b.read('activeCommand'), null);

  // A later failed session can also be cancelled without leaking its draft.
  b.launch(); b.point(500, 300); b.point(550, 250);
  b.run('window.__cancelConflict = lineDraft.draftSegments()[0]; recordGateway.createAll([window.__cancelConflict])');
  b.key('Enter');
  assert.equal(b.read('activeCommand'), 'line');
  b.key('Escape');
  assert.equal(b.read('activeCommand'), null);
  b.launch();
  assert.equal(b.read('lineDraft.segmentCount'), 0);
  assert.equal(b.read('lineDraft.hasFirstPoint'), false);
});

test('Step Undo back to the first point then Enter publishes nothing', async () => {
  const b = await browser(); const before = persistentState(b);
  b.launch(); b.point(400, 300); b.point(450, 300);
  assert.equal(b.window.caderactViewport.stepUndoActiveCommand().status, 'step-undone');
  assert.equal(b.read('lineDraft.segmentCount'), 0);
  b.key('Enter');
  assert.deepEqual(persistentState(b), before);
  assert.equal(b.read('activeCommand'), null);
});

test('starting a fresh Line command clears any earlier uncommitted draft', async () => {
  const b = await browser(); b.launch(); b.point(100, 100); b.point(150, 150);
  const abandonedId = b.read('lineDraft.draftSegments()[0].id');
  b.window.caderactViewport.startLineCommand();
  assert.equal(b.read('lineDraft.segmentCount'), 0);
  assert.equal(b.read('lineDraft.hasFirstPoint'), false);
  b.point(200, 200); b.point(250, 250);
  assert.notEqual(b.read('lineDraft.draftSegments()[0].id'), abandonedId);
  assert.equal(b.read('modelReader.lines().length'), 0);
});

for (const key of ['Enter', 'Escape']) for (const firstPoint of [false, true]) {
  test(`${key} with ${firstPoint ? 'first point only' : 'empty session'} exits without publication`, async () => {
    const b = await browser(); const before = persistentState(b); b.launch();
    if (firstPoint) { b.point(100, 200); b.point(150, 250, 'pointermove'); }
    b.key(key); b.flush();
    assert.deepEqual(persistentState(b), before);
    assert.equal(b.read('activeCommand'), null);
    assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);
  });
}
