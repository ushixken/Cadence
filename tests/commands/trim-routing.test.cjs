'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
function state(b) {
  return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo.entryCount,cursor:documentController.historyInfo.cursor,dirty:documentController.isDirty})');
}
function createLine(b, a, c) {
  return plain(b.run(`recordGateway.createLine(${JSON.stringify(a)},${JSON.stringify(c)})`));
}
function add(b, records) {
  b.run(`recordGateway.createAll(${JSON.stringify(records)})`);
}
function drag(b, start, end, props = {}) {
  b.point(...start, 'pointerdown', props);
  b.point(...end, 'pointermove', props);
  b.point(...end, 'pointerup', props);
}

// World (0,0) maps to screen (400,300) at initial zoom 5: screenX = 400 + 5*worldX, screenY = 300 - 5*worldY.
const sx = x => 400 + 5 * x;
const sy = y => 300 - 5 * y;

test('Routing 1: Select cutting edge -> Enter -> immediately click target without pointermove -> target trims and Trim remains active', async () => {
  const b = await browser();
  const edge = createLine(b, { x: 0, y: -10 }, { x: 0, y: 10 });
  const target = createLine(b, { x: -10, y: 0 }, { x: 10, y: 0 });
  add(b, [edge, target]);

  const before = state(b);

  // 1. Launch Trim
  b.launch('Trim');
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Trim');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.isSelectionPhase'), true);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'cutting-edges');

  // 2. Select cutting edge via DOM canvas pointerdown (click away from intersection at y=0)
  b.point(sx(0), sy(-5), 'pointerdown');
  assert.deepEqual(plain(b.read('window.caderactSelection.selectedIds()')), [edge.id]);

  // 3. Confirm cutting edges via Enter keydown on document
  b.key('Enter', b.document);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'targets');
  assert.deepEqual(plain(b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds')), [edge.id]);

  // 4. Immediately click target without prior pointermove: strictly dispatch 'pointerdown' only
  b.point(sx(-5), sy(0), 'pointerdown');

  // Assert Trim command remains active
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Trim');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'targets');

  // Assert document revision and history bumped by exactly 1
  const after = state(b);
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.history, before.history + 1);

  // Assert target line was trimmed: start (-10, 0) removed, survivor runs from (0, 0) to (10, 0)
  const records = plain(b.read('modelReader.records()'));
  assert.equal(records.length, 2);
  const survivor = records.find(r => r.id === target.id);
  assert.ok(survivor, 'Original target record ID must be preserved on replacement survivor');
  assert.ok(Math.abs(survivor.start.x - 0) < 1e-6 || Math.abs(survivor.end.x - 0) < 1e-6);
  const minX = Math.min(survivor.start.x, survivor.end.x);
  const maxX = Math.max(survivor.start.x, survivor.end.x);
  assert.ok(Math.abs(minX - 0) < 1e-6, `Expected survivor minX ~ 0, got ${minX}`);
  assert.ok(Math.abs(maxX - 10) < 1e-6, `Expected survivor maxX ~ 10, got ${maxX}`);
});

test('Routing 2: Select cutting edge -> quick Space -> click target -> target trims', async () => {
  const b = await browser();
  const edge = createLine(b, { x: 0, y: -10 }, { x: 0, y: 10 });
  const target = createLine(b, { x: -10, y: 0 }, { x: 10, y: 0 });
  add(b, [edge, target]);

  const before = state(b);

  // 1. Launch Trim
  b.launch('Trim');
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Trim');

  // 2. Select cutting edge via canvas pointerdown (click away from intersection at y=0)
  b.point(sx(0), sy(-5), 'pointerdown');
  assert.deepEqual(plain(b.read('window.caderactSelection.selectedIds()')), [edge.id]);

  // 3. Confirm cutting edges via real quick Space DOM sequence
  b.emit(b.canvas, 'pointerenter');
  b.key(' ', b.input, { code: 'Space' });
  b.emit(b.window, 'keyup', { key: ' ', code: 'Space' });

  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'targets');
  assert.deepEqual(plain(b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds')), [edge.id]);

  // 4. Click target (positive side, x = 5)
  b.point(sx(5), sy(0), 'pointerdown');

  // Assert Trim remains active
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Trim');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'targets');

  // Assert document revision and history bumped by exactly 1
  const after = state(b);
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.history, before.history + 1);

  // Assert target line was trimmed: positive side (0..10) removed, survivor runs from (-10, 0) to (0, 0)
  const records = plain(b.read('modelReader.records()'));
  assert.equal(records.length, 2);
  const survivor = records.find(r => r.id === target.id);
  assert.ok(survivor, 'Original target record ID must be preserved');
  const minX = Math.min(survivor.start.x, survivor.end.x);
  const maxX = Math.max(survivor.start.x, survivor.end.x);
  assert.ok(Math.abs(minX - (-10)) < 1e-6, `Expected survivor minX ~ -10, got ${minX}`);
  assert.ok(Math.abs(maxX - 0) < 1e-6, `Expected survivor maxX ~ 0, got ${maxX}`);
});

