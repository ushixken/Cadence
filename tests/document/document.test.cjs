'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

async function fixture() {
  const b = await browser();
  b.launch(); b.point(400, 300); b.point(450, 250); b.point(500, 200);
  b.key('Enter');
  return b;
}
test('document, default layer and current layer have stable resolving IDs', async () => {
  const b = await browser(); const before = b.window.caderactDocument.snapshot();
  assert.equal(before.formatVersion, 3); assert.ok(before.id);
  assert.deepEqual(Object.keys(before.layers), [before.currentLayerId]);
  const layer = before.layers[before.currentLayerId];
  assert.equal(layer.name, 'Default'); assert.equal(layer.visible, true); assert.equal(layer.locked, false);
  b.launch(); b.point(400, 300); b.point(450, 250); b.key('Enter');
  const after = b.window.caderactDocument.snapshot();
  assert.equal(after.id, before.id); assert.equal(after.currentLayerId, before.currentLayerId);
  assert.equal(Object.keys(before.geometry.objects).length, 0); // previous snapshot remains unchanged
  assert.equal(b.window.CaderactDocument.validateDocument(after).length, 0);
});
test('independent lines and endpoints have unique IDs even at shared coordinates', async () => {
  const b = await fixture(); const lines = b.window.caderactDocument.lines();
  const ids = lines.flatMap(l => [l.id, l.start.featureId, l.end.featureId]);
  assert.equal(new Set(ids).size, 6);
  assert.equal(lines[0].end.x, lines[1].start.x);
  assert.notEqual(lines[0].end.featureId, lines[1].start.featureId);
  const snapshot = b.window.caderactDocument.snapshot();
  for (const line of lines) {
    assert.equal(line.type, 'line'); assert.equal(line.layerId, snapshot.currentLayerId);
    assert.equal(snapshot.geometry.objects[line.id], line);
  }
  b.resize(900, 700, 2); b.point(100, 100, 'wheel', { deltaY: 10 }); b.flush();
  assert.deepEqual(b.window.caderactDocument.lines(), lines);
});
test('collection reordering does not change identity or coordinates', async () => {
  const b = await fixture(); const copy = structuredClone(b.window.caderactDocument.snapshot());
  const original = structuredClone(copy.geometry.objects);
  copy.geometry.objects = Object.fromEntries(Object.entries(copy.geometry.objects).reverse());
  assert.equal(b.window.CaderactDocument.validateDocument(copy).length, 0);
  for (const id of Object.keys(original)) assert.deepEqual(copy.geometry.objects[id], original[id]);
});
test('snapshot tables, records and coordinates are read-only; renderer buffers are disposable', async () => {
  const b = await fixture(); const doc = b.window.caderactDocument.snapshot(); const line = b.window.caderactDocument.lines()[0];
  assert.throws(() => { line.start.x = 999; }, TypeError);
  assert.throws(() => { doc.geometry.objects[line.id] = {}; }, TypeError);
  assert.throws(() => { doc.layers[doc.currentLayerId].locked = true; }, TypeError);
  assert.throws(() => b.window.caderactDocument.lines().pop(), { name: 'TypeError' });
  const before = structuredClone(doc); b.flush();
  b.renders.at(-1).lineGroups[4].segments.fill(999);
  assert.deepEqual(structuredClone(b.window.caderactDocument.snapshot()), before);
});
test('writer copies inputs, preserves Number precision and cancellation never recycles IDs', async () => {
  const b = await browser();
  b.run('const p = {x: 0.123456789012345, y: -987.654321098765}; const firstDraft = recordGateway.createLine(p, p); p.x=999; recordGateway.createAll([firstDraft])');
  const first = b.window.caderactDocument.lines()[0];
  assert.equal(first.start.x, 0.123456789012345); assert.equal(first.start.y, -987.654321098765);
  b.run('const unusedDraft = recordGateway.createLine({x:1,y:1},{x:2,y:2}); const nextDraft = recordGateway.createLine({x:0,y:0},{x:0,y:0}); recordGateway.createAll([nextDraft])');
  const next = b.window.caderactDocument.lines()[1];
  assert.notEqual(next.id, first.id); assert.notEqual(next.start.featureId, first.start.featureId);
  assert.notEqual(next.id, b.read('unusedDraft.id'));
});
test('an imported ID is reserved and skipped by subsequent allocation', async () => {
  const b = await browser();
  const importedId = `id_${'00'.repeat(16)}`;
  b.context.crypto = { getRandomValues(bytes) {
    const value = b.context.__allocationByte++;
    bytes.fill(value);
    return bytes;
  } };
  b.context.__allocationByte = 0;
  b.context.__importedId = importedId;
  b.run(`
    const importedLayerId = 'id_${'ff'.repeat(16)}';
    const importedStore = window.CaderactDocument.createStore({ document: {
      id: __importedId, name: 'Imported', formatVersion: 2, units: { length: 'mm' }, dimensionStyle:{...window.CaderactDocument.DEFAULT_DIMENSION_STYLE},
      geometry: { objects: {} },
      layers: { [importedLayerId]: { id: importedLayerId, name: 'Default', visible: true, locked: false } },
      defaultLayerId: importedLayerId, currentLayerId: importedLayerId,
    } });
    const importedLine = importedStore.recordGateway.createLine({ x: 0, y: 0 }, { x: 1, y: 1 });
    window.__importedAllocation = { stateId: importedStore.controller.currentStateId, line: importedLine };
  `);
  const allocated = b.read('window.__importedAllocation');
  assert.notEqual(allocated.stateId, importedId);
  assert.notEqual(allocated.line.id, importedId);
  assert.notEqual(allocated.line.start.featureId, importedId);
  assert.notEqual(allocated.line.end.featureId, importedId);
});
test('session Escape preserves earlier IDs and records exactly', async () => {
  const b = await fixture(); b.key('Enter'); const before = b.window.caderactDocument.lines();
  b.launch(); b.point(100, 100); b.point(200, 200);
  const cancelled = b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()[0].id');
  b.key('Escape'); assert.deepEqual(b.window.caderactDocument.lines(), before);
  b.launch(); b.point(100, 100); b.point(200, 200);
  assert.notEqual(b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()[0].id'), cancelled);
});
const invalidCases = [
  ['missing document ID', d => { delete d.id; }],
  ['missing object ID', (d, l) => { delete l.id; }],
  ['duplicate object ID', (d, l) => { Object.values(d.geometry.objects)[1].id = l.id; }],
  ['duplicate feature ID', (d, l) => { l.end.featureId = l.start.featureId; }],
  ['cross-line duplicate feature ID', (d, l) => { Object.values(d.geometry.objects)[1].start.featureId = l.end.featureId; }],
  ['missing feature ID', (d, l) => { delete l.start.featureId; }],
  ['unsupported type', (d, l) => { l.type = 'spline'; }],
  ['invalid layer reference', (d, l) => { l.layerId = 'missing'; }],
  ['invalid current layer', d => { d.currentLayerId = 'missing'; }],
  ['invalid start structure', (d, l) => { l.start = [0, 0]; }],
  ['missing end', (d, l) => { delete l.end; }],
  ['NaN', (d, l) => { l.start.x = NaN; }],
  ['Infinity', (d, l) => { l.end.y = Infinity; }],
  ['numeric string', (d, l) => { l.start.x = '10'; }],
  ['duplicate layer ID', d => { d.layers.other = { ...d.layers[d.currentLayerId] }; }],
];
for (const [name, mutate] of invalidCases) test(`validation rejects ${name} deterministically without mutation`, async () => {
  const b = await fixture(); const doc = structuredClone(b.window.caderactDocument.snapshot());
  mutate(doc, Object.values(doc.geometry.objects)[0]); const before = structuredClone(doc);
  const validate = b.window.CaderactDocument.validateDocument;
  const errors = Array.from(validate(doc)); assert.ok(errors.length > 0);
  assert.deepEqual(Array.from(validate(doc)), errors); assert.deepEqual(doc, before);
});
test('invalid writer input leaves authoritative state unchanged', async () => {
  const b = await fixture(); const before = b.window.caderactDocument.snapshot();
  const outcome = b.run('recordGateway.createAll([recordGateway.createLine({x:NaN,y:0},{x:1,y:2})])');
  assert.equal(outcome.status, 'validation-failed');
  assert.equal(b.window.caderactDocument.snapshot(), before);
});
test('unknown Line fields are rejected atomically on create and replace', async () => {
  const b = await browser();
  b.run(`
    window.__canonicalLine=recordGateway.createLine({x:0,y:0},{x:10,y:10});
    window.__beforeUnknownCreate={document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty};
    window.__unknownCreate=recordGateway.createAll([{...window.__canonicalLine,unexpected:'not-v1'}]);
  `);
  assert.equal(b.read('window.__unknownCreate.status'), 'validation-failed');
  assert.equal(b.run('modelReader.snapshot()===window.__beforeUnknownCreate.document'), true);
  assert.deepEqual(b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})'),
    b.read('({revision:window.__beforeUnknownCreate.revision,stateId:window.__beforeUnknownCreate.stateId,history:window.__beforeUnknownCreate.history,dirty:window.__beforeUnknownCreate.dirty})'));

  const symbolOutcome = b.run(`(() => {
    const symbol=Symbol('unknown');
    return recordGateway.createAll([{...window.__canonicalLine,[symbol]:'not-v1'}]);
  })()`);
  assert.equal(symbolOutcome.status, 'validation-failed');
  assert.equal(b.run('modelReader.snapshot()===window.__beforeUnknownCreate.document'), true);

  b.run(`
    recordGateway.createAll([window.__canonicalLine]);
    window.__beforeUnknownReplace={document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty};
    window.__unknownReplace=recordGateway.replace(window.__canonicalLine.id,{...window.__canonicalLine,unexpected:'not-v1'});
  `);
  assert.equal(b.read('window.__unknownReplace.status'), 'validation-failed');
  assert.equal(b.run('modelReader.snapshot()===window.__beforeUnknownReplace.document'), true);
  assert.deepEqual(b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})'),
    b.read('({revision:window.__beforeUnknownReplace.revision,stateId:window.__beforeUnknownReplace.stateId,history:window.__beforeUnknownReplace.history,dirty:window.__beforeUnknownReplace.dirty})'));
});
test('unknown nested endpoint fields are rejected atomically', async () => {
  const b = await browser();
  b.run(`
    const canonical=recordGateway.createLine({x:0,y:0},{x:1,y:1});
    window.__nestedBefore=modelReader.snapshot();
    window.__nestedOutcome=recordGateway.createAll([{...canonical,start:{...canonical.start,unexpected:true}}]);
  `);
  assert.equal(b.read('window.__nestedOutcome.status'), 'validation-failed');
  assert.equal(b.run('modelReader.snapshot()===window.__nestedBefore'), true);
  assert.equal(b.read('documentController.currentRevision'), 0);
  assert.deepEqual(b.read('documentController.historyInfo'), { entryCount: 0, cursor: 0 });
});
