'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
const sx = x => 400 + 5 * x, sy = y => 300 - 5 * y;
function createLine(b, a, c) { return plain(b.run(`recordGateway.createLine(${JSON.stringify(a)},${JSON.stringify(c)})`)); }
function createCircle(b, center, radius) { return plain(b.run(`recordGateway.createCircle(${JSON.stringify(center)},${radius})`)); }
function createArc(b, geometry) { return plain(b.run(`recordGateway.createArc(${JSON.stringify(geometry)})`)); }
function createEllipse(b, geometry) { return plain(b.run(`recordGateway.createEllipse(${JSON.stringify(geometry)})`)); }
function createPolyline(b, vertices, closed = false) { return plain(b.run(`recordGateway.createPolyline(${JSON.stringify(vertices)},${closed})`)); }
function add(b, records) { b.run(`recordGateway.createAll(${JSON.stringify(records)})`); }
function finish(b) { b.key('Enter', b.document); }
function drag(b, start, end, props = {}) { b.point(...start, 'pointerdown', props); b.point(...end, 'pointermove', props); b.point(...end, 'pointerup', props); }
function state(b) { return b.read('({records:modelReader.records(), revision:documentController.currentRevision, history:documentController.historyInfo.entryCount})'); }
function preview(b) { return b.read('window.caderactCommandRouter.activeSession.getExtendPreview()'); }

test('Extend resolves canonical name and EX alias, is repeatable, and starts in boundary selection', async () => {
  for (const command of ['Extend', 'EX']) {
    const b = await browser();
    b.launch(command);
    assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Extend');
  }
  const b = await browser();
  b.launch('Extend');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'boundaries');
  assert.equal(b.read('window.caderactCommandRegistry.resolve("Extend").repeatable'), true);
});

test('Extend respects boundary preselection and extends the picked Line endpoint in one transaction', async () => {
  const b = await browser();
  const boundary = createLine(b, { x: 20, y: -10 }, { x: 20, y: 10 });
  const target = createLine(b, { x: 0, y: 0 }, { x: 10, y: 0 });
  add(b, [boundary, target]);
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(boundary.id)})`);
  const before = state(b);
  b.launch('EX');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'targets');
  b.point(sx(9), sy(0));
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Extend');
  const after = b.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(target.id)}]`);
  assert.equal(after.id, target.id);
  assert.equal(after.start.featureId, target.start.featureId);
  assert.equal(after.end.featureId, target.end.featureId);
  assert.equal(after.end.x, 20);
  assert.equal(b.read('documentController.historyInfo.entryCount'), before.history + 1);
  finish(b);
  b.run('window.caderactHistory.undo()');
  assert.deepEqual(b.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(target.id)}]`), target);
  b.run('window.caderactHistory.redo()');
  assert.equal(b.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(target.id)}].end.x`), 20);
});

test('Extend boundary selection reuses click, Window, Crossing, and Ctrl/Meta semantics', async () => {
  const b = await browser();
  const a = createLine(b, { x: -10, y: 0 }, { x: 10, y: 0 });
  const c = createLine(b, { x: 20, y: 0 }, { x: 30, y: 0 });
  const cross = createLine(b, { x: -40, y: 10 }, { x: 40, y: 10 });
  add(b, [a, c, cross]);
  b.launch('Extend');
  b.point(400, 300);
  assert.deepEqual(b.read('window.caderactSelection.selectedIds()'), [a.id]);
  b.point(525, 300, 'pointerdown', { ctrlKey: true });
  assert.deepEqual(new Set(b.read('window.caderactSelection.selectedIds()')), new Set([a.id, c.id]));
  b.point(525, 300, 'pointerdown', { metaKey: true });
  assert.deepEqual(b.read('window.caderactSelection.selectedIds()'), [a.id]);
  drag(b, [300, 240], [500, 360]);
  assert.deepEqual(b.read('window.caderactSelection.selectedIds()'), [a.id]);
  drag(b, [500, 240], [300, 360], { ctrlKey: true });
  assert.ok(b.read('window.caderactSelection.selectedIds()').includes(cross.id));
  finish(b);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'targets');
});

