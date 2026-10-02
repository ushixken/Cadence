'use strict';

// Deliberately outside npm test's fast glob. Run with:
// node --test tests/reliability/beta2-torture.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {browser}=require('../helpers/browser.cjs');

function measure(label,run){const start=performance.now();const result=run();return {label,ms:Math.round(performance.now()-start),result}}
function state(b){return b.read('({revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty})')}
function typed(b,value){b.input.value=value;b.emit(b.input,'input');b.key('Enter',b.input)}

test('BETA2 1,200+ history operations retain exact create/delete state and IDs',async()=>{
  const b=await browser({commands:false});
  const samples=[];
  samples.push(measure('create 300',()=>b.read(`(()=>{const ids=[];for(let i=0;i<300;i++){const record=recordGateway.createLine({x:i,y:0},{x:i+1,y:1});const result=recordGateway.createAll([record]);if(result.status!=='committed')throw Error(result.status);ids.push(record.id)}window.__stressIds=ids;return modelReader.records().length})()`)));
  const created=b.read('modelReader.snapshot()');
  samples.push(measure('delete 300',()=>b.read(`(()=>{for(const id of window.__stressIds){const result=recordGateway.removeAll([id]);if(result.status!=='committed')throw Error(result.status)}return modelReader.records().length})()`)));
  assert.equal(b.read('modelReader.records().length'),0);
  samples.push(measure('undo 300 deletes',()=>b.read(`(()=>{for(let i=0;i<300;i++)if(documentController.undo().status!=='undone')throw Error('undo deletion');return modelReader.records().length})()`)));
  assert.deepEqual(b.read('modelReader.snapshot()'),created);
  samples.push(measure('undo 300 creates',()=>b.read(`(()=>{for(let i=0;i<300;i++)if(documentController.undo().status!=='undone')throw Error('undo creation');return modelReader.records().length})()`)));
  assert.equal(b.read('modelReader.records().length'),0);
  samples.push(measure('redo 600',()=>b.read(`(()=>{for(let i=0;i<600;i++)if(documentController.redo().status!=='redone')throw Error('redo');return modelReader.records().length})()`)));
  assert.equal(b.read('modelReader.records().length'),0);
  assert.deepEqual(b.read('documentController.historyInfo'),{entryCount:600,cursor:600});
  console.log('BETA2 history:',JSON.stringify(samples.map(({label,ms})=>({label,ms}))));
});

test('BETA2 repeated partial-command switching and Escape leave no geometry or transient command',async()=>{
  const b=await browser();const before=state(b);
  for(let i=0;i<100;i++){
    b.launch('Line');typed(b,`${i},0`);
    b.run('window.caderactCommandRouter.execute("Circle")');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Circle');
    b.key('Escape',b.canvas);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);
  }
  assert.equal(b.read('modelReader.records().length'),0);
  assert.deepEqual(state(b),before);
  assert.equal(b.read('window.caderactViewport.getDynamicInputState().visible'),false);
});

test('BETA2 10k records survive scene, large selection/filter, isolation, native round trip',async()=>{
  const b=await browser({commands:false});const memoryBefore=process.memoryUsage().heapUsed;
  const samples=[];
  samples.push(measure('create 10k',()=>b.read(`(()=>{layerGateway.create('Stress');const layer=modelReader.layers().find(item=>item.name==='Stress');window.__stressLayer=layer.id;const records=Array.from({length:10000},(_,i)=>recordGateway.createLine({x:i%100,y:Math.floor(i/100)},{x:i%100+0.5,y:Math.floor(i/100)+0.5}));const result=recordGateway.createAll(records);if(result.status!=='committed')throw Error(result.status);return modelReader.records().length})()`)));
  samples.push(measure('scene 10k',()=>b.read('sceneBuilder.createRenderScene().worldGeometry.recordCount')));
  if(global.gc)global.gc();const retainedBefore=global.gc?process.memoryUsage().heapUsed:null;
  samples.push(measure('200 camera renders',()=>b.read(`(()=>{const world=sceneBuilder.createRenderScene().worldGeometry;for(let i=0;i<200;i++){camera.panX+=.25;camera.zoom*=1.0001;if(sceneBuilder.createRenderScene().worldGeometry!==world)throw Error('camera rebuilt geometry')}return world.recordCount})()`)));
  if(global.gc)global.gc();const retainedAfter=global.gc?process.memoryUsage().heapUsed:null;
  samples.push(measure('select all',()=>b.read('window.caderactViewport.selectAllCommittedGeometry().selectedIds.length')));
  assert.equal(b.read('window.caderactSelection.selectedIds().length'),10000);
  samples.push(measure('filter 10k',()=>b.read('window.caderactViewport.selectByFilter({type:"line"}).selectedIds.length')));
  assert.equal(b.read('window.caderactSelection.selectedIds().length'),10000);
  b.run('window.caderactViewport.setLayerIsolation(window.__stressLayer)');assert.equal(b.read('window.caderactSelection.selectedIds().length'),0);
  b.run('window.caderactViewport.clearLayerIsolation()');
  samples.push(measure('native serialize/parse',()=>b.read(`(()=>{const text=window.CaderactPersistence.serializeDocument(modelReader.snapshot());const loaded=window.CaderactPersistence.loadStore(text);return {length:text.length,records:loaded.reader.records().length}})()`)));
  assert.equal(samples.at(-1).result.records,10000);
  console.log('BETA2 large:',JSON.stringify({samples,heapChangeMiB:Math.round((process.memoryUsage().heapUsed-memoryBefore)/1048576),retainedCameraChangeMiB:retainedBefore===null?null:Math.round((retainedAfter-retainedBefore)/1048576)}));
});

