'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser,settle}=require('../helpers/browser.cjs');

function typed(b,value){b.input.value=value;b.emit(b.input,'input');return b.key('Enter',b.input)}
function state(b){return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})')}

test('Circle and C launch with exact center/radius prompt progression',async()=>{
  for(const name of ['Circle','C','c']){
    const b=await browser();b.launch(name);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Circle');
    assert.equal(b.read('window.caderactFeedback.activePrompt'),'Circle: Specify center point');typed(b,'3,4');assert.equal(b.read('window.caderactFeedback.activePrompt'),'Circle: Specify radius point');
  }
});

test('center is immutable transient state, visible, and supplied as a Draft Point candidate',async()=>{
  const b=await browser(),before=state(b);b.launch('Circle');typed(b,'3,4');b.flush();
  assert.deepEqual(state(b),before);assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.center'),{x:3,y:4});
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.getSnapCandidates().map(({kind,point})=>({kind,point}))'),[{kind:'draft-point',point:{x:3,y:4}}]);
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length,1);
  b.point(470,240,'pointermove');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.center'),{x:3,y:4});
});

test('preview derives exact horizontal, vertical, diagonal, and all-quadrant radii without publication',async()=>{
  const b=await browser();b.launch('Circle');typed(b,'3,4');
  for(const point of [{x:8,y:4},{x:3,y:10},{x:6,y:8},{x:-2,y:4},{x:3,y:-2},{x:0,y:0}]){
    b.run(`window.caderactCommandRouter.activeSession.draft.updatePointer(${JSON.stringify(point)})`);
    const preview=b.read('window.caderactCommandRouter.activeSession.draft.preview()');
    assert.equal(preview.radius,Math.hypot(point.x-3,point.y-4));assert.deepEqual(preview.center,{x:3,y:4});
  }
  assert.equal(b.read('modelReader.records().length'),0);
});

test('pointer, typed relative, and mixed center/radius-point input commit exact circles',async()=>{
  const pointer=await browser();pointer.launch('Circle');pointer.point(400,300);pointer.point(450,300);assert.equal(pointer.read('modelReader.records()[0].radius'),10);
  const typedOnly=await browser();typedOnly.launch('Circle');typed(typedOnly,'10,20');typed(typedOnly,'@3,4');
  assert.deepEqual(typedOnly.read('(({center,radius})=>({center,radius}))(modelReader.records()[0])'),{center:{x:10,y:20},radius:5});
  const mixed=await browser();mixed.launch('Circle');mixed.point(400,300);typed(mixed,'6,8');assert.equal(mixed.read('modelReader.records()[0].radius'),10);
});

test('Circle reuses Endpoint, Midpoint, Grid toggle, center Draft Point, and retains snapping with Shift',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:40,y:20})])');b.launch('Circle');typed(b,'3,4');
  b.point(502,201,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');
  b.point(552,201,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'midpoint');
  b.emit(b.gridSnapButton,'click');b.point(451,249,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'grid');b.emit(b.gridSnapButton,'click');b.point(451,249,'pointermove');assert.equal(b.read('activeSnapResult.snapped'),false);
  b.point(417,278,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'draft-point');
  b.key('Shift',b.document,{code:'ShiftLeft'});assert.equal(b.read('activeSnapResult.kind'),'draft-point');
  b.emit(b.document,'keyup',{key:'Shift',code:'ShiftLeft'});assert.equal(b.read('activeSnapResult.kind'),'draft-point');
});

test('zero radius is rejected exactly and keeps center active for retry',async()=>{
  const b=await browser(),before=state(b);b.launch('Circle');typed(b,'3,4');typed(b,'3,4');
  assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'zero-radius');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Circle');
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.center'),{x:3,y:4});assert.deepEqual(state(b),before);
  typed(b,'3,9');assert.equal(b.read('modelReader.records()[0].radius'),5);
});

