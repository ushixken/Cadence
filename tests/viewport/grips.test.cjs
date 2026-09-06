const test=require('node:test');
const assert=require('node:assert/strict');
const {browser,settle}=require('../helpers/browser.cjs');

function typed(b,value){b.input.value=value;b.emit(b.input,'input');b.key('Enter',b.input)}
function line(b,a,bp){b.launch();typed(b,`${a.x},${a.y}`);typed(b,`${bp.x},${bp.y}`);b.key('Enter',b.input);return b.read('modelReader.lines().at(-1)')}

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
