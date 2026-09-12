const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

function typed(b,value){b.input.value=value;b.emit(b.input,'input');b.key('Enter',b.input)}
function installRecord(b,record){b.window.__snapRecord=record}
function resolve(b,{raw,zoom=1,panX=0,panY=0,spacing=10,records='[window.__snapRecord]',enabled='{}',transientCandidates='[]'}){
  return b.read(`window.CaderactSnapResolver.createResolver().resolve({rawWorldPoint:${JSON.stringify(raw)},
    worldToScreen:(x,y)=>({x:${panX}+x*${zoom},y:${panY}-y*${zoom}}),records:${records},transientCandidates:${transientCandidates},gridSpacing:${spacing},enabled:${enabled}})`)
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

test('enabled snap modes exclude only grid candidates',async()=>{
  const b=await browser();installRecord(b,record);
  const modes='{endpoint:true,midpoint:true,grid:false}';
  assert.equal(resolve(b,{raw:{x:10.1,y:10.1},spacing:10,records:'[]',enabled:modes}).snapped,false);
  assert.equal(resolve(b,{raw:{x:-10,y:-20},spacing:10,enabled:modes}).kind,'endpoint');
  assert.equal(resolve(b,{raw:{x:10,y:10},spacing:10,enabled:modes}).kind,'midpoint');
  assert.equal(resolve(b,{raw:{x:10.1,y:10.1},spacing:10,records:'[]',enabled:'{endpoint:true,midpoint:true,grid:true}'}).kind,'grid');
});

test('command transient candidates use the shared resolver and Grid OFF leaves Draft Point enabled',async()=>{
  const b=await browser();
  const candidates='[{kind:"draft-point",point:{x:7,y:9},stableKey:"draft:0",reference:{kind:"draft-point",index:0}}]';
  const snap=resolve(b,{raw:{x:7.1,y:9.1},records:'[]',spacing:1,enabled:'{endpoint:true,midpoint:true,grid:false}',transientCandidates:candidates});
  assert.equal(snap.kind,'draft-point');assert.deepEqual(snap.point,{x:7,y:9});assert.deepEqual(snap.reference,{kind:'draft-point',index:0});
});

test('Endpoint, Draft Point, Midpoint, and Grid markers have distinct centered geometry',async()=>{
  const b=await browser(), shapes=new Map();
  for(const kind of ['endpoint','draft-point','midpoint','grid']){
    b.run(`activeSnapResult=Object.freeze({snapped:true,kind:${JSON.stringify(kind)},point:Object.freeze({x:0,y:0})})`);
    const marker=b.run('createScene().snapOverlay'), segments=Array.from(marker.segments);
    assert.equal(marker.point.x,400);assert.equal(marker.point.y,300);
    const xs=[],ys=[];
    for(let i=0;i<segments.length;i+=4){xs.push(segments[i],segments[i+2]);ys.push(segments[i+1],segments[i+3]);}
    assert.equal(Math.min(...xs)+Math.max(...xs),800,`${kind} must balance horizontally`);
    assert.equal(Math.min(...ys)+Math.max(...ys),600,`${kind} must balance vertically`);
    shapes.set(kind,JSON.stringify(segments));
  }
  assert.equal(new Set(shapes.values()).size,4);
});

test('Grid marker uses exact projection and symmetric fixed screen-space hash geometry',async()=>{
  const b=await browser();
  for(const [zoom,panX,panY,dpr,point] of [[5,400,300,1,{x:2,y:4}],[1.25,400.25,299.75,1.25,{x:-10,y:20}],[3.5,-17.5,42.25,1.5,{x:3,y:-7}],[8,100,80,2,{x:.5,y:1.25}]]){
    b.run(`camera.zoom=${zoom};camera.panX=${panX};camera.panY=${panY};window.devicePixelRatio=${dpr};activeSnapResult=Object.freeze({snapped:true,kind:"grid",point:Object.freeze(${JSON.stringify(point)})})`);
    const scene=b.run('createScene()');const marker=scene.snapOverlay;const expected={x:panX+point.x*zoom,y:panY-point.y*zoom};
    assert.equal(marker.point.x,expected.x);assert.equal(marker.point.y,expected.y);
    const s=Array.from(marker.segments);assert.equal(s.length,16);
    const close=(a,c)=>assert.ok(Math.abs(a-c)<1e-5,`${a} != ${c}`);
    for(let i=0;i<s.length;i+=4){close((s[i]+s[i+2])/2, i<8 ? expected.x+(i===0?-2.5:2.5) : expected.x);close((s[i+1]+s[i+3])/2, i<8 ? expected.y : expected.y+(i===8?-2.5:2.5));}
    close(s[1],expected.y-5);close(s[3],expected.y+5);close(s[9],expected.y-2.5);close(s[11],expected.y-2.5);
  }
});

test('Grid snap target and visible lattice stay coincident through adaptive spacing transitions',async()=>{
  const b=await browser();
  for(const [zoom,spacing] of [[2.8,10],[1.4,20],[.56,50],[.28,100]]){
    b.run(`camera.zoom=${zoom};camera.panX=400.25;camera.panY=300.75`);
    const raw={x:2*spacing+.1/zoom,y:-2*spacing+.1/zoom};b.window.__raw=raw;
    b.run(`activeSnapResult=snapResolver.resolve({rawWorldPoint:window.__raw,worldToScreen,records:[],gridSpacing:${spacing},enabled:{grid:true}})`);
    const scene=b.run('createScene()'),target={x:400.25+2*spacing*zoom,y:300.75+2*spacing*zoom};assert.equal(scene.grid.minorSpacing,spacing);
    assert.deepEqual(b.read('activeSnapResult.point'),{x:2*spacing,y:-2*spacing});assert.equal(scene.snapOverlay.point.x,target.x);assert.equal(scene.snapOverlay.point.y,target.y);
    const grid=[...scene.grid.minorSegments,...scene.grid.majorSegments];
    assert.ok(grid.some((value,index)=>index%4===0&&value===target.x&&grid[index+2]===target.x));
    assert.ok(grid.some((value,index)=>index%4===1&&value===target.y&&grid[index-1]!==grid[index+1]));
  }
});

test('Grid Snap button toggles transient grid acquisition while endpoints, midpoints, and visual grid remain',async()=>{
  const b=await browser();typed(b,'Line');typed(b,'10,10');typed(b,'30,10');b.key('Enter',b.input);b.flush();
  const before=b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})');
  const gridSegments=b.renders.at(-1).grid.minorSegments.length+b.renders.at(-1).grid.majorSegments.length;
  assert.equal(b.gridSnapButton.classList.contains('is-active'),false);assert.equal(b.gridSnapButton.getAttribute('aria-pressed'),'false');
  assert.ok(gridSegments>0);assert.equal(b.emit(b.gridSnapButton,'mousedown').defaultPrevented,true);
  assert.equal(b.renders.at(-1).grid.minorSegments.length+b.renders.at(-1).grid.majorSegments.length,gridSegments);
  b.launch();typed(b,'0,0');b.point(403,353,'pointermove');assert.equal(b.read('activeSnapResult.snapped'),false);
  b.point(450,250,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');
  b.point(500,250,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'midpoint');
  b.emit(b.gridSnapButton,'click');b.point(403,353,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'grid');
  assert.equal(b.gridSnapButton.getAttribute('aria-pressed'),'true');assert.deepEqual(b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})'),before);
  b.emit(b.gridSnapButton,'click');b.point(403,353,'pointermove');assert.equal(b.read('activeSnapResult.snapped'),false);
  b.point(450,250,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');
  b.key('Escape');b.run('window.caderactViewport.setGridSnapEnabled(true);window.caderactViewport.resetForDocumentReplacement()');
  assert.equal(b.gridSnapButton.getAttribute('aria-pressed'),'true');
});

