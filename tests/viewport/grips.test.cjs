const test=require('node:test');
const assert=require('node:assert/strict');
const {browser,settle}=require('../helpers/browser.cjs');

function typed(b,value){b.input.value=value;b.emit(b.input,'input');b.key('Enter',b.input)}
function line(b,a,bp){b.launch();typed(b,`${a.x},${a.y}`);typed(b,`${bp.x},${bp.y}`);b.key('Enter',b.input);return b.read('modelReader.lines().at(-1)')}
function polyline(b,points,closed=false){b.launch('Polyline');for(const p of points)typed(b,`${p.x},${p.y}`);closed?typed(b,'Close'):b.key('Enter',b.input);return b.read('modelReader.records().at(-1)')}

test('selected native Polyline discovers one stable grip per unique vertex and edits one vertex atomically',async()=>{
  const b=await browser();const record=polyline(b,[{x:-20,y:0},{x:0,y:20},{x:20,y:0}],true);b.point(400,200);b.flush();
  const grips=b.read('window.caderactGrips.grips()');assert.equal(grips.length,3);assert.ok(grips.every(g=>g.recordId===record.id&&g.kind==='vertex'));
  assert.deepEqual(grips.map(g=>g.featureId).sort(),record.vertices.map(v=>v.featureId).sort());
  const before=b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount})');b.point(300,300);b.point(325,275,'pointermove');b.flush();assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length,12);
  const preview=b.read('window.caderactGrips.previewRecord()');assert.deepEqual(preview.vertices[0],{...record.vertices[0],x:-15,y:5});assert.deepEqual(preview.vertices.slice(1),record.vertices.slice(1));assert.equal(preview.closed,true);
  b.point(325,275,'pointerup');const changed=b.read('modelReader.records()[0]');assert.equal(changed.id,record.id);assert.equal(changed.layerId,record.layerId);assert.deepEqual(changed.vertices.map(v=>v.featureId),record.vertices.map(v=>v.featureId));assert.deepEqual(changed.vertices[0],{...record.vertices[0],x:-15,y:5});
  assert.equal(b.read('documentController.currentRevision'),before.revision+1);assert.equal(b.read('documentController.historyInfo.entryCount'),before.history+1);b.run('window.caderactHistory.undo()');assert.deepEqual(b.read('modelReader.records()[0]'),record);b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.records()[0]'),changed)
});

test('selected Lines discover two immutable stable-identity endpoint grips',async()=>{
  const b=await browser();const record=line(b,{x:-20,y:0},{x:20,y:0});b.point(400,300);b.flush();
  const grips=b.read('window.caderactGrips.grips()');
  assert.equal(grips.length,2);assert.deepEqual(grips.map(g=>g.featureId).sort(),[record.start.featureId,record.end.featureId].sort());
  assert.ok(grips.every(g=>g.recordId===record.id&&g.kind==='endpoint'));
  assert.equal(b.run('Object.isFrozen(window.caderactGrips.grips()) && window.caderactGrips.grips().every(Object.isFrozen)'),true);
  const projected=b.renders.at(-1).gripOverlay.grips;
  assert.deepEqual(JSON.parse(JSON.stringify(projected.map(g=>g.point).sort((a,b)=>a.x-b.x))),[{x:300,y:300},{x:500,y:300}]);
  assert.equal(b.renders.at(-1).gripOverlay.idleSegments.length,32);
  b.point(300,300,'pointermove');b.flush();assert.equal(b.renders.at(-1).gripOverlay.grips.find(g=>g.featureId===record.start.featureId).state,'hover');
  assert.equal(b.renders.at(-1).gripOverlay.hoverSegments.length,16);
});

test('grip hit priority starts transient preview and release publishes exactly one replacement',async()=>{
  const b=await browser();const record=line(b,{x:-20,y:0},{x:20,y:0});b.point(400,300);
  const before=b.read('({revision:documentController.currentRevision,count:documentController.historyInfo.entryCount,stateId:documentController.currentStateId})');
  const current=`modelReader.lines().find(r=>r.id===${JSON.stringify(record.id)})`;
  b.point(300,300);assert.equal(b.read('window.caderactGrips.isActive'),true);assert.deepEqual(b.read(current+'.start'),record.start);
  b.point(350,250,'pointermove');b.flush();assert.deepEqual(b.read('window.caderactGrips.previewRecord().start'),{...record.start,x:-10,y:10});
  assert.deepEqual(b.read(current+'.start'),record.start);
  b.point(350,250,'pointerup');
  const after=b.read('({record:'+current+',revision:documentController.currentRevision,count:documentController.historyInfo.entryCount})');
  assert.deepEqual(after.record,{...record,start:{...record.start,x:-10,y:10}});
  assert.equal(after.revision,before.revision+1);assert.equal(after.count,before.count+1);assert.equal(b.read('window.caderactGrips.isActive'),false);
  b.run('window.caderactHistory.undo()');assert.deepEqual(b.read(current+'.start'),record.start);
  b.run('window.caderactHistory.redo()');assert.deepEqual(b.read(current+'.start'),{...record.start,x:-10,y:10});
});

