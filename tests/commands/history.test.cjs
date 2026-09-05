'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser, Element } = require('../helpers/browser.cjs');

function commitLine(b, offset = 0) {
  b.launch(); b.point(400 + offset, 300); b.point(450 + offset, 250); b.key('Enter'); b.flush();
}

test('Ctrl+Z and Ctrl+Y route one exact document Undo and Redo', async () => {
  const b = await browser(); commitLine(b);
  const committed = b.read('modelReader.records()');
  assert.equal(b.undoButton.disabled, false); assert.equal(b.redoButton.disabled, true);
  const beforeUndoRevision = b.read('documentController.currentRevision');
  const undoEvent = b.key('z', b.canvas, { ctrlKey: true }); b.flush();
  assert.equal(undoEvent.defaultPrevented, true);
  assert.equal(b.read('documentController.currentRevision'), beforeUndoRevision + 1);
  assert.deepEqual(b.read('modelReader.records()'), []);
  assert.deepEqual(b.read('window.caderactHistory.lastResult.status'), 'undo-completed');
  assert.equal(b.undoButton.disabled, true); assert.equal(b.redoButton.disabled, false);

  const redoEvent = b.key('y', b.canvas, { ctrlKey: true }); b.flush();
  assert.equal(redoEvent.defaultPrevented, true);
  assert.deepEqual(b.read('modelReader.records()'), committed);
  assert.equal(b.read('window.caderactHistory.lastResult.status'), 'redo-completed');
  assert.equal(b.undoButton.disabled, false); assert.equal(b.redoButton.disabled, true);
});

test('Ctrl+Shift+Z performs Redo and unavailable history remains native', async () => {
  const b = await browser();
  const unavailableUndo = b.key('z', b.canvas, { ctrlKey: true });
  assert.equal(unavailableUndo.defaultPrevented, false);
  assert.equal(b.read('window.caderactHistory.lastResult.status'), 'undo-unavailable');
  const unavailableRedo = b.key('y', b.canvas, { ctrlKey: true });
  assert.equal(unavailableRedo.defaultPrevented, false);
  assert.equal(b.read('window.caderactHistory.lastResult.status'), 'redo-unavailable');

  commitLine(b); b.key('z', b.canvas, { ctrlKey: true });
  const redoEvent = b.key('z', b.canvas, { ctrlKey: true, shiftKey: true }); b.flush();
  assert.equal(redoEvent.defaultPrevented, true);
  assert.equal(b.read('modelReader.records().length'), 1);
  assert.equal(b.read('window.caderactHistory.lastResult.status'), 'redo-completed');
});

test('Undo and Redo buttons derive availability from document history', async () => {
  const b = await browser(); commitLine(b);
  assert.equal(b.undoButton.getAttribute('aria-disabled'), 'false');
  b.emit(b.undoButton, 'click'); b.flush();
  assert.equal(b.read('modelReader.records().length'), 0);
  assert.equal(b.undoButton.disabled, true); assert.equal(b.redoButton.disabled, false);
  b.emit(b.redoButton, 'click'); b.flush();
  assert.equal(b.read('modelReader.records().length'), 1);
  assert.equal(b.undoButton.disabled, false); assert.equal(b.redoButton.disabled, true);
});

test('Undo followed by a new Line discards Redo and refreshes controls', async () => {
  const b = await browser(); commitLine(b); commitLine(b, 100);
  b.key('z', b.canvas, { ctrlKey: true });
  assert.equal(b.redoButton.disabled, false);
  commitLine(b, 200);
  assert.equal(b.read('documentController.canRedo'), false);
  assert.equal(b.redoButton.disabled, true);
  assert.equal(b.read('modelReader.records().length'), 2);
});

test('active Line owns Ctrl+Z Step Undo and blocks document Redo', async () => {
  const b = await browser(); commitLine(b);
  const documentBefore = b.read('modelReader.snapshot()');
  const historyBefore = b.read('documentController.historyInfo');
  const revisionBefore = b.read('documentController.currentRevision');
  b.launch(); b.point(100, 100); b.point(150, 100); b.point(200, 100);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'), 2);
  assert.equal(b.undoButton.disabled, true); assert.equal(b.redoButton.disabled, true);

  const stepEvent = b.key('z', b.canvas, { ctrlKey: true });
  assert.equal(stepEvent.defaultPrevented, true);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'), 1);
  assert.deepEqual(b.read('modelReader.snapshot()'), documentBefore);
  assert.deepEqual(b.read('documentController.historyInfo'), historyBefore);
  assert.equal(b.read('documentController.currentRevision'), revisionBefore);
  assert.deepEqual(b.read('window.caderactHistory.lastResult'), {
    status: 'undo-completed', scope: 'command', command: 'Line',
    outcome: b.read('window.caderactHistory.lastResult.outcome'),
  });

  const redoEvent = b.key('y', b.canvas, { ctrlKey: true });
  assert.equal(redoEvent.defaultPrevented, true);
  assert.equal(b.read('window.caderactHistory.lastResult.status'), 'redo-blocked-active-command');
  assert.deepEqual(b.read('modelReader.snapshot()'), documentBefore);
  b.key('Escape');
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
  assert.deepEqual(b.read('modelReader.snapshot()'), documentBefore);
  assert.equal(b.undoButton.disabled, false);
  assert.equal(b.redoButton.disabled, true);
});

test('history shortcuts do not hijack command or regular text fields', async () => {
  const b = await browser(); commitLine(b);
  const before = b.read('modelReader.snapshot()');
  const commandEvent = b.key('z', b.input, { ctrlKey: true });
  assert.equal(commandEvent.defaultPrevented, false);
  const field = new Element('textarea'); field.parent = b.document; field.owner = b.document;
  const fieldEvent = b.key('z', field, { ctrlKey: true });
  assert.equal(fieldEvent.defaultPrevented, false);
  assert.deepEqual(b.read('modelReader.snapshot()'), before);
});
