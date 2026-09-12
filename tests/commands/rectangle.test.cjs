'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser,settle}=require('../helpers/browser.cjs');

function typed(b,value){b.input.value=value;b.emit(b.input,'input');return b.key('Enter',b.input)}
function state(b){return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})')}
function endpoints(b){return b.read('modelReader.records().map(({start,end})=>({start:{x:start.x,y:start.y},end:{x:end.x,y:end.y}}))')}
function edgeKey(edge){return `${edge.start.x},${edge.start.y}->${edge.end.x},${edge.end.y}`}

test('Rectangle and Rect launch through the registry with the two-corner prompt',async()=>{
  for(const name of ['Rectangle','Rect']){
    const b=await browser();b.launch(name);
    assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Rectangle');
    assert.equal(b.read('window.caderactFeedback.activePrompt'),'Rectangle: Specify first corner');
  }
});

test('first corner is transient, immutable, visible, and supplies a Draft Point candidate',async()=>{
  const b=await browser(),before=state(b);b.launch('Rectangle');typed(b,'3,4');b.flush();
  assert.deepEqual(state(b),before);assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.firstCorner'),{x:3,y:4});
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.getSnapCandidates().map(({kind,point})=>({kind,point}))'),[{kind:'draft-point',point:{x:3,y:4}}]);
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length,1);
  b.point(417,278,'pointermove');b.flush();
  assert.equal(b.read('activeSnapResult.kind'),'draft-point');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.firstCorner'),{x:3,y:4});
});

test('renderer-neutral preview derives four ordered edges in every drag quadrant',async()=>{
  const b=await browser();
  for(const opposite of [{x:8,y:9},{x:-2,y:9},{x:-2,y:-1},{x:8,y:-1}]){
    const edges=b.read(`window.CaderactRectangleDraftSession.deriveEdges({x:3,y:4},${JSON.stringify(opposite)})`);
    assert.deepEqual(edges,[
      {start:{x:3,y:4},end:{x:opposite.x,y:4}},
      {start:{x:opposite.x,y:4},end:opposite},
      {start:opposite,end:{x:3,y:opposite.y}},
      {start:{x:3,y:opposite.y},end:{x:3,y:4}},
    ]);
  }
  b.launch('Rectangle');typed(b,'3,4');b.point(440,255,'pointermove');b.flush();
  assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,16);
  assert.equal(b.renders.at(-1).lineGroups[6].segments.length,16);
  assert.equal(b.read('modelReader.records().length'),0);
});

test('typed absolute and relative corners commit four Lines atomically and one Undo/Redo restores them',async()=>{
  const b=await browser(),before=state(b);b.launch('Rectangle');typed(b,'10,20');typed(b,'@30,-5');b.flush();
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.equal(b.read('modelReader.records().length'),4);
  assert.equal(b.read('documentController.currentRevision'),before.revision+1);assert.equal(b.read('documentController.historyInfo.entryCount'),before.history.entryCount+1);
  const expected=new Set(['10,20->40,20','40,20->40,15','40,15->10,15','10,15->10,20']);
  assert.deepEqual(new Set(endpoints(b).map(edgeKey)),expected);
  const committed=b.read('modelReader.records()');b.run('window.caderactHistory.undo()');assert.equal(b.read('modelReader.records().length'),0);
  b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.records()'),committed);
});

test('pointer and mixed input use exact resolved corners and finish on P2',async()=>{
  const pointer=await browser();pointer.launch('Rectangle');pointer.point(400,300);pointer.point(450,250,'pointermove');pointer.point(450,250);pointer.flush();
  assert.equal(pointer.read('window.caderactCommandRouter.activeCommand'),null);assert.equal(pointer.read('modelReader.records().length'),4);
  const mixedA=await browser();mixedA.launch('Rectangle');typed(mixedA,'2,3');mixedA.point(450,250);assert.equal(mixedA.read('modelReader.records().length'),4);
  const mixedB=await browser();mixedB.launch('Rectangle');mixedB.point(400,300);typed(mixedB,'7,8');assert.equal(mixedB.read('modelReader.records().length'),4);
});