test('BETA2 50k document scene completes without spread/stack failure',async()=>{
  const b=await browser({commands:false});
  const samples=[];
  samples.push(measure('create 50k',()=>b.read(`(()=>{const records=Array.from({length:50000},(_,i)=>recordGateway.createLine({x:i%250,y:Math.floor(i/250)},{x:i%250+1,y:Math.floor(i/250)+1}));const result=recordGateway.createAll(records);if(result.status!=='committed')throw Error(result.status);return modelReader.records().length})()`)));
  samples.push(measure('scene 50k',()=>b.read('sceneBuilder.createRenderScene().worldGeometry.recordCount')));
  assert.equal(samples[0].result,50000);assert.equal(samples[1].result,50000);
  console.log('BETA2 50k:',JSON.stringify(samples));
});

test('BETA2 repeated visibility, lock and isolation changes keep selection within editable records',async()=>{
  const b=await browser({commands:false});
  const seeded=b.read(`(()=>{layerGateway.create('Visible');layerGateway.create('Hidden');layerGateway.create('Locked');const visible=modelReader.layers().find(item=>item.name==='Visible'),hidden=modelReader.layers().find(item=>item.name==='Hidden'),locked=modelReader.layers().find(item=>item.name==='Locked');const records=Array.from({length:300},(_,i)=>recordGateway.createLine({x:i,y:0},{x:i,y:1}));recordGateway.createAll(records);recordGateway.assignLayer(records.slice(0,100).map(item=>item.id),visible.id);recordGateway.assignLayer(records.slice(100,200).map(item=>item.id),hidden.id);recordGateway.assignLayer(records.slice(200).map(item=>item.id),locked.id);layerGateway.setVisibility(hidden.id,false);layerGateway.setLocked(locked.id,true);return{visible:visible.id,hidden:hidden.id,locked:locked.id}})()`);
  for(let i=0;i<100;i++){
    b.window.__layer=seeded.visible;
    assert.equal(b.read('window.caderactViewport.selectAllCommittedGeometry().selectedIds.length'),100);
    assert.equal(b.read('window.caderactViewport.invertSelection().selectedIds.length'),0);
    b.run('window.caderactViewport.setLayerIsolation(window.__layer)');
    assert.equal(b.read('window.caderactViewport.selectByFilter({type:"line"}).selectedIds.length'),100);
    b.run('window.caderactViewport.clearLayerIsolation()');
  }
  assert.equal(b.read('modelReader.records().length'),300);
});

