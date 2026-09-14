'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

async function populated() {
  const b = await browser();
  b.run(`layerGateway.create('Details');
    window.__savedLayer=modelReader.layers().find(layer => layer.name === 'Details');
    window.__savedRecord=recordGateway.createLine({x:0.123456789012345,y:-8.5},{x:100.25,y:200.75});
    recordGateway.createAll([{...window.__savedRecord,layerId:window.__savedLayer.id}])`);
  return b;
}

test('save payload contains only versioned durable content in deterministic ID order', async () => {
  const b = await populated();
  const serialized = b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');
  const payload = JSON.parse(serialized);
  assert.equal(payload.fileVersion, 2);
  assert.deepEqual(Object.keys(payload), ['fileVersion', 'document']);
  assert.deepEqual(Object.keys(payload.document), [
    'id', 'name', 'formatVersion', 'units', 'dimensionStyle', 'defaultLayerId', 'currentLayerId', 'layers', 'records',
  ]);
  assert.deepEqual(payload.document.layers.map(layer => layer.id), [...payload.document.layers.map(layer => layer.id)].sort());
  assert.deepEqual(payload.document.records.map(record => record.id), [...payload.document.records.map(record => record.id)].sort());
  for (const runtimeField of ['history', 'revision', 'stateId', 'savedStateId', 'camera', 'zoom', 'preview']) {
    assert.equal(Object.hasOwn(payload.document, runtimeField), false);
  }
  assert.equal(b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())'), serialized);
});

test('serialize, load, and serialize restores exact durable content and stable IDs', async () => {
  const b = await populated();
  b.run('window.__serialized=window.CaderactPersistence.serializeDocument(modelReader.snapshot()); window.__loaded=window.CaderactPersistence.loadStore(window.__serialized)');
  assert.deepEqual(b.read('window.__loaded.reader.snapshot()'), b.read('modelReader.snapshot()'));
  assert.equal(b.run('window.CaderactPersistence.serializeDocument(window.__loaded.reader.snapshot())'), b.run('window.__serialized'));
  assert.deepEqual(b.read('window.__loaded.reader.records().map(record => [record.id,record.start.featureId,record.end.featureId,record.layerId])'),
    b.read('modelReader.records().map(record => [record.id,record.start.featureId,record.end.featureId,record.layerId])'));
  assert.deepEqual(b.read('window.__loaded.reader.layers()'), b.read('modelReader.layers()'));
});

test('a loaded store starts clean with fresh runtime identity and empty history', async () => {
  const b = await populated();
  const originalStateId = b.read('documentController.currentStateId');
  b.run('window.__loaded=window.CaderactPersistence.loadStore(window.CaderactPersistence.serializeDocument(modelReader.snapshot()))');
  assert.equal(b.read('window.__loaded.controller.currentRevision'), 0);
  assert.deepEqual(b.read('window.__loaded.controller.historyInfo'), { entryCount: 0, cursor: 0 });
  assert.equal(b.read('window.__loaded.controller.canUndo'), false);
  assert.equal(b.read('window.__loaded.controller.canRedo'), false);
  assert.equal(b.read('window.__loaded.controller.isDirty'), false);
  assert.equal(b.read('window.__loaded.controller.savedStateId'), b.read('window.__loaded.controller.currentStateId'));
  assert.notEqual(b.read('window.__loaded.controller.currentStateId'), originalStateId);
});

test('save acknowledgment pins the serialized state and cannot clean a newer state', async () => {
  const b = await populated();
  b.run('window.__save=window.CaderactPersistence.captureSave(modelReader,documentController)');
  const savedPayload = JSON.parse(b.run('window.__save.serialized'));
  assert.equal(savedPayload.document.layers.some(layer => layer.name === 'Later'), false);
  b.run('layerGateway.create("Later")');
  assert.equal(b.read('documentController.isDirty'), true);
  assert.equal(b.run('window.__save.acknowledge().status'), 'saved');
  assert.equal(b.read('documentController.savedStateId'), b.read('window.__save.stateId'));
  assert.notEqual(b.read('documentController.currentStateId'), b.read('window.__save.stateId'));
  assert.equal(b.read('documentController.isDirty'), true);
});