test('Extend preview shows subdued source and dominant extended record without mutation', async () => {
  const b = await browser();
  const boundary = createLine(b, { x: 20, y: -10 }, { x: 20, y: 10 });
  const target = createLine(b, { x: 0, y: 0 }, { x: 10, y: 0 });
  add(b, [boundary, target]);
  b.launch('Extend'); b.point(sx(20), sy(-10)); finish(b);
  const before = state(b);
  b.point(sx(9), sy(0), 'pointermove');
  const p = preview(b);
  assert.ok(p);
  assert.equal(p.sourceRecordId, target.id);
  assert.equal(p.sourceRecords[0].id, target.id);
  assert.equal(p.records[0].id, null);
  assert.equal(p.records[0].end.x, 20);
  assert.deepEqual(state(b), before);
  b.flush();
  assert.ok(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length > 0);
  assert.ok(b.renders.at(-1).lineGroups[17].segments.length > 0);
  b.emit(b.canvas, 'pointerleave');
  assert.equal(preview(b), null);
});

test('Extend target picking uses the shared snap path, Shift bypass, and quick Space finish', async () => {
  const b = await browser();
  const boundary = createLine(b, { x: 20, y: -10 }, { x: 20, y: 10 });
  const target = createLine(b, { x: 0, y: 0 }, { x: 10, y: 0 });
  add(b, [boundary, target]);
  b.launch('Extend'); b.point(sx(20), sy(-10)); finish(b);
  b.point(sx(10) - 1, sy(0) + 1, 'pointermove');
  assert.equal(b.read('activeSnapResult.kind'), 'endpoint');
  assert.equal(preview(b).records[0].end.x, 20);
  b.point(sx(10) - 1, sy(0) + 1, 'pointermove', { shiftKey: true });
  assert.equal(b.read('activeSnapResult.snapped'), false);
  assert.equal(preview(b).records[0].end.x, 20);
  b.emit(b.canvas, 'pointerenter');
  b.key(' ', b.input, { code: 'Space' });
  b.emit(b.window, 'keyup', { key: ' ', code: 'Space' });
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
});