test('nearest distance dominates and endpoint priority resolves close collisions deterministically',async()=>{
  const b=await browser();installRecord(b,{id:'z',type:'line',start:{x:0,y:0,featureId:'z1'},end:{x:100,y:0,featureId:'z2'}});
  assert.equal(resolve(b,{raw:{x:9.9,y:0},zoom:1}).kind,'grid');
  assert.equal(resolve(b,{raw:{x:4.7,y:0},zoom:1}).kind,'endpoint');
  const forward=resolve(b,{raw:{x:0,y:0},records:'[window.__snapRecord,{...window.__snapRecord,id:"a",start:{...window.__snapRecord.start,featureId:"a1"},end:{...window.__snapRecord.end,featureId:"a2"}}]'});
  const reverse=resolve(b,{raw:{x:0,y:0},records:'[{...window.__snapRecord,id:"a",start:{...window.__snapRecord.start,featureId:"a1"},end:{...window.__snapRecord.end,featureId:"a2"}},window.__snapRecord]'});
  assert.deepEqual(forward,reverse);
});

test('crowded near ties are selected from one nearest-distance window without comparator cycles',async()=>{
  const b=await browser();
  b.window.__crowded=[
    {id:'endpoint',type:'line',start:{x:1.2,y:0,featureId:'e1'},end:{x:100,y:0,featureId:'e2'}},
    {id:'midpoint',type:'line',start:{x:-19.4,y:0,featureId:'m1'},end:{x:20.6,y:0,featureId:'m2'}},
  ];
  const forward=resolve(b,{raw:{x:0,y:0},records:'window.__crowded',spacing:10});
  const reverse=resolve(b,{raw:{x:0,y:0},records:'[...window.__crowded].reverse()',spacing:10});
  assert.equal(forward.kind,'midpoint');assert.ok(Math.abs(forward.distancePx-.6)<1e-12);
  assert.deepEqual(reverse,forward);
});