test('BETA2 nested Blocks, Groups, Hatches and annotations survive scene/plot/native repetition',async()=>{
  const b=await browser({commands:false});
  const result=b.read(`(()=>{const leaf=blockDefinitionGateway.create({name:'Leaf',records:[recordGateway.createLine({x:0,y:0},{x:2,y:0}),recordGateway.createCircle({x:1,y:1},.5)]}).definition;const nested=blockDefinitionGateway.create({name:'Nested',records:[recordGateway.createBlockInstance({definitionId:leaf.id,insertionPoint:{x:0,y:0}}),recordGateway.createLine({x:0,y:0},{x:0,y:3})]}).definition;const records=[];for(let i=0;i<40;i++){records.push(recordGateway.createBlockInstance({definitionId:nested.id,insertionPoint:{x:i*5,y:0}}));records.push(recordGateway.createText({insertionPoint:{x:i*5,y:5},text:'N'+i,height:1,rotation:0}));records.push(recordGateway.createHatch([recordGateway.createCircle({x:i*5,y:-5},1)],{kind:'solid'}));records.push(recordGateway.createLinearDimension({mode:'horizontal',firstPoint:{x:i*5,y:0},secondPoint:{x:i*5+2,y:0},dimensionLinePoint:{x:i*5+1,y:-2}}))}const published=recordGateway.createAll(records);if(published.status!=='committed')throw Error(published.status);for(let i=0;i<10;i++){const group=groupGateway.createGroup([records[i*4].id,records[i*4+1].id],{name:'G'+i});if(group.status!=='committed')throw Error(group.status)}const scene=sceneBuilder.createRenderScene();const layout=modelReader.layouts()[0];window.caderactLayoutContext.switchToLayout(layout.id);const plot=window.CaderactPlotOutput.prepare();let text=window.CaderactPersistence.serializeDocument(modelReader.snapshot());for(let i=0;i<5;i++){const store=window.CaderactPersistence.loadStore(text);text=window.CaderactPersistence.serializeDocument(store.reader.snapshot())}return {records:modelReader.records().length,groups:modelReader.groups().length,sceneRecords:scene.worldGeometry.recordCount,plotStatus:plot.status,plotSegments:plot.scene.segments.length,nativeRecords:window.CaderactPersistence.loadStore(text).reader.records().length}})()`);
  assert.equal(result.records,160);assert.equal(result.groups,10);assert.equal(result.nativeRecords,160);assert.equal(result.plotStatus,'ready');assert.ok(result.plotSegments>0);
});

test('BETA2 Layout/view camera chains and document replacement do not leak editor state',async()=>{
  const b=await browser({commands:false});b.resize(800,600,2);
  const ids=b.read(`(()=>{const ids=[modelReader.layouts()[0].id];for(let i=2;i<=5;i++)ids.push(window.caderactDocumentSession.layoutGateway.create('Stress '+i).layout.id);for(const id of ids)window.caderactDocumentSession.layoutGateway.createViewport(id,{frame:{x:40,y:40,width:80,height:60},viewCenter:{x:5,y:5},scale:10,locked:false});camera.zoom=7.25;camera.panX=112.5;camera.panY=299.25;return ids})()`);
  const before=state(b),modelCamera=b.read('({...camera})');
  for(let cycle=0;cycle<40;cycle++)for(const id of ids){b.window.__targetLayout=id;b.run('window.caderactLayoutContext.switchToLayout(window.__targetLayout)');b.run(`camera.panX+=${cycle%2?1:-1};camera.zoom*=1.0001`)}
  b.run('window.caderactLayoutContext.switchToModel()');assert.deepEqual(b.read('({...camera})'),modelCamera);assert.deepEqual(state(b),before);
  b.run('window.caderactDocumentSession.replaceStore(window.CaderactDocument.createStore({initiallySaved:true}),{reason:"beta2-replacement"})');
  assert.equal(b.read('window.caderactLayoutContext.snapshot().kind'),'model');assert.deepEqual(b.read('({...camera})'),{zoom:5,panX:400,panY:300});
  b.resize(320,240,1.5);b.flush();assert.ok(b.read('Number.isFinite(camera.panX)&&Number.isFinite(camera.panY)&&Number.isFinite(camera.zoom)'));
});

test('BETA2 repeated DXF generations and malformed inputs never touch active drawing',async()=>{
  const b=await browser({commands:false});
  b.run(`recordGateway.createAll([recordGateway.createLine({x:0,y:0},{x:20,y:10}),recordGateway.createPolyline([{x:0,y:0},{x:5,y:0},{x:5,y:5}],false),recordGateway.createCircle({x:5,y:5},2),recordGateway.createText({insertionPoint:{x:2,y:8},text:'STRESS',height:1,rotation:0})]);window.__dxfBaseline=window.CaderactDxfExport.exportDocument(modelReader.snapshot()).text;window.__nativeBaseline=window.CaderactPersistence.serializeDocument(modelReader.snapshot())`);
  const before=state(b),document=b.read('modelReader.snapshot()');
  const result=b.read(`(()=>{let source=window.__dxfBaseline;let count=0;for(let i=0;i<15;i++){const imported=window.CaderactDxfImport.createStore(source);count=imported.store.reader.records().length;source=window.CaderactDxfExport.exportDocument(imported.store.reader.snapshot()).text}return {count,bytes:source.length}})()`);
  assert.equal(result.count,4);
  for(const invalid of ['0\nSECTION\n2', '0\nSECTION\n2\nENTITIES\n0\nLINE\n10\nNaN\n0\nENDSEC\n0\nEOF\n']){b.window.__bad=invalid;assert.throws(()=>b.run('window.CaderactDxfImport.createStore(window.__bad)'))}
  for(const invalid of ['{','null','{"format":"caderact","version":999}']){b.window.__bad=invalid;assert.throws(()=>b.run('window.CaderactPersistence.loadStore(window.__bad)'))}
  assert.deepEqual(b.read('modelReader.snapshot()'),document);assert.deepEqual(state(b),before);
});

