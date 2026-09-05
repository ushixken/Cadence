const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

const layerId=b=>b.read('modelReader.layers().find(layer=>layer.id!==modelReader.snapshot().defaultLayerId)?.id');
const state=b=>b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo})');

test('layer list and current/default indicators derive from authoritative state',async()=>{
  const b=await browser();const doc=b.read('modelReader.snapshot()');
  assert.equal(b.layersList.children.length,1);
  const row=b.layersList.children[0];assert.equal(row.dataset.layerId,doc.defaultLayerId);
  assert.equal(row.getAttribute('aria-current'),'true');assert.equal(row.children[0].textContent,'Default');
  assert.equal(row.children[3].disabled,true);
});

test('create trims names, uses one transaction, and invalid names provide U5 feedback without mutation',async()=>{
  const b=await browser();const revision=b.read('documentController.currentRevision');
  assert.equal(b.run(`window.caderactLayers.create(' Details ').status`),'committed');
  assert.equal(b.read('documentController.currentRevision'),revision+1);assert.equal(b.layersList.children.length,2);
  assert.equal(b.read(`modelReader.layer(${JSON.stringify(layerId(b))}).name`),'Details');
  for(const [name,message] of [[' details ','A layer with that name already exists'],['   ','Layer name cannot be empty']]){
    const before=state(b);assert.notEqual(b.run(`window.caderactLayers.create(${JSON.stringify(name)}).status`),'committed');
    assert.deepEqual(state(b),before);assert.equal(b.input.placeholder,message);assert.equal(b.input.classList.contains('has-command-error'),true);
  }
});

test('switch current layer is transactional and new Line uses that authoritative layer',async()=>{
  const b=await browser();b.run(`window.caderactLayers.create('Walls')`);const id=layerId(b);
  const beforeRevision=b.read('documentController.currentRevision');
  b.emit(b.layersList.children.find(row=>row.dataset.layerId===id).children[0],'click');
  assert.equal(b.read('documentController.currentRevision'),beforeRevision+1);
  assert.equal(b.layersList.children.find(row=>row.dataset.layerId===id).getAttribute('aria-current'),'true');
  b.launch();b.point(100,100);b.point(150,150);b.key('Enter');
  assert.equal(b.read('modelReader.lines()[0].layerId'),id);
  b.run('window.caderactHistory.undo()');assert.equal(b.read('modelReader.lines().length'),0);
  b.run('window.caderactHistory.undo()');assert.notEqual(b.read('modelReader.snapshot().currentLayerId'),id);
  b.run('window.caderactHistory.redo()');assert.equal(b.read('modelReader.snapshot().currentLayerId'),id);
});

test('rename preserves identity and Undo/Redo restore exact names',async()=>{
  const b=await browser();b.run(`window.caderactLayers.create('Walls')`);const id=layerId(b);
  assert.equal(b.run(`window.caderactLayers.rename(${JSON.stringify(id)},' Exterior Walls ').status`),'committed');
  assert.equal(b.read(`modelReader.layer(${JSON.stringify(id)}).name`),'Exterior Walls');
  assert.notEqual(b.read('modelReader.snapshot().currentLayerId'),id);
  b.run('window.caderactHistory.undo()');assert.equal(b.read(`modelReader.layer(${JSON.stringify(id)}).name`),'Walls');
  b.run('window.caderactHistory.redo()');assert.equal(b.read(`modelReader.layer(${JSON.stringify(id)}).name`),'Exterior Walls');
});