test('real pointer path acquires every supported snap kind',async()=>{
  const b=await browser();
  b.emit(b.gridSnapButton,'click');
  b.run('recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:40,y:20})])');
  b.launch();typed(b,'7,7');
  for(const target of [
    {screen:[500,200],kind:'endpoint'},
    {screen:[550,200],kind:'midpoint'},
    {screen:[450,250],kind:'grid'},
    {screen:[435,265],kind:'draft-point'},
  ]){
    b.point(...target.screen,'pointermove');assert.equal(b.read('activeSnapResult.kind'),target.kind);
  }
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
  assert.equal(b.renders.at(-1).snapOverlay.kind,'endpoint');assert.equal(b.renders.at(-1).lineGroups[16].segments.length,16);
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
  assert.equal(b.renders.at(-1).lineGroups[16].segments.length,0);
  b.launch();b.point(400,300);b.point(471,215,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');b.key('Escape');
  b.run('window.caderactHistory.undo()');b.launch();b.point(400,300);b.point(471,215,'pointermove');assert.notEqual(b.read('activeSnapResult')?.kind,'endpoint');b.key('Escape');
  b.run('window.caderactHistory.redo()');b.launch();b.point(400,300);b.point(471,215,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');b.key('Escape');
  b.run('window.caderactDocumentSession.replaceStore(window.CaderactDocument.createStore({initiallySaved:true}),{reason:"test-new"})');
  b.launch();b.point(400,300);b.point(471,215,'pointermove');assert.notEqual(b.read('activeSnapResult')?.kind,'endpoint');b.key('Escape');
  b.run(`window.__snapAdapters={confirmDiscard:async()=>true,writeFile:async()=>{},pickOpenFile:async()=>({name:'snap.caderact',text:async()=>window.__snapFile})};
    window.__snapFiles=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:window.__snapAdapters})`);
  await b.run('window.__snapFiles.open()');b.launch();b.point(400,300);b.point(471,215,'pointermove');assert.equal(b.read('activeSnapResult.kind'),'endpoint');
});