test('Routing 3: Window/Crossing cutting-edge selection -> confirm -> target trims', async () => {
  // Test both Window (left-to-right drag) and Crossing (right-to-left drag)
  // Part A: Crossing selection (right-to-left drag intersects cutting edge)
  {
    const b = await browser();
    const edge = createLine(b, { x: 0, y: -10 }, { x: 0, y: 10 });
    const target = createLine(b, { x: -10, y: 0 }, { x: 10, y: 0 });
    add(b, [edge, target]);

    const before = state(b);

    b.launch('Trim');
    assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'cutting-edges');

    // Crossing drag: start at screen (sx(5), sy(-4)), drag left to (sx(-5), sy(-8))
    // This crosses the edge line (x=0 from y=-10 to 10) in negative y (y=-4 to -8), well away from target at y=0
    drag(b, [sx(5), sy(-4)], [sx(-5), sy(-8)]);
    assert.deepEqual(plain(b.read('window.caderactSelection.selectedIds()')), [edge.id]);

    // Confirm via Enter
    b.key('Enter', b.document);
    assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'targets');
    assert.deepEqual(plain(b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds')), [edge.id]);

    // Click target at x = -5
    b.point(sx(-5), sy(0), 'pointerdown');

    assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Trim');
    const after = state(b);
    assert.equal(after.revision, before.revision + 1);
    assert.equal(after.history, before.history + 1);

    const records = plain(b.read('modelReader.records()'));
    const survivor = records.find(r => r.id === target.id);
    assert.ok(survivor);
    const minX = Math.min(survivor.start.x, survivor.end.x);
    const maxX = Math.max(survivor.start.x, survivor.end.x);
    assert.ok(Math.abs(minX - 0) < 1e-6);
    assert.ok(Math.abs(maxX - 10) < 1e-6);
  }

  // Part B: Window selection (left-to-right drag encloses cutting edge)
  {
    const b = await browser();
    // Cutter crosses target: cutter is x=0, y=-5..15. Target is x=-10..10, y=0.
    const edge = createLine(b, { x: 0, y: -5 }, { x: 0, y: 15 });
    const target = createLine(b, { x: -10, y: 0 }, { x: 10, y: 0 });
    add(b, [edge, target]);

    const before = state(b);

    b.launch('Trim');
    assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'cutting-edges');

    // Window drag: start at screen (sx(-3), sy(18)), drag right to (sx(3), sy(-8))
    // In world coords: x in [-3, 3], y in [-8, 18].
    // Edge: start (0, -5), end (0, 15) is fully enclosed because 0 in [-3,3] and -5, 15 in [-8, 18].
    // Target: start (-10, 0), end (10, 0) is NOT enclosed because -10 and 10 are outside [-3, 3]!
    // Therefore, Window selection selects ONLY edge!
    drag(b, [sx(-3), sy(18)], [sx(3), sy(-8)]);
    assert.deepEqual(plain(b.read('window.caderactSelection.selectedIds()')), [edge.id]);

    // Confirm via Enter
    b.key('Enter', b.document);
    assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'targets');
    assert.deepEqual(plain(b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds')), [edge.id]);

    // Click target at x = 5
    b.point(sx(5), sy(0), 'pointerdown');

    assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Trim');
    const after = state(b);
    assert.equal(after.revision, before.revision + 1);
    assert.equal(after.history, before.history + 1);

    const records = plain(b.read('modelReader.records()'));
    const survivor = records.find(r => r.id === target.id);
    assert.ok(survivor);
    const minX = Math.min(survivor.start.x, survivor.end.x);
    const maxX = Math.max(survivor.start.x, survivor.end.x);
    assert.ok(Math.abs(minX - (-10)) < 1e-6);
    assert.ok(Math.abs(maxX - 0) < 1e-6);
  }
});

