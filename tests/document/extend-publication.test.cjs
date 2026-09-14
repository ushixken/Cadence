'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

const preserve = featureId => ({ role: 'preserve-existing-feature', featureId });
function plain(b, expression) { return JSON.parse(b.run(`JSON.stringify(${expression})`)); }
async function fixture() { return browser(); }
function addLine(b, start, end) {
  const record = plain(b, `recordGateway.createLine(${JSON.stringify(start)},${JSON.stringify(end)})`);
  assert.equal(b.run(`recordGateway.createAll([${JSON.stringify(record)}]).status`), 'committed');
  return record;
}
function addPolyline(b, vertices, closed = false) {
  const record = plain(b, `recordGateway.createPolyline(${JSON.stringify(vertices)},${closed})`);
  assert.equal(b.run(`recordGateway.createAll([${JSON.stringify(record)}]).status`), 'committed');
  return record;
}
function sourceGeometry(record) {
  if (record.type === 'line') return { type: 'line', start: { x: record.start.x, y: record.start.y }, end: { x: record.end.x, y: record.end.y } };
  if (record.type === 'polyline') return { type: 'polyline', closed: record.closed, vertices: record.vertices.map(v => ({ x: v.x, y: v.y })) };
  throw new Error(record.type);
}
function extendLinePlan(record, end) {
  return {
    status: 'planned',
    kind: 'extend',
    targetRecordId: record.id,
    targetType: 'line',
    side: 'end',
    sourceGeometry: sourceGeometry(record),
    replacement: {
      geometry: { type: 'line', start: { x: record.start.x, y: record.start.y }, end },
      preserveRecordId: true,
      featureIdentityIntent: { start: preserve(record.start.featureId), end: preserve(record.end.featureId) },
    },
  };
}
function publish(b, plan) {
  return plain(b, `recordGateway.publishExtendPlan(${JSON.stringify(plan)})`);
}

test('publishExtendPlan replaces one Line atomically while preserving record and endpoint identities', async () => {
  const b = await fixture();
  const target = addLine(b, { x: 0, y: 0 }, { x: 10, y: 0 });
  const beforeHistory = b.read('documentController.historyInfo.entryCount');
  const outcome = publish(b, extendLinePlan(target, { x: 20, y: 0 }));
  assert.equal(outcome.status, 'committed');
  assert.equal(b.read('documentController.historyInfo.entryCount'), beforeHistory + 1);
  const after = b.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(target.id)}]`);
  assert.equal(after.id, target.id);
  assert.equal(after.start.featureId, target.start.featureId);
  assert.equal(after.end.featureId, target.end.featureId);
  assert.equal(after.end.x, 20);
  b.run('window.caderactHistory.undo()');
  assert.deepEqual(b.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(target.id)}]`), target);
  b.run('window.caderactHistory.redo()');
  assert.deepEqual(b.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(target.id)}]`), after);
});

test('publishExtendPlan preserves Polyline vertex feature IDs and strict v1 persistence shape', async () => {
  const b = await fixture();
  const target = addPolyline(b, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]);
  const vertices = target.vertices.map(v => ({ x: v.x, y: v.y }));
  vertices[vertices.length - 1] = { x: 10, y: 12 };
  const plan = {
    status: 'planned',
    kind: 'extend',
    targetRecordId: target.id,
    targetType: 'polyline',
    sourceGeometry: sourceGeometry(target),
    replacement: {
      geometry: { type: 'polyline', vertices, closed: false },
      preserveRecordId: true,
      featureIdentityIntent: { vertices: target.vertices.map(v => preserve(v.featureId)) },
    },
  };
  assert.equal(publish(b, plan).status, 'committed');
  const after = b.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(target.id)}]`);
  assert.deepEqual(after.vertices.map(v => v.featureId), target.vertices.map(v => v.featureId));
  assert.equal(after.vertices.at(-1).y, 12);
  const persisted = JSON.parse(b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())'));
  assert.equal(persisted.fileVersion, 2);
  assert.equal(persisted.document.records[0].type, 'polyline');
});

test('invalid, stale, missing, and failed Extend plans do not mutate document/history and remain retryable', async () => {
  const b = await fixture();
  const target = addLine(b, { x: 0, y: 0 }, { x: 10, y: 0 });
  const before = b.read('({records:modelReader.records(), revision:documentController.currentRevision, history:documentController.historyInfo.entryCount})');
  assert.equal(publish(b, { status: 'no-op', reason: 'no-valid-extension' }).status, 'no-op');
  assert.equal(publish(b, { ...extendLinePlan(target, { x: 20, y: 0 }), targetRecordId: 'missing' }).status, 'missing-record');
  assert.deepEqual(b.read('({records:modelReader.records(), revision:documentController.currentRevision, history:documentController.historyInfo.entryCount})'), before);

  const stale = extendLinePlan(target, { x: 20, y: 0 });
  assert.equal(b.run(`recordGateway.replace(${JSON.stringify(target.id)}, ${JSON.stringify({ ...target, end: { ...target.end, x: 12 } })}).status`), 'committed');
  const afterIntervening = b.read('({records:modelReader.records(), revision:documentController.currentRevision, history:documentController.historyInfo.entryCount})');
  assert.equal(publish(b, stale).status, 'stale-plan');
  assert.deepEqual(b.read('({records:modelReader.records(), revision:documentController.currentRevision, history:documentController.historyInfo.entryCount})'), afterIntervening);

  const fresh = b.read(`modelReader.snapshot().geometry.objects[${JSON.stringify(target.id)}]`);
  const blocking = b.run('window.__blocking=documentController.beginTransaction(); "open"');
  assert.equal(blocking, 'open');
  assert.equal(publish(b, extendLinePlan(fresh, { x: 20, y: 0 })).status, 'commit-failed');
  b.run('window.__blocking.rollback()');
  assert.equal(publish(b, extendLinePlan(fresh, { x: 20, y: 0 })).status, 'committed');
});