test('Endpoint, Midpoint, Grid toggle, and Shift all flow through D2A for Rectangle',async()=>{
  const endpoint=await browser();endpoint.run('recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:40,y:20})])');
  endpoint.launch('Rectangle');typed(endpoint,'1,1');endpoint.point(502,201,'pointermove');assert.equal(endpoint.read('activeSnapResult.kind'),'endpoint');endpoint.point(502,201);
  assert.ok(endpoints(endpoint).some(edge=>edge.end.x===20&&edge.end.y===20));

  const midpoint=await browser();midpoint.run('recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:40,y:20})])');
  midpoint.launch('Rectangle');typed(midpoint,'1,1');midpoint.point(552,201,'pointermove');assert.equal(midpoint.read('activeSnapResult.kind'),'midpoint');

  const grid=await browser();grid.emit(grid.gridSnapButton,'click');grid.launch('Rectangle');typed(grid,'1,1');grid.point(451,249,'pointermove');assert.equal(grid.read('activeSnapResult.kind'),'grid');
  grid.emit(grid.gridSnapButton,'click');grid.point(451,249,'pointermove');assert.equal(grid.read('activeSnapResult.snapped'),false);grid.point(451,249);
  assert.ok(endpoints(grid).some(edge=>edge.end.x===10.2&&edge.end.y===10.2));

  const shifted=await browser();shifted.run('recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:40,y:20})])');
  shifted.launch('Rectangle');typed(shifted,'1,1');shifted.point(502,201,'pointermove',{shiftKey:true});assert.equal(shifted.read('activeSnapResult.snapped'),false);
  shifted.point(502,201,'pointerdown',{shiftKey:true});assert.equal(shifted.read('window.caderactCommandRouter.activeCommand'),'Rectangle');
});

test('all four edges inherit the current layer',async()=>{
  const b=await browser();b.run('layerGateway.create("Walls")');const id=b.read('modelReader.layers().find(layer=>layer.name==="Walls").id');
  b.run(`layerGateway.setCurrent(${JSON.stringify(id)})`);b.launch('Rectangle');typed(b,'0,0');typed(b,'5,6');
  assert.deepEqual(b.read('modelReader.records().map(record=>record.layerId)'),[id,id,id,id]);
});

test('Escape and Enter discard empty or first-corner Rectangle drafts without publication',async()=>{
  for(const key of ['Escape','Enter'])for(const withCorner of [false,true]){
    const b=await browser(),before=state(b);b.launch('Rectangle');if(withCorner)typed(b,'2,3');b.key(key);b.flush();
    assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.deepEqual(state(b),before);
    assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,0);assert.equal(b.renders.at(-1).draftPointOverlay.points.length,0);
  }
});

test('zero width or height is rejected without geometry and the draft remains usable',async()=>{
  const b=await browser(),before=state(b);b.launch('Rectangle');typed(b,'2,3');typed(b,'2,9');
  assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'degenerate-rectangle');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Rectangle');assert.deepEqual(state(b),before);
  typed(b,'8,9');assert.equal(b.read('modelReader.records().length'),4);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);
});

test('failed atomic publication preserves the Rectangle draft and retry publishes all four',async()=>{
  const b=await browser(),before=state(b);b.launch('Rectangle');typed(b,'2,3');b.run('window.__blocker=documentController.beginTransaction()');typed(b,'8,9');
  assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'commit-failed');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Rectangle');
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.firstCorner'),{x:2,y:3});assert.deepEqual(state(b),before);
  b.run('window.__blocker.rollback()');typed(b,'8,9');assert.equal(b.read('modelReader.records().length'),4);
});

test('renderer recovery rebuilds the live Rectangle preview without stale or persistent geometry',async()=>{
  const b=await browser();b.launch('Rectangle');typed(b,'2,3');b.point(450,250,'pointermove');b.flush();
  const before=b.read('({first:window.caderactCommandRouter.activeSession.draft.firstCorner,pointer:window.caderactCommandRouter.activeSession.draft.pointerPoint,document:modelReader.snapshot()})');
  const recovered={render:scene=>b.renders.push(scene),resize(){}};b.window.createCaderactRenderer=async()=>recovered;b.fakeRenderer.onDeviceLost();await settle();b.flush();
  assert.deepEqual(b.read('({first:window.caderactCommandRouter.activeSession.draft.firstCorner,pointer:window.caderactCommandRouter.activeSession.draft.pointerPoint,document:modelReader.snapshot()})'),before);
  assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,16);
});
