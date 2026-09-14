'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {browser}=require('../helpers/browser.cjs');
const typed=(b,value)=>{b.input.value=value;b.emit(b.input,'input');b.key('Enter',b.input)};
function seed(b){b.run('layerGateway.create("Work");window.__layer=modelReader.layers().find(layer=>layer.name==="Work");layerGateway.setCurrent(window.__layer.id);window.__record=recordGateway.createLine({x:0,y:0},{x:20,y:0});recordGateway.createAll([window.__record]);layerGateway.setCurrent(modelReader.snapshot().defaultLayerId)')}

test('visibility filters renderer-neutral scene, selection, window query, and Select All while Show restores it',async()=>{
  const b=await browser();seed(b);assert.equal(b.read('modelReader.visibleRecords().length'),1);b.flush();assert.equal(b.renders.at(-1).lineGroups.some(group=>group.segments.length),true);
  b.run('window.caderactLayers.setVisibility(window.__layer.id,false)');b.flush();assert.equal(b.read('modelReader.visibleRecords().length'),0);assert.equal(b.renders.at(-1).lineGroups[4].segments.length,0);
  b.point(400,300);b.point(400,300,'pointerup');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);b.key('a',b.document,{ctrlKey:true});assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);
  assert.deepEqual(b.read('window.CaderactSelectionBox.query({start:{x:350,y:250},current:{x:500,y:350},records:modelReader.editableRecords(),worldToScreen}).recordIds'),[]);
  b.run('window.caderactLayers.setVisibility(window.__layer.id,true)');b.flush();assert.equal(b.read('modelReader.visibleRecords().length'),1);
});

test('locked geometry renders and remains an Osnap/Track reference but is not selectable or grippable',async()=>{
  const b=await browser();seed(b);b.run('window.caderactLayers.setLocked(window.__layer.id,true)');b.flush();assert.equal(b.read('modelReader.visibleRecords().length'),1);assert.equal(b.read('modelReader.editableRecords().length'),0);assert.equal(b.renders.at(-1).lineGroups.some(group=>group.segments.length),true);
  b.point(400,300);b.point(400,300,'pointerup');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);b.key('a',b.document,{ctrlKey:true});assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);assert.deepEqual(b.read('window.caderactGrips.displayGrips()'),[]);
  b.launch('Line');b.point(400,300,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');b.advance(500);assert.ok(b.read('window.caderactViewport.getObjectSnapTrackingState().acquired'));
});

test('hiding a tracked source clears acquisition while locking it preserves acquisition',async()=>{
  const hidden=await browser();seed(hidden);hidden.launch('Line');hidden.point(400,300,'pointermove');hidden.advance(500);assert.ok(hidden.read('window.caderactViewport.getObjectSnapTrackingState().acquired'));hidden.run('layerGateway.setVisibility(window.__layer.id,false)');assert.equal(hidden.read('window.caderactViewport.getObjectSnapTrackingState().acquired'),null);hidden.point(400,300,'pointermove');assert.notEqual(hidden.read('activeSnapResult?.kind||null'),'endpoint');
  const locked=await browser();seed(locked);locked.launch('Line');locked.point(400,300,'pointermove');locked.advance(500);locked.run('layerGateway.setLocked(window.__layer.id,true)');assert.ok(locked.read('window.caderactViewport.getObjectSnapTrackingState().acquired'));
});

test('current hide/lock atomically prefers usable Default and refuses when no replacement exists',async()=>{
  for(const operation of ['setVisibility(window.__layer.id,false)','setLocked(window.__layer.id,true)']){const b=await browser();seed(b);b.run('layerGateway.setCurrent(window.__layer.id)');const before=b.read('documentController.currentRevision');assert.equal(b.run(`layerGateway.${operation}.status`),'committed');assert.equal(b.read('modelReader.snapshot().currentLayerId'),b.read('modelReader.snapshot().defaultLayerId'));assert.equal(b.read('documentController.currentRevision'),before+1);b.run('window.caderactHistory.undo()');assert.equal(b.read('modelReader.snapshot().currentLayerId'),b.read('window.__layer.id'));b.run('window.caderactHistory.redo()');assert.equal(b.read('modelReader.snapshot().currentLayerId'),b.read('modelReader.snapshot().defaultLayerId'))}
  const only=await browser();assert.equal(only.run('layerGateway.setLocked(modelReader.snapshot().defaultLayerId,true).status'),'no-usable-current-layer');assert.equal(only.read('modelReader.layers()[0].locked'),false);
});

test('selected records reconcile on layer state and stale modify sessions cannot bypass protection',async()=>{
  for(const stateChange of ['setVisibility(window.__layer.id,false)','setLocked(window.__layer.id,true)']){const b=await browser();seed(b);b.point(450,300);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[b.read('window.__record.id')]);b.run(`layerGateway.${stateChange}`);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);assert.deepEqual(b.read('window.caderactGrips.displayGrips()'),[])}
  const stale=await browser();seed(stale);stale.point(450,300);stale.launch('Move');stale.run('layerGateway.setLocked(window.__layer.id,true)');typed(stale,'0,0');typed(stale,'10,0');assert.equal(stale.read('modelReader.records()[0].start.x'),0);assert.equal(stale.read('documentController.historyInfo.entryCount')>0,true);
  assert.equal(stale.run('recordGateway.removeAll([window.__record.id]).status'),'record-layer-unavailable');
});

test('hidden geometry does not snap, locked geometry does, and Grid stays independent',async()=>{
  const hidden=await browser();seed(hidden);hidden.run('layerGateway.setVisibility(window.__layer.id,false)');hidden.launch('Line');hidden.point(403,298,'pointermove');assert.equal(hidden.read('activeSnapResult.snapped'),false);
  const locked=await browser();seed(locked);locked.run('layerGateway.setLocked(window.__layer.id,true)');locked.launch('Line');locked.point(403,298,'pointermove');assert.equal(locked.read('activeSnapResult.kind'),'endpoint');
  const grid=await browser();seed(grid);grid.run('layerGateway.setVisibility(window.__layer.id,false);window.caderactViewport.setGridSnapEnabled(true)');grid.launch('Line');grid.point(463,238,'pointermove');assert.equal(grid.read('activeSnapResult.kind'),'grid');
});

test('panel controls expose independent accessible state and persistence keeps visible/locked exactly',async()=>{
  const b=await browser();seed(b);let row=b.layersList.children.find(row=>row.dataset.layerId===b.read('window.__layer.id'));assert.equal(row.children[0].getAttribute('aria-pressed'),'true');assert.equal(row.children[1].getAttribute('aria-pressed'),'false');
  b.emit(row.children[0],'click');row=b.layersList.children.find(row=>row.dataset.layerId===b.read('window.__layer.id'));assert.equal(row.children[0].getAttribute('aria-pressed'),'false');assert.notEqual(b.read('modelReader.snapshot().currentLayerId'),b.read('window.__layer.id'));
  b.emit(row.children[0],'click');b.emit(row.children[1],'click');const serialized=b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');b.run(`window.__loaded=window.CaderactPersistence.loadStore(${JSON.stringify(serialized)})`);assert.equal(b.read('window.__loaded.reader.layer(window.__layer.id).visible'),true);assert.equal(b.read('window.__loaded.reader.layer(window.__layer.id).locked'),true);assert.equal(JSON.parse(serialized).fileVersion,2);
});