test('same-coordinate release is a no-op and Escape or pointer abort cancels without publication',async()=>{
  const b=await browser();const record=line(b,{x:-20,y:0},{x:20,y:0});b.point(400,300);
  const before=b.read('({revision:documentController.currentRevision,count:documentController.historyInfo.entryCount,stateId:documentController.currentStateId,dirty:documentController.isDirty})');
  b.point(300,300);b.point(300,300,'pointerup');assert.deepEqual(b.read('({revision:documentController.currentRevision,count:documentController.historyInfo.entryCount,stateId:documentController.currentStateId,dirty:documentController.isDirty})'),before);
  b.point(300,300);b.point(360,240,'pointermove');const escape=b.key('Escape');assert.equal(escape.defaultPrevented,true);assert.equal(b.read('window.caderactGrips.isActive'),false);
  assert.deepEqual(b.read(`modelReader.lines().find(r=>r.id===${JSON.stringify(record.id)}).start`),record.start);
  b.point(300,300);b.point(360,240,'pointermove');b.point(360,240,'pointercancel');assert.equal(b.read('window.caderactGrips.isActive'),false);
  b.point(300,300);b.canvas.capturedPointer=undefined;b.point(300,300,'lostpointercapture');assert.equal(b.read('window.caderactGrips.isActive'),false);
  b.point(300,300);b.point(360,240,'pointermove');b.point(360,240,'pointerleave');assert.equal(b.read('window.caderactGrips.isActive'),false);
  assert.deepEqual(b.read('({revision:documentController.currentRevision,count:documentController.historyInfo.entryCount,stateId:documentController.currentStateId,dirty:documentController.isDirty})'),before);
});

test('grip dragging reuses D2 enabled modes while the Grid Snap toggle remains transient',async()=>{
  const b=await browser();const moving=line(b,{x:-20,y:0},{x:20,y:0});const target=line(b,{x:-10,y:10},{x:0,y:10});
  b.point(400,300);b.run('window.caderactViewport.setGridSnapEnabled(false)');
  const state=b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo.entryCount})');
  b.point(300,300);b.point(350.5,250.5,'pointermove');
  assert.equal(b.read('activeSnapResult.kind'),'endpoint');assert.deepEqual(b.read('window.caderactGrips.previewRecord().start'),{...moving.start,x:target.start.x,y:target.start.y});
  b.point(350.5,250.5,'pointerup');
  assert.deepEqual(b.read(`modelReader.lines().find(r=>r.id===${JSON.stringify(moving.id)}).start`),{...moving.start,x:target.start.x,y:target.start.y});
  const after=b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo.entryCount})');
  assert.equal(after.revision,state.revision+1);assert.equal(after.history,state.history+1);
});

