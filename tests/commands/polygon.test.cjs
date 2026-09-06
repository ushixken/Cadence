'use strict';const {test}=require('node:test');const assert=require('node:assert/strict');const {browser,settle}=require('../helpers/browser.cjs');
function typed(b,value){b.input.value=value;b.emit(b.input,'input');return b.key('Enter',b.input)}
function state(b){return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty})')}
function begin(b,sides='4'){b.launch('Polygon');typed(b,sides)}
function create(b,sides='4',center='0,0',radius='10,0'){begin(b,sides);typed(b,center);typed(b,radius)}
function near(actual,expected,tolerance=1e-9){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`)}

test('Polygon and Pol launch, default Enter accepts four sides, and metadata is repeatable',async()=>{
  for(const name of ['Polygon','Pol','pol']){const b=await browser();b.launch(name);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polygon');assert.equal(b.input.placeholder,'Polygon: Enter number of sides <4>');b.key('Enter',b.input);assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.sideCount'),4);assert.equal(b.input.placeholder,'Polygon: Specify center of polygon');assert.equal(b.read('window.caderactCommandRouter.lastRepeatableCommand'),'Polygon')}
});

test('side-count parser accepts bounded integers and rejects every invalid category with retry',async()=>{
  const b=await browser();for(const value of ['3','4','5','6','32','128','1024'])assert.deepEqual(b.read(`window.CaderactPolygonGeometry.parseSideCount(${JSON.stringify(value)})`).valid,true);
  for(const value of ['2','1025','0','-3','4.5','NaN','three','1e2'])assert.equal(b.read(`window.CaderactPolygonGeometry.parseSideCount(${JSON.stringify(value)}).valid`),false);
  b.launch('Polygon');for(const value of ['2','1025','4.5','no']){typed(b,value);assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.sideCount'),null)}typed(b,'6');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.sideCount'),6);
});

test('pure inscribed geometry has exact first vertex, equal radii, equal angles, and closed shared edges',async()=>{
  const b=await browser();for(const sides of [3,4,5,6,32,128,1024]){b.run(`window.__polygon=window.CaderactPolygonGeometry.derive({x:2,y:-3},{x:-4,y:5},${sides})`);const geometry=b.window.__polygon;assert.equal(geometry.vertices.length,sides);assert.equal(geometry.edges.length,sides);assert.equal(geometry.vertices[0].x,-4);assert.equal(geometry.vertices[0].y,5);for(const vertex of geometry.vertices)near(Math.hypot(vertex.x-2,vertex.y+3),10);for(let index=0;index<sides;index++){assert.equal(geometry.edges[index].start,geometry.vertices[index]);assert.equal(geometry.edges[index].end,geometry.vertices[(index+1)%sides])}}
});

test('center is immutable/transient and radius movement updates exactly N renderer-neutral preview edges',async()=>{
  const b=await browser(),before=state(b);begin(b,'5');typed(b,'2,3');assert.deepEqual(state(b),before);assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.getSnapCandidates().map(c=>({kind:c.kind,point:c.point}))'),[{kind:'draft-point',point:{x:2,y:3}}]);b.run('window.caderactCommandRouter.activeSession.draft.updatePointer({x:7,y:3})');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.previewEdges().length'),5);assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.center'),{x:2,y:3});b.flush();assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,20);
});

test('pointer, typed relative, and mixed point input commit regular polygons in varied orientations',async()=>{
  const pointer=await browser();begin(pointer,'3');pointer.point(400,300);pointer.point(450,300);assert.equal(pointer.read('modelReader.records().length'),3);
  const relative=await browser();begin(relative,'4');typed(relative,'10,20');typed(relative,'@3,4');assert.equal(relative.read('modelReader.records().length'),4);assert.deepEqual(relative.read('modelReader.records().flatMap(r=>[r.start,r.end]).some(p=>p.x===13&&p.y===24)'),true);
  const mixed=await browser();begin(mixed,'6');mixed.point(400,300);typed(mixed,'-5,-5');assert.equal(mixed.read('modelReader.records().length'),6);
});

test('Polygon center/radius acquisition reuses Endpoint, Midpoint, Grid toggle, Draft Point, and Shift',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:40,y:20})])');begin(b,'4');b.point(502,201);assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.center'),{x:20,y:20});b.point(552,201,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'midpoint');b.key('Escape');begin(b,'4');typed(b,'0,0');b.point(402,299,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'draft-point');b.point(451,249,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'grid');b.emit(b.gridSnapButton,'click');b.point(451,249,'pointermove');assert.equal(b.read('activeSnapResult.snapped'),false);b.point(402,299,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'draft-point');b.key('Shift',b.document,{code:'ShiftLeft'});assert.equal(b.read('activeSnapResult.snapped'),false);b.emit(b.document,'keyup',{key:'Shift',code:'ShiftLeft'});assert.equal(b.read('activeSnapResult.kind'),'draft-point');
});

test('zero radius preserves center and authoritative state, then retry succeeds',async()=>{
  const b=await browser(),before=state(b);begin(b,'4');typed(b,'2,3');typed(b,'2,3');assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'zero-radius');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.center'),{x:2,y:3});assert.deepEqual(state(b),before);typed(b,'7,3');assert.equal(b.read('modelReader.records().length'),4);
});

test('N Lines inherit current layer and publish atomically in one history entry with exact Undo/Redo',async()=>{
  const b=await browser();b.run('layerGateway.create("Polygons")');const layer=b.read('modelReader.layers().find(x=>x.name==="Polygons").id');b.run(`layerGateway.setCurrent(${JSON.stringify(layer)})`);const before=b.read('documentController.historyInfo.entryCount');create(b,'5');const records=b.read('modelReader.records()');assert.equal(records.length,5);assert.equal(records.every(record=>record.type==='line'&&record.layerId===layer),true);assert.equal(b.read('documentController.historyInfo.entryCount'),before+1);b.run('window.caderactHistory.undo()');assert.equal(b.read('modelReader.records().length'),0);b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.records()'),records);
});

test('failed atomic publication leaves no partial edges and preserves center/radius candidate',async()=>{
  const b=await browser();begin(b,'6');typed(b,'0,0');const before=state(b);b.run('window.__blocker=documentController.beginTransaction()');typed(b,'10,0');assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'commit-failed');assert.deepEqual(state(b),before);assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.center'),{x:0,y:0});assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.previewEdges().length'),6);b.run('window.__blocker.rollback()');typed(b,'10,0');assert.equal(b.read('modelReader.records().length'),6);
});

test('ordinary Line selection and grips apply independently to committed Polygon edges',async()=>{
  const b=await browser();create(b,'4');const count=b.read('modelReader.records().length');b.point(425,275);assert.equal(b.read('window.caderactSelection.selectedIds().length'),1);b.flush();assert.equal(b.renders.at(-1).gripOverlay.grips.length,2);assert.equal(count,4);
});

test('Escape phases, pointer leave, recovery, high-count bound, and Space repeat preserve lifecycle',async()=>{
  for(const phase of [0,1,2]){const b=await browser(),before=state(b);b.launch('Polygon');if(phase>0)typed(b,'4');if(phase>1)typed(b,'0,0');b.key('Escape');assert.deepEqual(state(b),before)}
  const b=await browser();begin(b,'1024');typed(b,'0,0');b.point(450,300,'pointermove');b.flush();assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,4096);assert.equal(b.read('modelReader.records().length'),0);b.point(900,700,'pointerleave');b.flush();assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,0);assert.equal(b.renders.at(-1).draftPointOverlay.points.length,1);b.point(450,300,'pointermove');const recovered={render:s=>b.renders.push(s),resize(){}};b.window.createCaderactRenderer=async()=>recovered;b.fakeRenderer.onDeviceLost();await settle();b.flush();assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,4096);typed(b,'10,0');b.emit(b.canvas,'pointerenter');b.key(' ',b.canvas,{code:'Space'});b.emit(b.window,'keyup',{key:' ',code:'Space'});assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polygon');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.sideCount'),null);
});