test('delete follows A7 protection and exact history rules',async()=>{
  const b=await browser();const defaultId=b.read('modelReader.snapshot().defaultLayerId');
  assert.equal(b.run(`window.caderactLayers.remove(${JSON.stringify(defaultId)}).status`),'default-layer-required');
  assert.equal(b.input.placeholder,'The default layer cannot be deleted');
  b.run(`window.caderactLayers.create('Temporary')`);const temporary=layerId(b);
  assert.equal(b.run(`window.caderactLayers.remove(${JSON.stringify(temporary)}).status`),'committed');
  assert.equal(b.run(`modelReader.layer(${JSON.stringify(temporary)})`),null);
  b.run('window.caderactHistory.undo()');assert.equal(b.read(`modelReader.layer(${JSON.stringify(temporary)}).id`),temporary);
  b.run('window.caderactHistory.redo()');assert.equal(b.run(`modelReader.layer(${JSON.stringify(temporary)})`),null);
  b.run(`window.caderactLayers.create('Current')`);const current=layerId(b);b.run(`window.caderactLayers.setCurrent(${JSON.stringify(current)})`);
  const currentBefore=state(b);assert.equal(b.run(`window.caderactLayers.remove(${JSON.stringify(current)}).status`),'validation-failed');
  assert.deepEqual(state(b),currentBefore);assert.equal(b.input.placeholder,'The current layer cannot be deleted');
  b.run(`window.caderactLayers.setCurrent(${JSON.stringify(defaultId)})`);
  b.run(`window.caderactLayers.create('Objects')`);const objects=layerId(b);
  b.run(`window.caderactLayers.setCurrent(${JSON.stringify(objects)});window.__r=recordGateway.createLine({x:0,y:0},{x:1,y:1});recordGateway.createAll([window.__r])`);
  const before=state(b);assert.equal(b.run(`window.caderactLayers.remove(${JSON.stringify(objects)}).status`),'layer-in-use');
  assert.deepEqual(state(b),before);assert.equal(b.input.placeholder,'Layer cannot be deleted while objects use it');
});

test('all layer mutations are blocked during active commands and controls reflect the policy',async()=>{
  const b=await browser();b.run(`window.caderactLayers.create('Walls')`);const id=layerId(b);b.launch();
  const before=state(b);
  for(const expression of [`window.caderactLayers.create('Other')`,`window.caderactLayers.rename(${JSON.stringify(id)},'Other')`,`window.caderactLayers.remove(${JSON.stringify(id)})`,`window.caderactLayers.setCurrent(${JSON.stringify(id)})`]){
    assert.equal(b.run(`${expression}.status`),'layer-action-blocked-active-command');assert.deepEqual(state(b),before);
  }
  assert.equal(b.layerCreateButton.disabled,true);assert.ok(b.layersList.children.every(row=>row.children[0].disabled&&row.children[2].disabled&&row.children[3].disabled));
});

test('New/Open rebind layer UI and preserve IDs, current layer, and object references without duplicate actions',async()=>{
  const b=await browser();b.run(`window.caderactLayers.create('Walls')`);const id=layerId(b);
  b.run(`window.caderactLayers.setCurrent(${JSON.stringify(id)});window.__r=recordGateway.createLine({x:0,y:0},{x:1,y:1});recordGateway.createAll([window.__r]);
    window.__layerFile=window.CaderactPersistence.serializeDocument(modelReader.snapshot());
    window.__layerAdapters={confirmDiscard:async()=>true,writeFile:async()=>{},pickOpenFile:async()=>({name:'layers.caderact',text:async()=>window.__layerFile})};
    window.__layerFiles=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:window.__layerAdapters})`);
  await b.run('window.__layerFiles.newProject()');assert.equal(b.layersList.children.length,1);
  assert.equal(b.read('modelReader.snapshot().currentLayerId===modelReader.snapshot().defaultLayerId'),true);
  await b.run('window.__layerFiles.open()');
  assert.equal(b.read(`modelReader.layer(${JSON.stringify(id)}).name`),'Walls');
  assert.equal(b.read('modelReader.snapshot().currentLayerId'),id);assert.equal(b.read('modelReader.records()[0].layerId'),id);
  assert.equal(b.layersList.children.find(row=>row.dataset.layerId===id).getAttribute('aria-current'),'true');
  const revision=b.read('documentController.currentRevision');b.emit(b.layerCreateButton,'click');
  assert.equal(b.read('documentController.currentRevision'),revision+1);
  assert.equal(b.read(`modelReader.layers().some(layer=>layer.name==='Layer 1')`),true);
});
