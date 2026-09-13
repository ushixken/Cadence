'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser,settle}=require('../helpers/browser.cjs');

function typed(b,value){b.input.value=value;b.emit(b.input,'input');return b.key('Enter',b.input)}
function state(b){return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})')}
function points(b){return b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints()')}
function segments(b){return b.read('window.caderactCommandRouter.activeSession.draft.draftSegments().map(({start,end})=>({start:{x:start.x,y:start.y},end:{x:end.x,y:end.y}}))')}

test('Polyline, Pline, and PL launch through the command registry',async()=>{
  for(const name of ['Polyline','Pline','PL','pl','pol','poly']){
    const b=await browser();b.launch(name);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polyline');
    assert.equal(b.read('window.caderactFeedback.activePrompt'),'Polyline: Specify first point');
  }
});

test('pol and poly resolve to Polyline while PG and Polygon resolve to Polygon with Enter or Space',async()=>{
  for(const [token,expected] of [['pol','Polyline'],['poly','Polyline'],['pline','Polyline'],['pl','Polyline'],['pg','Polygon'],['polygon','Polygon']])for(const key of ['Enter',' ']){const b=await browser();b.launch(token,key);if(key===' ')b.emit(b.window,'keyup',{key:' ',code:'Space'});assert.equal(b.read('window.caderactCommandRouter.activeCommand'),expected)}
});

test('first point is transient and accepted segments and markers stay fixed while only preview moves',async()=>{
  const b=await browser(),before=state(b);b.launch('Polyline');typed(b,'3,4');assert.deepEqual(state(b),before);
  typed(b,'8,9');b.point(460,240,'pointermove');b.flush();
  const fixed=Array.from(b.renders.at(-1).acceptedDraftOverlay.segments),markers=b.read('window.caderactCommandRouter.activeSession.getDraftPoints()');
  const previewA=Array.from(b.renders.at(-1).nextSegmentPreviewOverlay.segments);
  b.point(470,260,'pointermove');b.flush();
  assert.deepEqual(Array.from(b.renders.at(-1).acceptedDraftOverlay.segments),fixed);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.getDraftPoints()'),markers);
  assert.notDeepEqual(Array.from(b.renders.at(-1).nextSegmentPreviewOverlay.segments),previewA);
  assert.equal(fixed.length,4);assert.equal(b.renders.at(-1).draftPointOverlay.points.length,2);assert.equal(b.read('modelReader.records().length'),0);
});

test('draft accepts connected movement in every direction with immutable outward snapshots',async()=>{
  const b=await browser();b.launch('Polyline');
  for(const value of ['0,0','5,6','-3,9','-8,-4','7,-10'])typed(b,value);
  assert.deepEqual(segments(b),[
    {start:{x:0,y:0},end:{x:5,y:6}},{start:{x:5,y:6},end:{x:-3,y:9}},
    {start:{x:-3,y:9},end:{x:-8,y:-4}},{start:{x:-8,y:-4},end:{x:7,y:-10}},
  ]);
  assert.equal(b.run('Object.isFrozen(window.caderactCommandRouter.activeSession.draft.acceptedPoints())'),true);
});

test('pointer, relative typed, and mixed input share the same Polyline draft',async()=>{
  const typedOnly=await browser();typedOnly.launch('Polyline');typed(typedOnly,'10,20');typed(typedOnly,'@5,-7');
  assert.deepEqual(points(typedOnly),[{x:10,y:20},{x:15,y:13}]);
  const mixed=await browser();mixed.launch('Polyline');mixed.point(400,300);typed(mixed,'@7,8');mixed.point(460,250);
  assert.deepEqual(points(mixed),[{x:0,y:0},{x:7,y:8},{x:12,y:10}]);
});

test('Polyline reuses Endpoint, Midpoint, Grid toggle, and applies Shift Ortho before snapping',async()=>{
  const endpoint=await browser();endpoint.run('recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:40,y:20})])');
  endpoint.launch('Polyline');endpoint.point(502,201,'pointermove');assert.equal(endpoint.read('activeSnapResult.kind'),'endpoint');endpoint.point(502,201);
  assert.deepEqual(points(endpoint),[{x:20,y:20}]);
  endpoint.point(552,201,'pointermove');assert.equal(endpoint.read('activeSnapResult.kind'),'midpoint');

  const grid=await browser();grid.emit(grid.gridSnapButton,'click');grid.launch('Polyline');typed(grid,'1,1');grid.point(451,249,'pointermove');assert.equal(grid.read('activeSnapResult.kind'),'grid');
  grid.emit(grid.gridSnapButton,'click');grid.point(451,249,'pointermove');assert.equal(grid.read('activeSnapResult.snapped'),false);

  const shifted=await browser();shifted.run('recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:40,y:20})])');
  shifted.launch('Polyline');typed(shifted,'1,1');shifted.point(502,201,'pointermove');assert.equal(shifted.read('activeSnapResult.kind'),'endpoint');
  shifted.key('Shift',shifted.document,{code:'ShiftLeft'});assert.equal(shifted.read('activeSnapResult.snapped'),false);
  shifted.emit(shifted.document,'keyup',{key:'Shift',code:'ShiftLeft'});assert.equal(shifted.read('activeSnapResult.kind'),'endpoint');
});

test('all accepted Polyline vertices, including first and latest, are Draft Point candidates',async()=>{
  const b=await browser();b.launch('Polyline');for(const value of ['3,4','8,9','13,6'])typed(b,value);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.getSnapCandidates().map(candidate=>candidate.point)'),[{x:3,y:4},{x:8,y:9},{x:13,y:6}]);
  for(const [screen,expected] of [[[417,278],{x:3,y:4}],[[442,253],{x:8,y:9}],[[467,268],{x:13,y:6}]]){
    b.point(...screen,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'draft-point');assert.deepEqual(b.read('activeSnapResult.point'),expected);
  }
});

test('repeated current point is rejected without zero-length segment or state mutation',async()=>{
  const b=await browser();b.launch('Polyline');typed(b,'3,4');typed(b,'8,9');const before=state(b),draft=segments(b);
  typed(b,'8,9');assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'repeated-point');
  assert.deepEqual(segments(b),draft);assert.deepEqual(state(b),before);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polyline');
});

