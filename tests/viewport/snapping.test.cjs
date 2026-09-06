const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

function typed(b,value){b.input.value=value;b.emit(b.input,'input');b.key('Enter',b.input)}
function installRecord(b,record){b.window.__snapRecord=record}
function resolve(b,{raw,zoom=1,panX=0,panY=0,spacing=10,records='[window.__snapRecord]'}){
  return b.read(`window.CaderactSnapResolver.createResolver().resolve({rawWorldPoint:${JSON.stringify(raw)},
    worldToScreen:(x,y)=>({x:${panX}+x*${zoom},y:${panY}-y*${zoom}}),records:${records},gridSpacing:${spacing}})`)
}
const record={id:'line_b',type:'line',layerId:'layer',start:{x:-10,y:-20,featureId:'feature_start'},end:{x:30,y:40,featureId:'feature_end'}};

test('endpoint snaps use exact authoritative coordinates and canonical A10 references',async()=>{
  const b=await browser();installRecord(b,record);
  for(const [raw,point,featureId] of [[{x:-7,y:-20},{x:-10,y:-20},'feature_start'],[{x:27,y:40},{x:30,y:40},'feature_end']]){
    const snap=resolve(b,{raw,zoom:2});assert.equal(snap.snapped,true);assert.equal(snap.kind,'endpoint');assert.deepEqual(snap.point,point);
    assert.deepEqual(snap.reference,{kind:'feature',recordId:'line_b',featureId});
  }
  assert.equal(resolve(b,{raw:{x:20,y:20},zoom:2,spacing:1e300}).snapped,false);
});

test('midpoints are derived at full precision for horizontal, vertical, diagonal, and negative Lines',async()=>{
  const b=await browser();
  const records=[
    {id:'h',type:'line',start:{x:-3.5,y:2,featureId:'h1'},end:{x:4.5,y:2,featureId:'h2'}},
    {id:'v',type:'line',start:{x:-8,y:-9,featureId:'v1'},end:{x:-8,y:5,featureId:'v2'}},
    {id:'d',type:'line',start:{x:-1.1,y:-2.2,featureId:'d1'},end:{x:2.2,y:4.4,featureId:'d2'}},
  ];b.window.__records=records;
  for(const point of [{x:.5,y:2},{x:-8,y:-2},{x:.55,y:1.1}]){
    const snap=resolve(b,{raw:point,zoom:100,spacing:1000,records:'window.__records'});assert.equal(snap.kind,'midpoint');assert.deepEqual(snap.point,point);assert.equal(snap.reference,null);
  }
});

test('grid snaps to origin and nearest positive/negative adaptive-grid multiples independent of pan',async()=>{
  const b=await browser();b.window.__none=[];
  for(const [raw,expected] of [[{x:.2,y:-.3},{x:0,y:0}],[{x:14.9,y:-16},{x:10,y:-20}],[{x:-24.9,y:25.1},{x:-20,y:30}]]){
    const first=resolve(b,{raw,zoom:1,spacing:10,records:'window.__none'});const panned=resolve(b,{raw,zoom:1,panX:900,panY:-700,spacing:10,records:'window.__none'});
    assert.equal(first.kind,'grid');assert.deepEqual(first.point,expected);assert.deepEqual(panned.point,expected);
  }
  b.run('camera.zoom=14');assert.equal(b.run('sceneBuilder.getAdaptiveGridSpacing()'),2);
});

test('nearest distance dominates and endpoint priority resolves close collisions deterministically',async()=>{
  const b=await browser();installRecord(b,{id:'z',type:'line',start:{x:0,y:0,featureId:'z1'},end:{x:100,y:0,featureId:'z2'}});
  assert.equal(resolve(b,{raw:{x:9.9,y:0},zoom:1}).kind,'grid');
  assert.equal(resolve(b,{raw:{x:4.7,y:0},zoom:1}).kind,'endpoint');
  const forward=resolve(b,{raw:{x:0,y:0},records:'[window.__snapRecord,{...window.__snapRecord,id:"a",start:{...window.__snapRecord.start,featureId:"a1"},end:{...window.__snapRecord.end,featureId:"a2"}}]'});
  const reverse=resolve(b,{raw:{x:0,y:0},records:'[{...window.__snapRecord,id:"a",start:{...window.__snapRecord.start,featureId:"a1"},end:{...window.__snapRecord.end,featureId:"a2"}},window.__snapRecord]'});
  assert.deepEqual(forward,reverse);
});