test('valid Circle publishes one current-layer record in one history entry and Undo/Redo is exact',async()=>{
  const b=await browser();b.run('layerGateway.create("Circles")');const id=b.read('modelReader.layers().find(layer=>layer.name==="Circles").id');b.run(`layerGateway.setCurrent(${JSON.stringify(id)})`);
  const before=b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount})');b.launch('Circle');typed(b,'1,2');typed(b,'4,6');
  const record=b.read('modelReader.records()[0]');assert.equal(record.type,'circle');assert.equal(record.layerId,id);assert.equal(record.radius,5);
  assert.equal(b.read('documentController.currentRevision'),before.revision+1);assert.equal(b.read('documentController.historyInfo.entryCount'),before.history+1);
  b.run('window.caderactHistory.undo()');assert.equal(b.read('modelReader.records().length'),0);b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.records()[0]'),record);
});

test('Escape/Enter clear incomplete Circle, pointer leave hides preview, and replacement stays blocked',async()=>{
  for(const key of ['Escape','Enter'])for(const centered of [false,true]){
    const b=await browser(),before=state(b);b.launch('Circle');if(centered)typed(b,'1,2');b.key(key);b.flush();assert.deepEqual(state(b),before);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);
  }
  const b=await browser();b.launch('Circle');typed(b,'1,2');b.point(450,250,'pointermove');b.flush();b.point(900,700,'pointerleave');b.flush();
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.center'),{x:1,y:2});assert.equal(b.renders.at(-1).circleOverlay.preview.length,0);
  assert.equal(b.window.caderactCommandRouter.execute('Line').status,'command-active');
});

test('failed publication is atomic, preserves Circle draft, and retries successfully',async()=>{
  const b=await browser();b.launch('Circle');typed(b,'1,2');const before=state(b);b.run('window.__blocker=documentController.beginTransaction()');typed(b,'4,6');
  assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'commit-failed');assert.deepEqual(state(b),before);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Circle');
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.center'),{x:1,y:2});b.run('window.__blocker.rollback()');typed(b,'4,6');assert.equal(b.read('modelReader.records().length'),1);
});

test('renderer recovery reconstructs Circle preview without persistent mutation',async()=>{
  const b=await browser();b.launch('Circle');typed(b,'1,2');b.point(450,250,'pointermove');b.flush();const before=b.read('({center:window.caderactCommandRouter.activeSession.draft.center,radius:window.caderactCommandRouter.activeSession.draft.radius,document:modelReader.snapshot()})');
  const recovered={render:scene=>b.renders.push(scene),resize(){}};b.window.createCaderactRenderer=async()=>recovered;b.fakeRenderer.onDeviceLost();await settle();b.flush();
  assert.deepEqual(b.read('({center:window.caderactCommandRouter.activeSession.draft.center,radius:window.caderactCommandRouter.activeSession.draft.radius,document:modelReader.snapshot()})'),before);
  assert.equal(b.renders.at(-1).circleOverlay.preview.length,1);
});

test('Circle persistence round-trips exact v1 geometry and rejects malformed closed shapes',async()=>{
  const b=await browser();b.launch('Circle');typed(b,'1.25,-2.5');typed(b,'4.25,1.5');const original=b.read('modelReader.records()[0]');
  b.run('window.__circleFile=window.CaderactPersistence.serializeDocument(modelReader.snapshot());window.__circleStore=window.CaderactPersistence.loadStore(window.__circleFile)');
  assert.deepEqual(b.read('window.__circleStore.reader.records()[0]'),original);assert.equal(b.read('JSON.parse(window.__circleFile).fileVersion'),3);
  const payload=JSON.parse(b.run('window.__circleFile'));
  for(const mutate of [
    value=>{value.document.records[0].radius=0},value=>{value.document.records[0].radius=null},
    value=>{delete value.document.records[0].center},value=>{value.document.records[0].center.x=null},
    value=>{value.document.records[0].unexpected=true},value=>{value.document.records[0].center.unexpected=true},
  ]){const invalid=structuredClone(payload);mutate(invalid);assert.throws(()=>b.run(`window.CaderactPersistence.loadStore(${JSON.stringify(JSON.stringify(invalid))})`),/Invalid Caderact file/);}
});

test('Circle circumference selection hits only the ring and selected rendering adds no grips',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createCircle({x:0,y:0},20)])');const id=b.read('modelReader.records()[0].id');
  b.point(500,300);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);b.flush();assert.equal(b.renders.at(-1).circleOverlay.selected.length,1);assert.equal(b.renders.at(-1).gripOverlay.grips.length,0);
  b.point(400,300);b.point(400,300,'pointerup');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);b.point(550,300);b.point(550,300,'pointerup');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);
});
