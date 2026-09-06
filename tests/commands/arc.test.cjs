'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {browser,settle}=require('../helpers/browser.cjs');
function typed(b,value){b.input.value=value;b.emit(b.input,'input');return b.key('Enter',b.input)}
function state(b){return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty})')}
function createArc(b,p1='10,0',p2='0,10',p3='-10,0'){b.launch('Arc');typed(b,p1);typed(b,p2);typed(b,p3)}
function near(actual,expected,tolerance=1e-10){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`)}

test('Arc and A launch with three-point prompts and repeatable canonical metadata',async()=>{
  for(const name of ['Arc','A','a']){const b=await browser();b.launch(name);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Arc');assert.equal(b.input.placeholder,'Arc: Specify start point');typed(b,'1,0');assert.equal(b.input.placeholder,'Arc: Specify second point');typed(b,'0,1');assert.equal(b.input.placeholder,'Arc: Specify end point');assert.equal(b.read('window.caderactCommandRouter.lastRepeatableCommand'),'Arc')}
});

test('pure three-point geometry derives minor, major, positive, and negative sweeps through P2',async()=>{
  const b=await browser();
  const cases=[[{x:1,y:0},{x:0,y:1},{x:-1,y:0},Math.PI],[{x:1,y:0},{x:0,y:-1},{x:-1,y:0},-Math.PI],
    [{x:1,y:0},{x:-1,y:0},{x:0,y:1},-Math.PI*1.5],[{x:1,y:0},{x:-1,y:0},{x:0,y:-1},Math.PI*1.5]];
  for(const [p1,p2,p3,sweep] of cases){b.window.__arc=b.window.CaderactArcGeometry.fromThreePoints(p1,p2,p3);assert.equal(b.window.__arc.valid,true);near(b.window.__arc.center.x,0);near(b.window.__arc.center.y,0);near(b.window.__arc.radius,1);near(b.window.__arc.sweep,sweep);assert.equal(b.window.CaderactArcGeometry.angleOnSweep(Math.atan2(p2.y,p2.x),b.window.__arc.startAngle,b.window.__arc.sweep),true)}
});

test('draft is immutable/transient, exposes accepted snap candidates, and previews only a valid P3',async()=>{
  const b=await browser(),before=state(b);b.launch('Arc');typed(b,'10,0');typed(b,'0,10');assert.deepEqual(state(b),before);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.getSnapCandidates().map(c=>({kind:c.kind,point:c.point}))'),[{kind:'draft-point',point:{x:10,y:0}},{kind:'draft-point',point:{x:0,y:10}}]);
  b.run('window.caderactCommandRouter.activeSession.draft.updatePointer({x:-10,y:0})');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.preview().valid'),true);
  b.run('window.caderactCommandRouter.activeSession.draft.updatePointer({x:-10,y:20})');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.preview()'),null);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints()'),[{x:10,y:0},{x:0,y:10}]);
});

test('pointer, typed relative, and mixed input publish one exact native Arc',async()=>{
  const pointer=await browser();pointer.launch('Arc');pointer.point(450,300);pointer.point(400,250);pointer.point(350,300);assert.equal(pointer.read('modelReader.records()[0].type'),'arc');
  const typedOnly=await browser();typedOnly.launch('Arc');typed(typedOnly,'10,0');typed(typedOnly,'@-10,10');typed(typedOnly,'@-10,-10');near(typedOnly.read('modelReader.records()[0].radius'),10);
  const mixed=await browser();mixed.launch('Arc');mixed.point(450,300);typed(mixed,'0,10');mixed.point(350,300);assert.equal(mixed.read('modelReader.records().length'),1);
});

test('repeated, collinear, and near-collinear points reject without mutation and allow retry',async()=>{
  const b=await browser(),before=state(b);b.launch('Arc');typed(b,'0,0');typed(b,'0,0');assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'repeated-point');typed(b,'10,0');
  for(const invalid of ['20,0','20,0.000000000001']){typed(b,invalid);assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'collinear-points');assert.deepEqual(state(b),before);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Arc')}
  typed(b,'10,10');assert.equal(b.read('modelReader.records().length'),1);
});

test('Arc reuses D2A endpoint, grid toggle, Draft Point, and Shift bypass',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:40,y:20})])');b.launch('Arc');typed(b,'0,0');
  b.point(502,201,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');b.point(401,299,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'draft-point');
  b.point(451,249,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'grid');b.emit(b.gridSnapButton,'click');b.point(451,249,'pointermove');assert.equal(b.read('activeSnapResult.snapped'),false);
  b.key('Shift',b.document,{code:'ShiftLeft'});assert.equal(b.read('activeSnapResult.snapped'),false);b.emit(b.document,'keyup',{key:'Shift',code:'ShiftLeft'});
});

test('commit inherits current layer, creates one history entry, and Undo/Redo preserves exact identity',async()=>{
  const b=await browser();b.run('layerGateway.create("Arcs")');const layer=b.read('modelReader.layers().find(x=>x.name==="Arcs").id');b.run(`layerGateway.setCurrent(${JSON.stringify(layer)})`);const before=b.read('documentController.historyInfo.entryCount');createArc(b);const record=b.read('modelReader.records()[0]');assert.equal(record.layerId,layer);assert.equal(b.read('documentController.historyInfo.entryCount'),before+1);b.run('window.caderactHistory.undo()');assert.equal(b.read('modelReader.records().length'),0);b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.records()[0]'),record);
});

test('Arc endpoints resolve through A10 and snap as Endpoint without fake Arc midpoint',async()=>{
  const b=await browser();createArc(b);b.run('window.__arc=modelReader.records()[0];window.__resolver=window.CaderactReferences.createResolver(modelReader);window.__ref=window.CaderactReferences.createEndpointReference(window.__arc.id,window.__arc.start.featureId)');assert.equal(b.read('window.__resolver.resolve(window.__ref).status'),'resolved');b.launch('Line');b.point(451,299);assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.currentPoint'),{x:10,y:0});b.point(401,249,'pointermove');assert.notEqual(b.read('activeSnapResult?.kind||null'),'midpoint');
});

test('strict v1 persistence round-trips Arc and rejects malformed and unknown fields',async()=>{
  const b=await browser();createArc(b,'1.25,0','0,1.25','-1.25,0');const original=b.read('modelReader.records()[0]');const serialized=b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');b.run(`window.__loaded=window.CaderactPersistence.loadStore(${JSON.stringify(serialized)})`);assert.deepEqual(b.read('window.__loaded.reader.records()[0]'),original);assert.equal(JSON.parse(serialized).fileVersion,1);const payload=JSON.parse(serialized);for(const mutate of [x=>x.document.records[0].radius=0,x=>x.document.records[0].sweep=0,x=>x.document.records[0].extra=true,x=>x.document.records[0].start.extra=true]){const invalid=structuredClone(payload);mutate(invalid);assert.throws(()=>b.run(`window.CaderactPersistence.loadStore(${JSON.stringify(JSON.stringify(invalid))})`),/Invalid Caderact file/)}
});

test('selection hits only the visible angular span and selected Arc has no grips',async()=>{
  const b=await browser();createArc(b);const id=b.read('modelReader.records()[0].id');b.point(400,250);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);b.flush();assert.equal(b.renders.at(-1).arcOverlay.selected.length,1);assert.equal(b.renders.at(-1).gripOverlay.grips.length,0);b.point(400,350);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);b.point(400,300);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);
});

test('Escape/Enter, pointer leave, failed publication, recovery, and Space repeat preserve lifecycle',async()=>{
  for(const accepted of [0,1,2]){const b=await browser(),before=state(b);b.launch('Arc');if(accepted>0)typed(b,'10,0');if(accepted>1)typed(b,'0,10');b.key('Escape');assert.deepEqual(state(b),before)}
  const b=await browser();b.launch('Arc');typed(b,'10,0');typed(b,'0,10');b.point(350,300,'pointermove');b.flush();assert.equal(b.renders.at(-1).arcOverlay.preview.length,1);b.point(900,700,'pointerleave');b.flush();assert.equal(b.renders.at(-1).arcOverlay.preview.length,0);assert.equal(b.renders.at(-1).draftPointOverlay.points.length,2);
  b.point(350,300,'pointermove');const recovered={render:s=>b.renders.push(s),resize(){}};b.window.createCaderactRenderer=async()=>recovered;b.fakeRenderer.onDeviceLost();await settle();b.flush();assert.equal(b.renders.at(-1).arcOverlay.preview.length,1);
  b.run('window.__blocker=documentController.beginTransaction()');typed(b,'-10,0');assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'commit-failed');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints().length'),2);b.run('window.__blocker.rollback()');typed(b,'-10,0');b.emit(b.canvas,'pointerenter');b.key(' ',b.canvas,{code:'Space'});b.emit(b.window,'keyup',{key:' ',code:'Space'});assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Arc');
});