test('command Step Undo removes points locally and can return to first-point acquisition',async()=>{
  const b=await browser(),before=state(b);b.launch('Polyline');for(const value of ['1,2','4,5','8,9'])typed(b,value);
  b.key('z',b.canvas,{ctrlKey:true});assert.deepEqual(points(b),[{x:1,y:2},{x:4,y:5}]);
  b.key('z',b.canvas,{ctrlKey:true});assert.deepEqual(points(b),[{x:1,y:2}]);
  b.key('z',b.canvas,{ctrlKey:true});assert.deepEqual(points(b),[]);assert.equal(b.read('window.caderactFeedback.activePrompt'),'Polyline: Specify first point');
  assert.deepEqual(state(b),before);
});

test('Enter with no segment publishes nothing; Enter with segments commits once and excludes preview',async()=>{
  for(const first of [false,true]){const b=await browser(),before=state(b);b.launch('Polyline');if(first)typed(b,'1,2');b.key('Enter');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.deepEqual(state(b),before);}
  const b=await browser(),before=state(b);b.launch('Polyline');for(const value of ['1,2','4,5','8,9'])typed(b,value);b.point(500,200,'pointermove');b.key('Enter');b.flush();
  assert.equal(b.read('modelReader.records().length'),1);assert.equal(b.read('modelReader.records()[0].type'),'polyline');assert.equal(b.read('modelReader.records()[0].closed'),false);assert.equal(b.read('modelReader.records()[0].vertices.length'),3);assert.equal(b.read('documentController.currentRevision'),before.revision+1);
  assert.equal(b.read('documentController.historyInfo.entryCount'),before.history.entryCount+1);assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,0);
});

test('Close eligibility is enforced and valid Close adds one exact closing edge and completes',async()=>{
  const early=await browser();early.launch('Polyline');typed(early,'1,2');typed(early,'Close');
  assert.equal(early.read('window.caderactCommandRouter.lastResult.reason'),'close-unavailable');assert.equal(early.read('window.caderactCommandRouter.activeCommand'),'Polyline');
  const b=await browser();b.launch('Polyline');for(const value of ['1,2','4,5','8,9'])typed(b,value);typed(b,'cLoSe');
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.equal(b.read('modelReader.records().length'),1);
  assert.equal(b.read('modelReader.records()[0].closed'),true);assert.equal(b.read('modelReader.records()[0].vertices.length'),3);
});