test('invalid, corrupt, and incompatible payloads are rejected without touching the active document', async () => {
  const b = await populated();
  const before = b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo})');
  const valid = JSON.parse(b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())'));
  const corruptions = [
    payload => { payload.fileVersion = 99; },
    payload => { delete payload.document.layers; },
    payload => { payload.document.layers.push({ ...payload.document.layers[0] }); },
    payload => { payload.document.records[0].layerId = 'missing'; },
    payload => { payload.document.defaultLayerId = 'missing'; },
    payload => { payload.document.units.length = 'yard'; },
    payload => { payload.document.records[0].type = 'circle'; },
    payload => { payload.document.records[0].start.x = null; },
    payload => { delete payload.document.records[0].start; },
  ];
  assert.throws(() => b.run('window.CaderactPersistence.loadStore("not json")'), /Invalid Caderact file/);
  for (const corrupt of corruptions) {
    const payload = structuredClone(valid); corrupt(payload);
    const source = JSON.stringify(payload);
    assert.throws(() => b.run(`window.CaderactPersistence.loadStore(${JSON.stringify(source)})`), /Invalid Caderact file/);
  }
  assert.deepEqual(b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo})'), before);
});

test('closed v1 persistence rejects unknown fields in every durable shape atomically', async () => {
  const b = await populated();
  const before = b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo})');
  const valid = JSON.parse(b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())'));
  const additions = [
    payload => { payload.unexpected = true; },
    payload => { payload.document.unexpected = true; },
    payload => { payload.document.units.unexpected = true; },
    payload => { payload.document.layers[0].unexpected = true; },
    payload => { payload.document.records[0].unexpected = true; },
    payload => { payload.document.records[0].start.unexpected = true; },
    payload => { payload.document.records[0].end.unexpected = true; },
  ];
  for (const addUnknown of additions) {
    const payload = structuredClone(valid); addUnknown(payload);
    const source = JSON.stringify(payload);
    assert.throws(() => b.run(`window.CaderactPersistence.loadStore(${JSON.stringify(source)})`), /unknown field/);
  }
  assert.deepEqual(b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo})'), before);
});

test('validator and persistence share the canonical lossless v1 Line shape', async () => {
  const b = await populated();
  const before = b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');
  assert.deepEqual(b.read('window.CaderactDocument.validateDocument(modelReader.snapshot())'), []);
  const payload = JSON.parse(before), line = payload.document.records[0];
  assert.deepEqual(Object.keys(line), b.read('window.CaderactDocument.V1_FIELDS.line'));
  assert.deepEqual(Object.keys(line.start), b.read('window.CaderactDocument.V1_FIELDS.endpoint'));
  b.context.__losslessSource = before;
  b.run('window.__losslessStore=window.CaderactPersistence.loadStore(__losslessSource)');
  assert.equal(b.run('window.CaderactPersistence.serializeDocument(window.__losslessStore.reader.snapshot())'), before);
});

test('transient Line draft and preview are not serialized', async () => {
  const b = await browser();
  b.launch(); b.point(400, 300); b.point(450, 300); b.point(500, 250, 'pointermove');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.draftSegments().length'), 1);
  assert.notEqual(b.run('window.caderactCommandRouter.activeSession.draft.preview()'), null);
  const payload = JSON.parse(b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())'));
  assert.deepEqual(payload.document.records, []);
  assert.equal(JSON.stringify(payload).includes('preview'), false);
});

test('A6 scene projection renders authoritative records from a loaded store', async () => {
  const b = await populated();
  const segments = b.run(`(() => {
    const loaded=window.CaderactPersistence.loadStore(window.CaderactPersistence.serializeDocument(modelReader.snapshot()));
    const builder=window.CaderactViewportScene.createSceneBuilder({
      viewportSettings,camera:viewportCamera,getViewportSize:()=>({width:800,height:600}),
      getRecords:()=>loaded.reader.records(),getDraftLines:()=>[],getPreview:()=>null,
    });
    return Array.from(builder.createScene().lineGroups[4].segments);
  })()`);
  assert.deepEqual(Array.from(segments), [400.6172790527344, 342.5, 901.25, -703.75]);
});