test('Routing 4: Two sequential target trims in one active Trim session -> both commit independently and Trim remains active', async () => {
  const b = await browser();
  const cutterEdge = createLine(b, { x: 0, y: -10 }, { x: 0, y: 10 });
  const target1 = createLine(b, { x: -10, y: 0 }, { x: 10, y: 0 });
  const target2 = createLine(b, { x: -10, y: 3 }, { x: 10, y: 3 });
  add(b, [cutterEdge, target1, target2]);

  const before = state(b);

  // 1. Launch Trim and confirm cutter
  b.launch('Trim');
  b.point(sx(0), sy(-5), 'pointerdown');
  assert.deepEqual(plain(b.read('window.caderactSelection.selectedIds()')), [cutterEdge.id]);
  b.key('Enter', b.document);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'targets');

  // 2. First target trim: click target1 at x = -5
  b.point(sx(-5), sy(0), 'pointerdown');

  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Trim');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'targets');

  const afterFirst = state(b);
  assert.equal(afterFirst.revision, before.revision + 1);
  assert.equal(afterFirst.history, before.history + 1);

  const recordsAfter1 = plain(b.read('modelReader.records()'));
  assert.equal(recordsAfter1.length, 3);
  const survivor1 = recordsAfter1.find(r => r.id === target1.id);
  assert.ok(survivor1);
  const minX1 = Math.min(survivor1.start.x, survivor1.end.x);
  const maxX1 = Math.max(survivor1.start.x, survivor1.end.x);
  assert.ok(Math.abs(minX1 - 0) < 1e-6);
  assert.ok(Math.abs(maxX1 - 10) < 1e-6);

  // 3. Second target trim: click target2 at x = 5 (without restarting Trim session)
  b.point(sx(5), sy(3), 'pointerdown');

  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Trim');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'targets');

  const afterSecond = state(b);
  assert.equal(afterSecond.revision, before.revision + 2);
  assert.equal(afterSecond.history, before.history + 2);

  const recordsAfter2 = plain(b.read('modelReader.records()'));
  assert.equal(recordsAfter2.length, 3);
  const survivor2 = recordsAfter2.find(r => r.id === target2.id);
  assert.ok(survivor2);
  const minX2 = Math.min(survivor2.start.x, survivor2.end.x);
  const maxX2 = Math.max(survivor2.start.x, survivor2.end.x);
  assert.ok(Math.abs(minX2 - (-10)) < 1e-6);
  assert.ok(Math.abs(maxX2 - 0) < 1e-6);

  // 4. Finish Trim command via Enter
  b.key('Enter', b.document);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);

  // 5. Verify Undo steps back independently through each trim in document history
  const undoResult1 = plain(b.run('window.caderactHistory.undo()'));
  assert.equal(undoResult1.status, 'undo-completed');
  const afterUndo1 = state(b);
  assert.equal(afterUndo1.cursor, before.cursor + 1);
  const recordsAfterUndo1 = plain(b.read('modelReader.records()'));
  const restoredTarget2 = recordsAfterUndo1.find(r => r.id === target2.id);
  assert.ok(restoredTarget2);
  // Target 2 restored to full span (-10 to 10)
  assert.ok(Math.abs(Math.min(restoredTarget2.start.x, restoredTarget2.end.x) - (-10)) < 1e-6);
  assert.ok(Math.abs(Math.max(restoredTarget2.start.x, restoredTarget2.end.x) - 10) < 1e-6);
  // Target 1 still trimmed (0 to 10)
  const survivor1StillTrimmed = recordsAfterUndo1.find(r => r.id === target1.id);
  assert.ok(Math.abs(Math.min(survivor1StillTrimmed.start.x, survivor1StillTrimmed.end.x) - 0) < 1e-6);

  const undoResult2 = plain(b.run('window.caderactHistory.undo()'));
  assert.equal(undoResult2.status, 'undo-completed');
  const afterUndo2 = state(b);
  assert.equal(afterUndo2.cursor, before.cursor);
  const recordsAfterUndo2 = plain(b.read('modelReader.records()'));
  const restoredTarget1 = recordsAfterUndo2.find(r => r.id === target1.id);
  assert.ok(restoredTarget1);
  // Target 1 restored to full span (-10 to 10)
  assert.ok(Math.abs(Math.min(restoredTarget1.start.x, restoredTarget1.end.x) - (-10)) < 1e-6);
  assert.ok(Math.abs(Math.max(restoredTarget1.start.x, restoredTarget1.end.x) - 10) < 1e-6);
});