test('hover snap/click on P1 closes and completes Polyline',async()=>{
  const b=await browser();b.launch('Polyline');for(const value of ['3,4','8,9','13,6'])typed(b,value);
  b.point(417,278,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'draft-point');b.point(417,278);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.equal(b.read('modelReader.records().length'),1);assert.equal(b.read('modelReader.records()[0].closed'),true);assert.equal(b.read('modelReader.records()[0].vertices.length'),3);
});

test('Polyline hover does not finish, but an endpoint-resolved P1 click closes without duplicating P1',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createLine({x:3,y:4},{x:-2,y:4})])');b.launch('Polyline');for(const value of ['3,4','8,9','13,6'])typed(b,value);
  b.point(417,278,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polyline');
  b.point(417,278);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);const record=b.read('modelReader.records().find(record=>record.type==="polyline")');assert.equal(record.closed,true);assert.equal(record.vertices.length,3);assert.equal(new Set(record.vertices.map(vertex=>vertex.featureId)).size,3);
});

test('one atomic publication inherits current layer and one Undo/Redo restores one exact Polyline',async()=>{
  const b=await browser();b.run('layerGateway.create("Path")');const id=b.read('modelReader.layers().find(layer=>layer.name==="Path").id');b.run(`layerGateway.setCurrent(${JSON.stringify(id)})`);
  const history=b.read('documentController.historyInfo.entryCount');b.launch('Polyline');for(const value of ['0,0','5,6','9,2'])typed(b,value);b.key('Enter');
  assert.deepEqual(b.read('modelReader.records().map(record=>record.layerId)'),[id]);assert.equal(b.read('modelReader.records()[0].type'),'polyline');assert.equal(b.read('documentController.historyInfo.entryCount'),history+1);
  const committed=b.read('modelReader.records()');b.run('window.caderactHistory.undo()');assert.equal(b.read('modelReader.records().length'),0);
  b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.records()'),committed);
});

test('failed publication is atomic, preserves draft, and retries successfully',async()=>{
  const b=await browser();b.launch('Polyline');for(const value of ['1,2','4,5','8,9'])typed(b,value);const before=state(b),draft=segments(b);
  b.run('window.__blocker=documentController.beginTransaction()');b.key('Enter');assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'commit-failed');
  assert.deepEqual(state(b),before);assert.deepEqual(segments(b),draft);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polyline');
  b.run('window.__blocker.rollback()');b.key('Enter');assert.equal(b.read('modelReader.records().length'),1);
});

test('failed Close preserves vertices and retry does not duplicate the first vertex',async()=>{
  const b=await browser();b.launch('Polyline');for(const value of ['1,2','4,5','8,9'])typed(b,value);
  b.run('window.__blocker=documentController.beginTransaction()');typed(b,'Close');
  assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'commit-failed');assert.equal(segments(b).length,2);
  assert.deepEqual(points(b).at(-1),{x:8,y:9});assert.equal(b.read('modelReader.records().length'),0);
  b.run('window.__blocker.rollback()');typed(b,'Close');assert.equal(b.read('modelReader.records().length'),1);assert.equal(b.read('modelReader.records()[0].vertices.length'),3);
});

test('pointer leave hides only preview and command replacement remains blocked',async()=>{
  const b=await browser();b.launch('Polyline');for(const value of ['1,2','4,5'])typed(b,value);b.point(450,250,'pointermove');b.flush();
  const accepted=segments(b);b.point(900,700,'pointerleave');b.flush();
  assert.deepEqual(segments(b),accepted);assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,0);
  const outcome=b.window.caderactCommandRouter.execute('Rectangle');assert.equal(outcome.status,'command-active');assert.equal(outcome.command,'Polyline');
});