test('10 CSS-pixel tolerance stays stable across zoom and DPR and extreme zoom remains finite',async()=>{
  const b=await browser();installRecord(b,{id:'z',type:'line',start:{x:0,y:0,featureId:'z1'},end:{x:100,y:0,featureId:'z2'}});
  for(const zoom of [0.001,1,1000]){
    assert.equal(resolve(b,{raw:{x:9/zoom,y:0},zoom,spacing:1e300}).snapped,true);
    assert.equal(resolve(b,{raw:{x:11/zoom,y:0},zoom,spacing:1e300}).snapped,false);
  }
  b.window.devicePixelRatio=3;assert.equal(resolve(b,{raw:{x:9,y:0},zoom:1,spacing:1e300}).snapped,true);
  for(const zoom of [1e-300,1e300]){const snap=resolve(b,{raw:{x:1/zoom,y:0},zoom,spacing:1e300});assert.ok(Number.isFinite(snap.point.x));assert.ok(Number.isFinite(snap.point.y));}
});

test('Line preview and click use exact snapped point and transient marker clears outside tolerance and on finish',async()=>{
  const b=await browser();b.launch();typed(b,'13,17');typed(b,'33,17');b.key('Enter',b.input);
  const persistentBefore=b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo})');
  b.launch();b.point(400,300);b.point(471,215,'pointermove');b.flush();
  assert.equal(b.read('activeSnapResult.kind'),'endpoint');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'),{x:13,y:17});
  assert.equal(b.renders.at(-1).snapOverlay.kind,'endpoint');assert.equal(b.renders.at(-1).lineGroups[6].segments.length,16);
  assert.deepEqual(b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo})'),persistentBefore);
  b.point(490,240,'pointermove');b.flush();assert.equal(b.read('activeSnapResult.snapped'),false);assert.equal(b.renders.at(-1).snapOverlay,null);
  b.point(471,215,'pointerdown');assert.deepEqual(b.read('(({x,y})=>({x,y}))(window.caderactCommandRouter.activeSession.draft.draftSegments()[0].end)'),{x:13,y:17});
  b.key('Enter');b.flush();assert.equal(b.renders.at(-1).snapOverlay,null);assert.equal(b.read('activeSnapResult'),null);
});

test('Escape clears markers, typed coordinates bypass snapping, and mixed input remains exact',async()=>{
  const b=await browser();b.launch();typed(b,'13,17');typed(b,'33,17');b.key('Enter',b.input);
  b.launch();typed(b,'0.123,0.456');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.currentPoint'),{x:.123,y:.456});
  b.point(471,215,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');b.point(471,215);
  typed(b,'@0.111,0.222');assert.equal(b.read('activeSnapResult'),null);
  const last=b.read('window.caderactCommandRouter.activeSession.draft.currentPoint');assert.deepEqual(last,{x:13.111,y:17.222});
  b.point(471,215,'pointermove');b.key('Escape');b.flush();assert.equal(b.read('activeSnapResult'),null);assert.equal(b.renders.at(-1).snapOverlay,null);
});

test('authoritative Undo/New state immediately changes available endpoint candidates without permanent dots',async()=>{
  const b=await browser();b.launch();typed(b,'13,17');typed(b,'33,17');b.key('Enter',b.input);b.flush();
  b.run('window.__snapFile=window.CaderactPersistence.serializeDocument(modelReader.snapshot())');
  assert.equal(b.renders.at(-1).lineGroups[6].segments.length,0);
  b.launch();b.point(400,300);b.point(471,215,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');b.key('Escape');
  b.run('window.caderactHistory.undo()');b.launch();b.point(400,300);b.point(471,215,'pointermove');assert.notEqual(b.read('activeSnapResult')?.kind,'endpoint');b.key('Escape');
  b.run('window.caderactHistory.redo()');b.launch();b.point(400,300);b.point(471,215,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');b.key('Escape');
  b.run('window.caderactDocumentSession.replaceStore(window.CaderactDocument.createStore({initiallySaved:true}),{reason:"test-new"})');
  b.launch();b.point(400,300);b.point(471,215,'pointermove');assert.notEqual(b.read('activeSnapResult')?.kind,'endpoint');b.key('Escape');
  b.run(`window.__snapAdapters={confirmDiscard:async()=>true,writeFile:async()=>{},pickOpenFile:async()=>({name:'snap.caderact',text:async()=>window.__snapFile})};
    window.__snapFiles=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:window.__snapAdapters})`);
  await b.run('window.__snapFiles.open()');b.launch();b.point(400,300);b.point(471,215,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');
});
