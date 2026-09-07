'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {browser}=require('../helpers/browser.cjs');
function typed(b,value,key='Enter'){b.input.value=value;b.emit(b.input,'input');b.key(key,b.input,{code:key===' '?'Space':key});if(key===' ')b.emit(b.window,'keyup',{key:' ',code:'Space'})}
function createEllipse(b,p1='-10,0',p2='10,0',p3='0,5'){b.launch('Ellipse');typed(b,p1);typed(b,p2);typed(b,p3)}
function state(b){return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty})')}
function near(actual,expected,tolerance=1e-10){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`)}

test('Ellipse and EL launch with exact prompts and repeatable metadata',async()=>{
  for(const name of ['Ellipse','EL','el']){const b=await browser();b.launch(name);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Ellipse');assert.equal(b.read('window.caderactFeedback.activePrompt'),'Ellipse: Specify first axis endpoint');typed(b,'-10,0');assert.equal(b.read('window.caderactFeedback.activePrompt'),'Ellipse: Specify second axis endpoint');typed(b,'10,0');assert.equal(b.read('window.caderactFeedback.activePrompt'),'Ellipse: Specify second-axis distance');assert.equal(b.read('window.caderactCommandRouter.lastRepeatableCommand'),'Ellipse')}
});

test('pure geometry derives horizontal, vertical, rotated, eccentric, and equal-axis ellipses',async()=>{
  const b=await browser();const cases=[[[ -10,0],[10,0],[0,5],[0,0,10,0,5,0]],[[0,-8],[0,8],[3,0],[0,0,0,8,3,Math.PI/2]],[[0,0],[6,8],[0,10],[3,4,3,4,6,Math.atan2(8,6)]],[[ -2,0],[2,0],[0,20],[0,0,2,0,20,0]],[[ -5,0],[5,0],[0,5],[0,0,5,0,5,0]]];
  for(const [a,c,d,expected] of cases){b.window.__e=b.window.CaderactEllipseGeometry.fromAxisEndpoints({x:a[0],y:a[1]},{x:c[0],y:c[1]},{x:d[0],y:d[1]});assert.equal(b.window.__e.valid,true);const e=b.window.__e;near(e.center.x,expected[0]);near(e.center.y,expected[1]);near(e.majorAxis.x,expected[2]);near(e.majorAxis.y,expected[3]);near(e.minorRadius,expected[4]);near(e.orientation,expected[5])}
});

test('draft is transient, immutable, previews only P3, and exposes P1/P2 as Draft Points',async()=>{
  const b=await browser(),before=state(b);b.launch('Ellipse');typed(b,'-10,0');typed(b,'10,0');assert.deepEqual(state(b),before);assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.getSnapCandidates().map(c=>({kind:c.kind,point:c.point}))'),[{kind:'draft-point',point:{x:-10,y:0}},{kind:'draft-point',point:{x:10,y:0}}]);b.run('window.caderactCommandRouter.activeSession.draft.updatePointer({x:0,y:5})');const first=b.read('window.caderactCommandRouter.activeSession.draft.firstPoint');const second=b.read('window.caderactCommandRouter.activeSession.draft.secondPoint');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.preview().minorRadius'),5);b.run('window.caderactCommandRouter.activeSession.draft.updatePointer({x:0,y:7})');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.firstPoint'),first);assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.secondPoint'),second);assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.preview().minorRadius'),7)
});

test('degenerate axes reject without publication and preserve accepted draft for retry',async()=>{
  const b=await browser(),before=state(b);b.launch('Ellipse');typed(b,'0,0');typed(b,'0,0');assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'zero-first-axis');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints()'),[{x:0,y:0}]);typed(b,'10,0');typed(b,'5,0');assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'zero-second-axis');assert.deepEqual(state(b),before);assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints().length'),2);typed(b,'5,3');assert.equal(b.read('modelReader.records()[0].type'),'ellipse')
});

test('pointer, typed absolute/relative, mixed, Enter, and quick Space publish native Ellipse',async()=>{
  const pointer=await browser();pointer.launch('Ellipse');pointer.point(350,300);pointer.point(450,300);pointer.point(400,250);assert.equal(pointer.read('modelReader.records()[0].type'),'ellipse');
  const relative=await browser();relative.launch('Ellipse');typed(relative,'-10,0');typed(relative,'@20,0',' ');typed(relative,'@-10,5',' ');assert.equal(relative.read('modelReader.records()[0].minorRadius'),5);
  const mixed=await browser();mixed.launch('Ellipse');mixed.point(350,300);typed(mixed,'10,0');mixed.point(400,250);assert.equal(mixed.read('modelReader.records().length'),1)
});

test('commit uses one current-layer transaction and Undo/Redo preserves exact ID',async()=>{
  const b=await browser();b.run('layerGateway.create("Ellipses")');const layer=b.read('modelReader.layers().find(x=>x.name==="Ellipses").id');b.run(`layerGateway.setCurrent(${JSON.stringify(layer)})`);const before=b.read('documentController.historyInfo.entryCount');createEllipse(b);const record=b.read('modelReader.records()[0]');assert.equal(record.layerId,layer);assert.equal(b.read('documentController.historyInfo.entryCount'),before+1);b.run('window.caderactHistory.undo()');assert.equal(b.read('modelReader.records().length'),0);b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.records()[0]'),record)
});

test('strict v1 persistence round-trips Ellipse and rejects malformed closed shapes',async()=>{
  const b=await browser();createEllipse(b,'-1.25,0','1.25,0','0,0.5');const original=b.read('modelReader.records()[0]');const serialized=b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');b.run(`window.__loaded=window.CaderactPersistence.loadStore(${JSON.stringify(serialized)})`);assert.deepEqual(b.read('window.__loaded.reader.records()[0]'),original);assert.equal(JSON.parse(serialized).fileVersion,1);const payload=JSON.parse(serialized);for(const mutate of [x=>x.document.records[0].minorRadius=0,x=>x.document.records[0].majorAxis.x=Infinity,x=>x.document.records[0].extra=true,x=>x.document.records[0].center.extra=true,x=>x.document.records[0].majorAxis.extra=true,x=>x.document.records[0].layerId='missing']){const invalid=structuredClone(payload);mutate(invalid);assert.throws(()=>b.run(`window.CaderactPersistence.loadStore(${JSON.stringify(JSON.stringify(invalid))})`),/Invalid Caderact file/)}
});

test('committed Ellipse has no endpoint snap features and curve selection is screen-space',async()=>{
  const b=await browser();createEllipse(b);const id=b.read('modelReader.records()[0].id');assert.deepEqual(b.read('Object.keys(modelReader.records()[0])'),['id','type','layerId','center','majorAxis','minorRadius']);b.launch('Line');b.point(450,300,'pointermove');assert.notEqual(b.read('activeSnapResult?.kind||null'),'endpoint');b.key('Escape');b.point(450,300);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);b.point(400,300);b.point(400,300,'pointerup');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);b.point(400,200);b.point(400,200,'pointerup');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[])
});

test('Ellipse reuses Endpoint, Midpoint, Grid toggle, Draft Point, and Shift bypass',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:40,y:20})])');b.launch('Ellipse');typed(b,'0,0');b.point(502,201,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');b.point(551,201,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'midpoint');b.point(401,299,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'draft-point');b.emit(b.gridSnapButton,'click');b.point(451,249,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'grid');b.emit(b.gridSnapButton,'click');b.point(451,249,'pointermove');assert.equal(b.read('activeSnapResult.snapped'),false);b.key('Shift',b.document,{code:'ShiftLeft'});assert.equal(b.read('activeSnapResult.snapped'),false);b.emit(b.document,'keyup',{key:'Shift',code:'ShiftLeft'})
});

test('rotated and eccentric Ellipse selection hits the curve but not its interior',async()=>{
  const b=await browser();b.run('window.__g=window.CaderactEllipseGeometry.fromAxisEndpoints({x:-3,y:-4},{x:3,y:4},{x:-8,y:6});recordGateway.createAll([recordGateway.createEllipse(window.__g)])');const id=b.read('modelReader.records()[0].id');b.point(415,280);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);b.point(400,300);b.point(400,300,'pointerup');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);b.run('window.__g2=window.CaderactEllipseGeometry.fromAxisEndpoints({x:-20,y:0},{x:20,y:0},{x:0,y:1});recordGateway.createAll([recordGateway.createEllipse(window.__g2)])');const hit=b.run('window.CaderactSelection.hitTestRecords({screenPoint:{x:500,y:300},records:modelReader.records(),worldToScreen})');assert.equal(hit.hit,true)
});

test('Escape, pointer leave, failed publication, and Space repeat preserve lifecycle',async()=>{
  for(const accepted of [0,1,2]){const b=await browser(),before=state(b);b.launch('Ellipse');if(accepted>0)typed(b,'-10,0');if(accepted>1)typed(b,'10,0');b.key('Escape');assert.deepEqual(state(b),before)}
  const b=await browser();b.launch('Ellipse');typed(b,'-10,0');typed(b,'10,0');b.point(400,250,'pointermove');b.flush();assert.equal(b.renders.at(-1).ellipseOverlay.preview.length,1);b.point(900,700,'pointerleave');b.flush();assert.equal(b.renders.at(-1).ellipseOverlay.preview.length,0);assert.equal(b.renders.at(-1).draftPointOverlay.points.length,2);b.run('window.__blocker=documentController.beginTransaction()');typed(b,'0,5');assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'commit-failed');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints().length'),2);b.run('window.__blocker.rollback()');typed(b,'0,5');b.emit(b.canvas,'pointerenter');b.key(' ',b.canvas,{code:'Space'});b.emit(b.window,'keyup',{key:' ',code:'Space'});assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Ellipse')
});