test('Escape clears the whole draft and renderer recovery reconstructs only current transient state',async()=>{
  const cancelled=await browser(),before=state(cancelled);cancelled.launch('Polyline');for(const value of ['1,2','4,5','8,9'])typed(cancelled,value);cancelled.key('Escape');cancelled.flush();
  assert.deepEqual(state(cancelled),before);assert.equal(cancelled.renders.at(-1).acceptedDraftOverlay.segments.length,0);assert.equal(cancelled.renders.at(-1).draftPointOverlay.points.length,0);

  const b=await browser();b.launch('Polyline');for(const value of ['1,2','4,5'])typed(b,value);b.point(450,250,'pointermove');b.flush();
  const draftBefore=b.read('({points:window.caderactCommandRouter.activeSession.draft.acceptedPoints(),segments:window.caderactCommandRouter.activeSession.draft.draftSegments(),document:modelReader.snapshot()})');
  const recovered={render:scene=>b.renders.push(scene),resize(){}};b.window.createCaderactRenderer=async()=>recovered;b.fakeRenderer.onDeviceLost();await settle();b.flush();
  assert.deepEqual(b.read('({points:window.caderactCommandRouter.activeSession.draft.acceptedPoints(),segments:window.caderactCommandRouter.activeSession.draft.draftSegments(),document:modelReader.snapshot()})'),draftBefore);
  assert.equal(b.renders.at(-1).acceptedDraftOverlay.segments.length,4);assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,4);
});

test('accepted point markers cover every connected renderer-neutral draft joint',async()=>{
  const b=await browser();b.launch('Polyline');for(const value of ['0,0','5,6','9,2','13,8'])typed(b,value);b.flush();const scene=b.renders.at(-1);
  assert.equal(scene.acceptedDraftOverlay.segments.length,12);assert.equal(scene.draftPointOverlay.points.length,4);
  for(let index=1;index<3;index++){
    const joint=scene.draftPointOverlay.points[index].point,accepted=Array.from(scene.acceptedDraftOverlay.segments);
    assert.ok(accepted.filter((value,i)=>i%2===0&&value===joint.x).length>=2);
  }
});

test('PersistentClose continuously closes through the one live candidate and Enter excludes that candidate',async()=>{
  const b=await browser();b.launch('Polyline');b.run('window.caderactViewport.setGridSnapEnabled(false)');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.options'),[{id:'persistentClose',label:'PersistentClose',value:'No',enabled:true}]);for(const p of ['0,0','10,0','10,10'])typed(b,p);b.point(475,250,'pointermove');const before=b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,history:documentController.historyInfo.entryCount})');b.emit(b.commandPrompt.children[1],'click');b.flush();assert.deepEqual(Array.from(b.renders.at(-1).nextSegmentPreviewOverlay.segments),[450,250,475,250,475,250,400,300]);b.point(500,225,'pointermove');b.flush();assert.deepEqual(Array.from(b.renders.at(-1).nextSegmentPreviewOverlay.segments),[450,250,500,225,500,225,400,300]);assert.deepEqual(b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,history:documentController.historyInfo.entryCount})'),before);b.emit(b.commandPrompt.children[1],'click');b.flush();assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,4);b.emit(b.commandPrompt.children[1],'click');b.key('Enter');const record=b.read('modelReader.records()[0]');assert.equal(record.closed,true);assert.equal(record.vertices.length,3);assert.deepEqual(record.vertices.map(({x,y})=>({x,y})),[{x:0,y:0},{x:10,y:0},{x:10,y:10}]);b.emit(b.canvas,'pointerenter');b.key(' ',b.canvas,{code:'Space'});b.emit(b.window,'keyup',{key:' ',code:'Space'});assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.persistentClose'),false)
});

test('PersistentClose rebuilds both live edges after acceptance and Step Undo without stale geometry',async()=>{
  const b=await browser();b.launch('Polyline');b.run('window.caderactViewport.setGridSnapEnabled(false)');for(const p of ['0,0','10,0','10,10'])typed(b,p);b.point(475,250,'pointermove');b.emit(b.commandPrompt.children[1],'click');b.point(475,250);b.point(500,225,'pointermove');b.flush();assert.deepEqual(Array.from(b.renders.at(-1).nextSegmentPreviewOverlay.segments),[475,250,500,225,500,225,400,300]);b.key('z',b.canvas,{ctrlKey:true});b.point(500,225,'pointermove');b.flush();assert.deepEqual(Array.from(b.renders.at(-1).nextSegmentPreviewOverlay.segments),[450,250,500,225,500,225,400,300]);b.emit(b.canvas,'pointerleave');b.flush();assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,4);b.key('Escape');b.flush();assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,0)
});