test('BETA2 2k-entity DXF survives five import/export generations without semantic loss',async()=>{
  const b=await browser({commands:false});
  const samples=[];
  samples.push(measure('seed/export 2k',()=>b.read(`(()=>{const records=Array.from({length:2000},(_,i)=>recordGateway.createLine({x:i,y:i%10},{x:i+1,y:i%10+1}));recordGateway.createAll(records);window.__largeDxf=window.CaderactDxfExport.exportDocument(modelReader.snapshot()).text;return window.__largeDxf.length})()`)));
  samples.push(measure('five DXF generations',()=>b.read(`(()=>{let source=window.__largeDxf;for(let i=0;i<5;i++){const imported=window.CaderactDxfImport.createStore(source);if(imported.store.reader.records().length!==2000)throw Error('entity count changed');source=window.CaderactDxfExport.exportDocument(imported.store.reader.snapshot()).text}return{bytes:source.length,records:window.CaderactDxfImport.createStore(source).store.reader.records().length}})()`)));
  assert.equal(samples[1].result.records,2000);
  console.log('BETA2 DXF:',JSON.stringify(samples));
});

test('BETA2 repeated native Save/Open/continue and controlled failure preserve file authority',async()=>{
  const b=await browser();
  b.run(`window.__writes=[];window.__payload='';window.__failWrite=false;window.__badOpen=false;window.__actions=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:{confirmDiscard:async()=>true,pickSaveFile:async()=>({status:'unsupported'}),pickOpenFile:async()=>({name:'Torture.caderact',text:async()=>window.__badOpen?'{':window.__payload}),writeFile:async request=>{if(window.__failWrite)throw Error('controlled write failure');window.__payload=request.serialized;window.__writes.push(request);return{status:'committed'}}}})`);
  for(let i=0;i<12;i++){
    b.window.__next=i;
    assert.equal(b.read(`(()=>{const line=recordGateway.createLine({x:window.__next,y:0},{x:window.__next,y:1});return recordGateway.createAll([line]).status})()`),'committed');
    assert.equal(b.read('documentController.isDirty'),true);
    assert.equal((await b.run('window.__actions.save()')).status,'save-completed');
    assert.equal(b.read('documentController.isDirty'),false);
    assert.equal((await b.run('window.__actions.open()')).status,'open-completed');
    assert.equal(b.read('modelReader.records().length'),i+1);
  }
  assert.equal(b.read('window.__writes.length'),12);
  b.run('recordGateway.createAll([recordGateway.createCircle({x:0,y:0},2)]);window.__failWrite=true');
  const beforeFailure=state(b),documentBeforeFailure=b.read('modelReader.snapshot()');
  assert.equal((await b.run('window.__actions.save()')).status,'save-failed');
  assert.deepEqual(state(b),beforeFailure);assert.deepEqual(b.read('modelReader.snapshot()'),documentBeforeFailure);
  b.run('window.__badOpen=true');assert.equal((await b.run('window.__actions.open()')).status,'open-failed');
  assert.deepEqual(state(b),beforeFailure);assert.deepEqual(b.read('modelReader.snapshot()'),documentBeforeFailure);
});