test('Extend supports Circle, Arc, and Ellipse boundaries for Line targets and rejects closed targets safely', async () => {
  const circleCase = await browser();
  const circleBoundary = createCircle(circleCase, { x: 20, y: 0 }, 5);
  const lineTarget = createLine(circleCase, { x: 0, y: 0 }, { x: 10, y: 0 });
  add(circleCase, [circleBoundary, lineTarget]);
  circleCase.launch('Extend'); circleCase.point(sx(20), sy(5)); finish(circleCase); circleCase.point(sx(9), sy(0));
  assert.equal(circleCase.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(lineTarget.id)}].end.x`), 15);

  const arcCase = await browser();
  const arcBoundary = createArc(arcCase, { center: { x: 20, y: 0 }, start: { x: 15, y: 0 }, end: { x: 20, y: 5 }, radius: 5, sweep: -Math.PI / 2 });
  const arcTarget = createLine(arcCase, { x: 0, y: 0 }, { x: 10, y: 0 });
  add(arcCase, [arcBoundary, arcTarget]);
  arcCase.launch('Extend'); arcCase.point(sx(15), sy(0)); finish(arcCase); arcCase.point(sx(9), sy(0));
  assert.equal(Math.round(arcCase.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(arcTarget.id)}].end.x`)), 15);

  const ellipseCase = await browser();
  const ellipseBoundary = createEllipse(ellipseCase, { center: { x: 20, y: 0 }, majorAxis: { x: 6, y: 0 }, minorRadius: 3 });
  const ellipseTarget = createLine(ellipseCase, { x: 0, y: 0 }, { x: 10, y: 0 });
  add(ellipseCase, [ellipseBoundary, ellipseTarget]);
  ellipseCase.launch('Extend'); ellipseCase.point(sx(14), sy(0)); finish(ellipseCase); ellipseCase.point(sx(9), sy(0));
  assert.equal(Math.round(ellipseCase.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(ellipseTarget.id)}].end.x`)), 14);

  const closed = await browser();
  const boundary = createLine(closed, { x: 20, y: -10 }, { x: 20, y: 10 });
  const circleTarget = createCircle(closed, { x: 0, y: 0 }, 5);
  add(closed, [boundary, circleTarget]);
  const before = state(closed);
  closed.launch('Extend'); closed.point(sx(20), sy(-10)); finish(closed); closed.point(sx(5), sy(0));
  assert.deepEqual(state(closed), before);
  assert.equal(closed.read('window.caderactCommandRouter.activeCommand'), 'Extend');
});

test('Extend handles Arc and open Polyline targets while closed Polyline is rejected', async () => {
  const arcCase = await browser();
  const boundary = createLine(arcCase, { x: -10, y: 0 }, { x: 10, y: 0 });
  const target = createArc(arcCase, { center: { x: 0, y: 0 }, start: { x: 5, y: 0 }, end: { x: 0, y: 5 }, radius: 5, sweep: Math.PI / 2 });
  add(arcCase, [boundary, target]);
  arcCase.launch('Extend'); arcCase.point(sx(-5), sy(0)); finish(arcCase); arcCase.point(sx(0), sy(5));
  const arcAfter = arcCase.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(target.id)}]`);
  assert.equal(arcAfter.id, target.id);
  assert.ok(Math.abs(arcAfter.sweep) > Math.PI / 2);
  assert.equal(arcAfter.end.featureId, target.end.featureId);

  const polyCase = await browser();
  const polyBoundary = createLine(polyCase, { x: 10, y: 12 }, { x: 20, y: 12 });
  const polyTarget = createPolyline(polyCase, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]);
  add(polyCase, [polyBoundary, polyTarget]);
  polyCase.launch('Extend'); polyCase.point(sx(10), sy(12)); finish(polyCase); polyCase.point(sx(10), sy(5));
  assert.equal(polyCase.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(polyTarget.id)}].vertices[2].y`), 12);

  const closedCase = await browser();
  const closedBoundary = createLine(closedCase, { x: 20, y: -10 }, { x: 20, y: 10 });
  const closedTarget = createPolyline(closedCase, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], true);
  add(closedCase, [closedBoundary, closedTarget]);
  const before = state(closedCase);
  closedCase.launch('Extend'); closedCase.point(sx(20), sy(-10)); finish(closedCase); closedCase.point(sx(10), sy(0));
  assert.deepEqual(state(closedCase), before);
});

test('Extend no-op, Escape, pointer cancel, stale publication, and failure retry preserve command state correctly', async () => {
  const b = await browser();
  const boundary = createLine(b, { x: 0, y: 5 }, { x: 10, y: 5 });
  const target = createLine(b, { x: 0, y: 0 }, { x: 10, y: 0 });
  add(b, [boundary, target]);
  const before = state(b);
  b.launch('Extend'); b.point(sx(0), sy(5)); finish(b); b.point(sx(9), sy(0));
  assert.deepEqual(state(b), before);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Extend');
  b.emit(b.canvas, 'pointercancel');
  assert.equal(preview(b), null);
  b.key('Escape', b.document);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
  assert.deepEqual(state(b), before);

  const retry = await browser();
  const edge = createLine(retry, { x: 20, y: -10 }, { x: 20, y: 10 });
  const subject = createLine(retry, { x: 0, y: 0 }, { x: 10, y: 0 });
  add(retry, [edge, subject]);
  retry.launch('Extend'); retry.point(sx(20), sy(-10)); finish(retry);
  retry.point(sx(9), sy(0), 'pointermove');
  retry.run(`recordGateway.replace(${JSON.stringify(subject.id)}, ${JSON.stringify({ ...subject, end: { ...subject.end, x: 12 } })})`);
  retry.point(sx(9), sy(0));
  assert.equal(retry.read('window.caderactCommandRouter.activeCommand'), 'Extend');
  retry.point(sx(11), sy(0));
  assert.equal(retry.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(subject.id)}].end.x`), 20);
});