test('PersistentClose applies Shift Ortho to its shared candidate before snapping',async()=>{
  const b=await browser();b.launch('Line');typed(b,'20,20');typed(b,'30,20');b.key('Enter');b.launch('Polyline');for(const p of ['0,0','10,0','10,10'])typed(b,p);b.emit(b.commandPrompt.children[1],'click');b.point(499,201,'pointermove');b.flush();assert.equal(b.read('activeSnapResult.kind'),'endpoint');assert.deepEqual(Array.from(b.renders.at(-1).nextSegmentPreviewOverlay.segments),[450,250,500,200,500,200,400,300]);b.point(499,201,'pointermove',{shiftKey:true});b.flush();assert.equal(b.read('activeSnapResult.snapped'),false);assert.deepEqual(Array.from(b.renders.at(-1).nextSegmentPreviewOverlay.segments),[450,250,499,250,499,250,400,300]);assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints().length'),3);b.point(499,201,'pointercancel');b.flush();assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,4)
});

test('clickable Close appears only with three usable vertices and commits one closed native record',async()=>{
  const b=await browser();b.launch('Polyline');typed(b,'0,0');typed(b,'10,0');assert.equal(b.read('window.caderactCommandRouter.activeSession.options.some(x=>x.id==="close")'),false);typed(b,'10,10');assert.equal(b.read('window.caderactCommandRouter.activeSession.options.some(x=>x.id==="close")'),true);const close=b.commandPrompt.children.find(child=>child.dataset.optionId==='close');assert.equal(close.textContent,'Close');b.emit(close,'click');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.equal(b.read('modelReader.records().length'),1);assert.equal(b.read('modelReader.records()[0].closed'),true)
});

test('native Polyline vertices resolve and snap as endpoints while every segment supplies a midpoint',async()=>{
  const b=await browser();b.launch('Polyline');for(const value of ['0,0','10,0','10,10'])typed(b,value);b.key('Enter');const record=b.read('modelReader.records()[0]');b.run('window.__poly=modelReader.records()[0];window.__ref=window.CaderactReferences.createEndpointReference(window.__poly.id,window.__poly.vertices[1].featureId);window.__resolved=window.CaderactReferences.createResolver(modelReader).resolve(window.__ref)');assert.equal(b.read('window.__resolved.status'),'resolved');assert.equal(b.read('window.__resolved.role'),'vertex');b.launch('Line');b.point(451,299);assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.currentPoint'),{x:10,y:0});b.point(426,299,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'midpoint');assert.equal(new Set(record.vertices.map(vertex=>vertex.featureId)).size,3)
});

test('native Polyline persistence is strict and preserves open/closed order and feature identities',async()=>{
  for(const closed of [false,true]){const b=await browser();b.launch('Polyline');for(const value of ['0,0','10,0','10,10'])typed(b,value);closed?typed(b,'Close'):b.key('Enter');const original=b.read('modelReader.records()[0]'),serialized=b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');b.run(`window.__loaded=window.CaderactPersistence.loadStore(${JSON.stringify(serialized)})`);assert.deepEqual(b.read('window.__loaded.reader.records()[0]'),original);assert.equal(JSON.parse(serialized).fileVersion,1);const payload=JSON.parse(serialized);for(const mutate of [x=>x.document.records[0].vertices=[],x=>x.document.records[0].vertices[0].x=null,x=>x.document.records[0].vertices[0].extra=true,x=>x.document.records[0].extra=true]){const invalid=structuredClone(payload);mutate(invalid);assert.throws(()=>b.run(`window.CaderactPersistence.loadStore(${JSON.stringify(JSON.stringify(invalid))})`),/Invalid Caderact file/)}}
});

test('click and D3A select one whole native Polyline and selected overlay covers every segment',async()=>{
  const b=await browser();b.launch('Polyline');for(const value of ['-10,0','0,10','10,0'])typed(b,value);b.key('Enter');const id=b.read('modelReader.records()[0].id');b.point(375,275);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);b.flush();assert.equal(b.renders.at(-1).selectionOverlay.segments.length,8);assert.equal(b.renders.at(-1).polylineOverlay.selected.length,1);b.point(700,500);b.point(700,500,'pointerup');b.point(340,240);b.point(460,310,'pointermove');b.point(460,310,'pointerup');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);b.point(700,500);b.point(700,500,'pointerup');b.point(390,270);b.point(370,280,'pointermove');b.point(370,280,'pointerup');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id])
});
