'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

function state(b) {
  return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo})');
}
function nonDefaultLayer(b) {
  return b.read('modelReader.layers().find(layer => layer.id !== modelReader.snapshot().defaultLayerId)');
}

test('initial document has one immutable resolving default layer and deterministic layer reads', async () => {
  const b = await browser();
  const document = b.read('modelReader.snapshot()');
  assert.equal(Object.keys(document.layers).length, 1);
  assert.equal(document.defaultLayerId, document.currentLayerId);
  assert.equal(document.layers[document.defaultLayerId].name, 'Default');
  assert.deepEqual(b.read('modelReader.layers().map(layer => layer.id)'), [document.defaultLayerId]);
  assert.equal(b.run('Object.isFrozen(modelReader.layers())'), true);
  assert.equal(b.run('Object.isFrozen(modelReader.layer(modelReader.snapshot().defaultLayerId))'), true);
  assert.equal(b.run('modelReader.layer("missing")'), null);
  const before = b.read('modelReader.snapshot()');
  b.run('try { modelReader.layers()[0].name = "Changed" } catch {}; try { modelReader.layers().push({}) } catch {}');
  assert.deepEqual(b.read('modelReader.snapshot()'), before);
});

test('create, rename, and delete an unused layer use exact A4 history and preserve its ID', async () => {
  const b = await browser();
  assert.equal(b.run('layerGateway.create(" Details ").status'), 'committed');
  const created = nonDefaultLayer(b);
  assert.equal(created.name, 'Details');
  assert.equal(b.run(`layerGateway.rename(${JSON.stringify(created.id)}, "Annotations").status`), 'committed');
  assert.equal(b.read(`modelReader.layer(${JSON.stringify(created.id)}).name`), 'Annotations');
  assert.equal(b.run(`layerGateway.remove(${JSON.stringify(created.id)}).status`), 'committed');
  assert.equal(b.run(`modelReader.layer(${JSON.stringify(created.id)})`), null);
  assert.deepEqual(b.read('documentController.historyInfo'), { entryCount: 3, cursor: 3 });

  assert.equal(b.run('documentController.undo().status'), 'undone');
  assert.deepEqual(b.read(`modelReader.layer(${JSON.stringify(created.id)})`), { ...created, name: 'Annotations' });
  assert.equal(b.run('documentController.undo().status'), 'undone');
  assert.deepEqual(b.read(`modelReader.layer(${JSON.stringify(created.id)})`), created);
  assert.equal(b.run('documentController.undo().status'), 'undone');
  assert.equal(b.run(`modelReader.layer(${JSON.stringify(created.id)})`), null);
  for (let index = 0; index < 3; index++) assert.equal(b.run('documentController.redo().status'), 'redone');
  assert.equal(b.run(`modelReader.layer(${JSON.stringify(created.id)})`), null);
});

test('invalid and duplicate layer edits are atomic no-ops', async () => {
  const b = await browser();
  assert.equal(b.run('layerGateway.create("Model").status'), 'committed');
  const layer = nonDefaultLayer(b), before = state(b);
  for (const expression of [
    'layerGateway.create("   ")',
    'layerGateway.create(" model ")',
    `layerGateway.rename(${JSON.stringify(layer.id)}, " MODEL ")`,
    `layerGateway.rename(${JSON.stringify(layer.id)}, "")`,
    'layerGateway.rename("missing", "X")',
    'layerGateway.remove("missing")',
  ]) b.run(expression);
  assert.deepEqual(state(b), before);
});

test('default and referenced layers cannot be deleted and nonexistent assignment is rejected', async () => {
  const b = await browser();
  const defaultId = b.read('modelReader.snapshot().defaultLayerId');
  assert.equal(b.run(`layerGateway.remove(${JSON.stringify(defaultId)}).status`), 'default-layer-required');
  b.run('layerGateway.create("Objects")');
  const layer = nonDefaultLayer(b);
  b.run(`window.__layerLine=recordGateway.createLine({x:0,y:0},{x:10,y:10}); recordGateway.createAll([{...window.__layerLine,layerId:${JSON.stringify(layer.id)}}])`);
  const before = state(b);
  assert.equal(b.run(`layerGateway.remove(${JSON.stringify(layer.id)}).status`), 'layer-in-use');
  assert.equal(b.run('recordGateway.setLayer(window.__layerLine.id,"missing").status'), 'unknown-layer');
  assert.deepEqual(state(b), before);
});

test('object layer reassignment is one transaction and Undo/Redo restores exact references', async () => {
  const b = await browser();
  b.run('layerGateway.create("Alternate"); window.__record=recordGateway.createLine({x:1,y:2},{x:3,y:4}); recordGateway.createAll([window.__record])');
  const layer = nonDefaultLayer(b), defaultId = b.read('modelReader.snapshot().defaultLayerId');
  const beforeRevision = b.read('documentController.currentRevision');
  assert.equal(b.run(`recordGateway.setLayer(window.__record.id,${JSON.stringify(layer.id)}).status`), 'committed');
  assert.equal(b.read('modelReader.records()[0].layerId'), layer.id);
  assert.equal(b.read('documentController.currentRevision'), beforeRevision + 1);
  assert.equal(b.run('documentController.undo().status'), 'undone');
  assert.equal(b.read('modelReader.records()[0].layerId'), defaultId);
  assert.equal(b.run('documentController.redo().status'), 'redone');
  assert.equal(b.read('modelReader.records()[0].layerId'), layer.id);
});

