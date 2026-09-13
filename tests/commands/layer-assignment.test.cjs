'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {browser}=require('../helpers/browser.cjs');
function seed(b){b.run('layerGateway.create("Source");layerGateway.create("Target");window.__source=modelReader.layers().find(x=>x.name==="Source");window.__target=modelReader.layers().find(x=>x.name==="Target");layerGateway.setCurrent(window.__source.id);window.__records=[recordGateway.createLine({x:0,y:0},{x:10,y:0}),recordGateway.createCircle({x:20,y:0},5),recordGateway.createPolyline([{x:0,y:10},{x:10,y:10}],false)];recordGateway.createAll(window.__records)')}
const snapshot=b=>b.read('modelReader.records().map(record=>({...record}))');

test('single and mixed geometry assignment preserves identity and geometry in one transaction',async()=>{
  const b=await browser();seed(b);const before=snapshot(b),revision=b.read('documentController.currentRevision'),current=b.read('modelReader.snapshot().currentLayerId'),ids=b.read('window.__records.map(x=>x.id)');b.run('window.caderactSelection.applyRecordIds(window.__records.map(x=>x.id))');
  const outcome=b.read('recordGateway.assignLayer(window.__records.map(x=>x.id),window.__target.id)');assert.equal(outcome.status,'committed');assert.equal(outcome.movedCount,3);assert.equal(b.read('documentController.currentRevision'),revision+1);assert.equal(b.read('modelReader.snapshot().currentLayerId'),current);assert.deepEqual(new Set(b.read('window.caderactSelection.selectedIds()')),new Set(ids));
  const after=snapshot(b);for(let i=0;i<after.length;i++){assert.equal(after[i].layerId,b.read('window.__target.id'));assert.deepEqual({...after[i],layerId:before[i].layerId},before[i])}
  b.run('window.caderactHistory.undo()');assert.deepEqual(snapshot(b),before);assert.deepEqual(new Set(b.read('window.caderactSelection.selectedIds()')),new Set(ids));b.run('window.caderactHistory.redo()');assert.ok(b.read('modelReader.records().every(x=>x.layerId===window.__target.id)'));
});

test('same-layer no-op creates no history while mixed ownership updates only necessary records atomically',async()=>{
  const b=await browser();seed(b);b.run('recordGateway.assignLayer([window.__records[0].id],window.__target.id)');let history=b.read('documentController.historyInfo.entryCount');assert.equal(b.read('recordGateway.assignLayer([window.__records[0].id],window.__target.id).status'),'no-op');assert.equal(b.read('documentController.historyInfo.entryCount'),history);
  const first=b.read('modelReader.records().find(x=>x.id===window.__records[0].id)');const outcome=b.read('recordGateway.assignLayer(window.__records.map(x=>x.id),window.__target.id)');assert.equal(outcome.movedCount,2);assert.equal(b.read('documentController.historyInfo.entryCount'),history+1);assert.deepEqual(b.read('modelReader.records().find(x=>x.id===window.__records[0].id)'),first);
});

test('target and stale source validation is all-or-nothing',async()=>{
  for(const setup of ['', 'layerGateway.setVisibility(window.__target.id,false)', 'layerGateway.setLocked(window.__target.id,true)']){const b=await browser();seed(b);if(setup)b.run(setup);const before=snapshot(b),history=b.read('documentController.historyInfo.entryCount'),expression=setup.includes('Visibility')?'target-layer-hidden':setup.includes('Locked')?'target-layer-locked':'unknown-layer',target=setup?'window.__target.id':'"missing"';assert.equal(b.run(`recordGateway.assignLayer(window.__records.map(x=>x.id),${target}).status`),expression);assert.deepEqual(snapshot(b),before);assert.equal(b.read('documentController.historyInfo.entryCount'),history)}
  for(const mutation of ['layerGateway.setVisibility(window.__source.id,false)','layerGateway.setLocked(window.__source.id,true)']){const b=await browser();seed(b);b.run(mutation);const before=snapshot(b);assert.equal(b.run('recordGateway.assignLayer(window.__records.map(x=>x.id),window.__target.id).status'),'selection-not-editable');assert.deepEqual(snapshot(b),before)}
  const stale=await browser();seed(stale);const before=snapshot(stale);assert.equal(stale.run('recordGateway.assignLayer([window.__records[0].id,"missing"],window.__target.id).status'),'selection-not-editable');assert.deepEqual(snapshot(stale),before);
});

test('explicit panel Assign action owns UI feedback and command gating',async()=>{
  const b=await browser();seed(b);assert.equal(b.layerAssignButton.disabled,true);b.run('window.caderactSelection.applyRecordIds([window.__records[0].id]);layerGateway.setCurrent(window.__target.id)');assert.equal(b.layerAssignButton.disabled,false);b.emit(b.layerAssignButton,'click');assert.equal(b.read('modelReader.records().find(x=>x.id===window.__records[0].id).layerId'),b.read('window.__target.id'));assert.equal(b.commandPrompt.children[0].textContent,'Moved 1 object to Target.');
  b.emit(b.layerAssignButton,'click');assert.equal(b.commandPrompt.children[0].textContent,'Selection is already on Target.');b.launch('Line');assert.equal(b.layerAssignButton.disabled,true);assert.equal(b.read('window.caderactLayers.assign().status'),'layer-action-blocked-active-command');
});

test('assigned layer IDs persist exactly through v1 Save/Open representation',async()=>{
  const b=await browser();seed(b);b.run('recordGateway.assignLayer(window.__records.map(x=>x.id),window.__target.id)');const serialized=b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');b.run(`window.__loaded=window.CaderactPersistence.loadStore(${JSON.stringify(serialized)})`);assert.deepEqual(b.read('window.__loaded.reader.records().map(x=>[x.id,x.layerId])'),b.read('modelReader.records().map(x=>[x.id,x.layerId])'));assert.equal(JSON.parse(serialized).fileVersion,1);
});