test('BETA2 repeated autosave, recovery classification, and failed application remain atomic',async()=>{
  const b=await browser();
  b.run(`window.__storage=window.CaderactRecoveryStorage.createMemoryStorage();window.__fs=window.CaderactDocumentFileState.create();window.__auto=window.CaderactRecoveryStorage.createAutosave({session:window.caderactDocumentSession,fileState:window.__fs,storage:window.__storage});window.__auto.start()`);
  for(let i=0;i<15;i++){
    b.window.__next=i;
    b.run('recordGateway.createAll([recordGateway.createLine({x:window.__next,y:0},{x:window.__next,y:1})])');
    assert.equal((await b.run('window.__auto.flush()')).status,'autosave-completed');
  }
  b.run('window.__validation=window.CaderactRecoveryValidation.create({storage:window.__storage})');
  const candidates=(await b.run('window.__validation.classifyAll()')).candidates;
  assert.equal(candidates.filter(candidate=>candidate.classification==='valid-newer').length,1);
  const before=state(b),drawing=b.read('modelReader.snapshot()');
  b.window.__forged={...candidates[0],payloadFingerprint:'0'.repeat(64)};
  const rejected=await b.run('window.__validation.apply(window.__forged,{session:window.caderactDocumentSession,fileState:window.__fs,autosave:window.__auto,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport})');
  assert.notEqual(rejected.status,'recovery-applied');assert.deepEqual(state(b),before);assert.deepEqual(b.read('modelReader.snapshot()'),drawing);
  b.window.__candidate=candidates[0];
  b.run('window.caderactDocumentSession.replaceStore(window.CaderactDocument.createStore({initiallySaved:true}),{reason:"beta2-crash"})');
  assert.equal((await b.run('window.__validation.apply(window.__candidate,{session:window.caderactDocumentSession,fileState:window.__fs,autosave:window.__auto,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport})')).status,'recovery-applied');
  assert.equal(b.read('modelReader.records().length'),15);
});

test('BETA2 independent Layout Model Views retain center/scale/lock through navigation and Undo/Redo',async()=>{
  const b=await browser({commands:false});b.resize(900,600);
  const modelCamera=b.read('({...camera})');
  const setup=b.read(`(()=>{const layout=modelReader.layouts()[0],first=layout.viewports[layout.viewportOrder[0]];window.caderactDocumentSession.layoutGateway.updateViewport(layout.id,first.id,{frame:{x:30,y:30,width:80,height:60}});const second=window.caderactDocumentSession.layoutGateway.createViewport(layout.id,{frame:{x:180,y:30,width:80,height:60},viewCenter:{x:100,y:100},scale:25,locked:false}).viewport;window.caderactLayoutContext.switchToLayout(layout.id);return{layoutId:layout.id,firstId:first.id,secondId:second.id}})()`);
  const before=b.read(`modelReader.layout(${JSON.stringify(setup.layoutId)})`);
  b.run(`layoutInteraction.activateAt(worldToScreen(80,60));layoutInteraction.begin();layoutInteraction.navigate({dx:40,dy:20,factor:1.5,screen:worldToScreen(80,60)});layoutInteraction.commit()`);
  const afterFirst=b.read(`modelReader.layout(${JSON.stringify(setup.layoutId)})`);
  assert.notDeepEqual(afterFirst.viewports[setup.firstId].viewCenter,before.viewports[setup.firstId].viewCenter);
  assert.deepEqual(afterFirst.viewports[setup.secondId],before.viewports[setup.secondId]);
  b.run(`layoutInteraction.activateAt(worldToScreen(200,50));layoutInteraction.begin();layoutInteraction.navigate({dx:-25,dy:5,factor:2,screen:worldToScreen(200,50)});layoutInteraction.commit()`);
  const afterSecond=b.read(`modelReader.layout(${JSON.stringify(setup.layoutId)})`);
  assert.deepEqual(afterSecond.viewports[setup.firstId],afterFirst.viewports[setup.firstId]);
  assert.notDeepEqual(afterSecond.viewports[setup.secondId],afterFirst.viewports[setup.secondId]);
  b.run(`window.caderactDocumentSession.layoutGateway.updateViewport(${JSON.stringify(setup.layoutId)},${JSON.stringify(setup.secondId)},{locked:true});layoutInteraction.navigate({dx:40,dy:20,factor:2,screen:worldToScreen(200,50)})`);
  assert.deepEqual(b.read(`modelReader.layout(${JSON.stringify(setup.layoutId)}).viewports[${JSON.stringify(setup.secondId)}].viewCenter`),afterSecond.viewports[setup.secondId].viewCenter);
  b.run('documentController.undo()');
  b.run('documentController.undo()');assert.deepEqual(b.read(`modelReader.layout(${JSON.stringify(setup.layoutId)})`),afterFirst);
  b.run('documentController.undo()');assert.deepEqual(b.read(`modelReader.layout(${JSON.stringify(setup.layoutId)})`),before);
  b.run('documentController.redo();documentController.redo()');assert.deepEqual(b.read(`modelReader.layout(${JSON.stringify(setup.layoutId)})`),afterSecond);
  b.run('window.caderactLayoutContext.switchToModel()');assert.deepEqual(b.read('({...camera})'),modelCamera);
});