test('one multi-property record replacement produces one publication, revision, and history entry', async () => {
  const b = await browser();
  b.run('window.__record=recordGateway.createLine({x:0,y:0},{x:1,y:1}); recordGateway.createAll([window.__record])');
  const before = state(b);
  const outcome = b.run(`recordGateway.updateProperties(window.__record.id,{start:{...window.__record.start,x:25},end:{...window.__record.end,y:50}})`);
  assert.equal(outcome.status, 'committed');
  assert.equal(b.read('documentController.currentRevision'), before.revision + 1);
  assert.equal(b.read('documentController.historyInfo.entryCount'), before.history.entryCount + 1);
  assert.equal(outcome.changes.length, 1);
  assert.equal(b.read('modelReader.records()[0].start.x'), 25);
  assert.equal(b.read('modelReader.records()[0].end.y'), 50);
});

test('cross-collection validation is atomic and successful edits branch correctly after Undo', async () => {
  const b = await browser();
  const defaultId = b.read('modelReader.snapshot().defaultLayerId');
  const before = state(b);
  const failed = b.run(`(() => { const tx=documentController.beginTransaction(); tx.removeIn('layers',${JSON.stringify(defaultId)}); return tx.publish() })()`);
  assert.equal(failed.status, 'validation-failed');
  assert.deepEqual(state(b), before);

  b.run('layerGateway.create("Old branch"); layerGateway.create("Undone layer"); documentController.undo()');
  assert.equal(b.read('documentController.canRedo'), true);
  const branch = b.run('layerGateway.create("New branch")');
  assert.equal(branch.status, 'committed');
  assert.equal(b.read('documentController.canRedo'), false);
  assert.equal(b.run('modelReader.layers().some(layer => layer.name === "Undone layer")'), false);
  assert.equal(b.run('modelReader.layers().some(layer => layer.name === "New branch")'), true);
});

test('rolled-back and stale layer transactions leave document, history, and identity unchanged', async () => {
  const b = await browser();
  const beforeRollback = state(b);
  b.run(`(() => { const tx=documentController.beginTransaction(); tx.createIn('layers','rolled_back_layer',{id:'rolled_back_layer',name:'Rolled back',visible:true,locked:false}); tx.rollback() })()`);
  assert.deepEqual(state(b), beforeRollback);

  const result = b.run(`(() => {
    const defaultId='stale_default', hooks={};
    let document={id:'stale_doc',name:'Test',formatVersion:1,units:{length:'mm'},geometry:{objects:{}},layers:{[defaultId]:{id:defaultId,name:'Default',visible:true,locked:false}},defaultLayerId:defaultId,currentLayerId:defaultId};
    const freeze=value => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value) } return value };
    document=freeze(document);
    const controller=window.DocumentController.createController({
      getDocument:()=>document,
      getCollections:value=>({records:value.geometry.objects,layers:value.layers}),
      assembleDocument:(base,collections)=>({...base,geometry:{objects:collections.records},layers:collections.layers}),
      validate:window.CaderactDocument.validateDocument,
      onPublish:value=>{document=value}, freeze,
    },hooks);
    const tx=controller.beginTransaction();
    tx.createIn('layers','stale_layer',{id:'stale_layer',name:'Stale',visible:true,locked:false});
    const before={document,revision:controller.currentRevision,stateId:controller.currentStateId,history:controller.historyInfo};
    hooks.forceRevision();
    const outcome=tx.publish();
    return {outcome,before,after:{document,revision:controller.currentRevision,stateId:controller.currentStateId,history:controller.historyInfo}};
  })()`);
  assert.equal(result.outcome.status, 'stale');
  assert.deepEqual(result.after.document, result.before.document);
  assert.equal(result.after.stateId, result.before.stateId);
  assert.deepEqual(result.after.history, result.before.history);
  assert.equal(result.after.revision, result.before.revision + 1);
});

test('A6 rendering continues to project authoritative records after layer reassignment', async () => {
  const b = await browser();
  b.run('layerGateway.create("Render layer"); window.__record=recordGateway.createLine({x:-10,y:5},{x:20,y:-15}); recordGateway.createAll([window.__record]); requestRender()');
  b.flush();
  const before = Array.from(b.renders.at(-1).lineGroups[4].segments);
  const layer = nonDefaultLayer(b);
  b.run(`recordGateway.setLayer(window.__record.id,${JSON.stringify(layer.id)}); requestRender()`);
  b.flush();
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[4].segments), before);
  assert.equal(b.read('modelReader.records()[0].layerId'), layer.id);
});