test('active endpoint excludes only itself from D2 while its opposite endpoint remains available',async()=>{
  const b=await browser();const record=line(b,{x:-20,y:0},{x:20,y:0});b.point(400,300);b.run('window.caderactViewport.setGridSnapEnabled(false)');
  b.point(300,300);b.point(301,300,'pointermove');assert.equal(b.read('activeSnapResult.snapped'),false);
  assert.equal(b.read('window.caderactGrips.previewRecord().start.x'),-19.8);
  b.point(499,300,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');
  assert.equal(b.read('activeSnapResult.reference.featureId'),record.end.featureId);b.key('Escape');
});

test('coincident grip hit ties are stable across record enumeration order',async()=>{
  const b=await browser();b.window.__coincident=[
    {id:'z',type:'line',start:{x:0,y:0,featureId:'z-start'},end:{x:1,y:0,featureId:'z-end'}},
    {id:'a',type:'line',start:{x:0,y:0,featureId:'a-start'},end:{x:-1,y:0,featureId:'a-end'}},
  ];
  const expression=records=>`window.CaderactGrips.hitTestGrips({screenPoint:{x:0,y:0},grips:window.CaderactGrips.discoverLineGrips(${records},['a','z']),worldToScreen:(x,y)=>({x,y})}).grip`;
  assert.equal(b.read(expression('window.__coincident')).recordId,'a');
  assert.equal(b.read(expression('window.__coincident.slice().reverse()')).recordId,'a');
});

test('long drag creates no intermediate history and one release publication',async()=>{
  const b=await browser();const record=line(b,{x:-20,y:0},{x:20,y:0});b.point(400,300);
  const before=b.read('({revision:documentController.currentRevision,count:documentController.historyInfo.entryCount,stateId:documentController.currentStateId})');
  b.point(300,300);for(let i=1;i<=50;i++)b.point(300+i,300-i,'pointermove');
  assert.deepEqual(b.read('({revision:documentController.currentRevision,count:documentController.historyInfo.entryCount,stateId:documentController.currentStateId})'),before);
  b.point(350,250,'pointerup');const after=b.read('({revision:documentController.currentRevision,count:documentController.historyInfo.entryCount})');
  assert.equal(after.revision,before.revision+1);assert.equal(after.count,before.count+1);
  assert.equal(b.read(`modelReader.lines().find(r=>r.id===${JSON.stringify(record.id)}).start.featureId`),record.start.featureId);
});

test('target deletion and renderer recovery terminate drag and release pointer capture',async()=>{
  const deleted=await browser();const record=line(deleted,{x:-20,y:0},{x:20,y:0});deleted.point(400,300);deleted.point(300,300);
  assert.equal(deleted.canvas.capturedPointer,1);
  deleted.run(`const t=documentController.beginTransaction();t.remove(${JSON.stringify(record.id)});t.publish()`);
  assert.equal(deleted.read('window.caderactGrips.isActive'),false);assert.equal(deleted.canvas.capturedPointer,undefined);

  const recovered=await browser();line(recovered,{x:-20,y:0},{x:20,y:0});recovered.point(400,300);recovered.point(300,300);
  const originalCanvas=recovered.canvas;recovered.fakeRenderer.render=()=>{throw new Error('grip recovery')};recovered.point(340,260,'pointermove');recovered.flush();await settle();
  assert.equal(recovered.read('window.caderactGrips.isActive'),false);assert.equal(originalCanvas.capturedPointer,undefined);
  assert.equal(recovered.read('window.caderactViewport.getRendererState().status'),'ready');
});

test('multi-selection shows every endpoint, active commands exclude grips, and deletion reconciles safely',async()=>{
  const b=await browser();const a=line(b,{x:-20,y:0},{x:20,y:0});const c=line(b,{x:-20,y:20},{x:20,y:20});
  b.point(400,300);b.point(400,200,'pointerdown',{ctrlKey:true});b.flush();assert.equal(b.renders.at(-1).gripOverlay.grips.length,4);
  b.launch();b.flush();assert.equal(b.renders.at(-1).gripOverlay.grips.length,0);b.key('Escape');
  b.point(300,300);assert.equal(b.read('window.caderactGrips.isActive'),true);
  b.run(`const t=documentController.beginTransaction();t.remove(${JSON.stringify(a.id)});t.publish()`);
  assert.equal(b.read('window.caderactGrips.isActive'),false);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[c.id]);
});

test('grip geometry stays symmetric in CSS space across fractional centers and DPR',async()=>{
  const b=await browser();b.window.__records=[{id:'r',type:'line',layerId:'l',start:{x:.125,y:.375,featureId:'a'},end:{x:2.625,y:-1.125,featureId:'b'}}];
  for(const dpr of [1,1.25,1.5,2]){
    b.window.devicePixelRatio=dpr;
    const scene=b.run(`window.CaderactViewportScene.createSceneBuilder({viewportSettings:{gridExtent:0,minimumGridSpacingPixels:28,backgroundColor:'#000',gridColor:'#111',majorGridColor:'#222',xAxisColor:'#333',yAxisColor:'#444',geometryColor:'#555',previewColor:'#666',snapMarkerColor:'#777',selectionColor:'#888',gripColor:'#999'},camera:{state:{zoom:1},screenToWorld:(x,y)=>({x,y}),worldToScreen:(x,y)=>({x:x+10.25,y:20.75-y})},getViewportSize:()=>({width:100,height:100}),getRecords:()=>window.__records,getSelectedIds:()=>['r'],getGrips:()=>window.CaderactGrips.discoverLineGrips(window.__records,['r'])}).createScene()`);
    const center=scene.gripOverlay.grips[0].point,s=Array.from(scene.gripOverlay.idleSegments.slice(0,16));
    assert.equal(center.x,10.375);assert.equal(center.y,20.375);assert.equal((s[0]+s[2])/2,center.x);assert.equal((s[1]+s[9])/2,center.y);
  }
});

test('draft accepted-point markers and idle endpoint grips share exact visual width, height, and centers', async () => {
  const b = await browser();
  // Create committed line for grips
  b.run('recordGateway.createAll([recordGateway.createLine({ x: 10, y: 20 }, { x: 30, y: 20 })])');
  b.point(450, 200); // select the line -> grips appear
  b.flush();

  for (const [zoom, panX, panY, dpr] of [
    [0.5, 200, 150, 1],
    [1, 400, 300, 1],
    [2.5, 420.5, 280.25, 1.25],
    [5, -100, 50, 1.5],
    [8, 500, -200, 2],
  ]) {
    b.run(`camera.zoom=${zoom};camera.panX=${panX};camera.panY=${panY};window.devicePixelRatio=${dpr}`);

    // 1. Evaluate scene with committed selection grip matching (10, 20)
    const gripScene = b.run('createScene()');
    const grip = gripScene.gripOverlay.grips.find(g => Math.abs(g.point.x - (panX + 10 * zoom)) < 1e-4 && Math.abs(g.point.y - (panY - 20 * zoom)) < 1e-4);
    const gripIndex = gripScene.gripOverlay.grips.indexOf(grip);
    const gripSegments = Array.from(gripScene.gripOverlay.idleSegments.slice(gripIndex * 16, (gripIndex + 1) * 16));

    // Grip bounding box
    const gripXs = [gripSegments[0], gripSegments[2], gripSegments[4], gripSegments[6]];
    const gripYs = [gripSegments[1], gripSegments[3], gripSegments[5], gripSegments[7]];
    const gripWidth = Math.max(...gripXs) - Math.min(...gripXs);
    const gripHeight = Math.max(...gripYs) - Math.min(...gripYs);
    const gripCenterX = (Math.max(...gripXs) + Math.min(...gripXs)) / 2;
    const gripCenterY = (Math.max(...gripYs) + Math.min(...gripYs)) / 2;

    assert.equal(gripWidth, 6);
    assert.equal(gripHeight, 6);
    assert.equal(Math.abs(gripCenterX - grip.point.x) < 1e-4, true);
    assert.equal(Math.abs(gripCenterY - grip.point.y) < 1e-4, true);

    // 2. Clear selection, start Line draft at same world coordinate (10, 20)
    b.run('window.caderactSelection.clear()');
    b.launch();
    b.run(`window.caderactCommandRouter.activeSession.draft.acceptPoint(Object.freeze({ x: 10, y: 20 }))`);
    const draftScene = b.run('createScene()');
    const draftPoint = draftScene.draftPointOverlay.points[0];
    const draftSegments = Array.from(draftScene.draftPointOverlay.segments.slice(0, 16));

    // Draft marker bounding box
    const draftXs = [draftSegments[0], draftSegments[2], draftSegments[4], draftSegments[6]];
    const draftYs = [draftSegments[1], draftSegments[3], draftSegments[5], draftSegments[7]];
    const draftWidth = Math.max(...draftXs) - Math.min(...draftXs);
    const draftHeight = Math.max(...draftYs) - Math.min(...draftYs);
    const draftCenterX = (Math.max(...draftXs) + Math.min(...draftXs)) / 2;
    const draftCenterY = (Math.max(...draftYs) + Math.min(...draftYs)) / 2;

    // Direct comparison: draft marker size === idle grip size
    assert.equal(draftWidth, gripWidth);
    assert.equal(draftHeight, gripHeight);
    assert.equal(draftWidth, 6);
    assert.equal(draftHeight, 6);

    // Direct comparison: centers remain exact
    assert.equal(Math.abs(draftCenterX - gripCenterX) < 1e-4, true);
    assert.equal(Math.abs(draftCenterY - gripCenterY) < 1e-4, true);
    assert.equal(Math.abs(draftPoint.point.x - grip.point.x) < 1e-4, true);
    assert.equal(Math.abs(draftPoint.point.y - grip.point.y) < 1e-4, true);

    // Clean up draft and re-select line for next iteration
    b.run('window.caderactCommandRouter.cancelActive()');
    b.run('window.caderactSelection.selectOnly(modelReader.lines()[0].id)');
  }
});
