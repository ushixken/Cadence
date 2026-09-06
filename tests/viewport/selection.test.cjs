const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

function typed(b,value){b.input.value=value;b.emit(b.input,'input');b.key('Enter',b.input)}
function line(b,a,bp){b.launch();typed(b,`${a.x},${a.y}`);typed(b,`${bp.x},${bp.y}`);b.key('Enter',b.input);return b.read('modelReader.lines().at(-1).id')}
function hit(b,record,point,{zoom=1,panX=0,panY=0,tolerance=8}={}){
  b.window.__hitRecord=record;
  return b.read(`window.CaderactSelection.hitTestLines({screenPoint:${JSON.stringify(point)},records:[window.__hitRecord],
    worldToScreen:(x,y)=>({x:${panX}+x*${zoom},y:${panY}-y*${zoom}}),tolerancePx:${tolerance}})`)
}
const make=(id,start,end)=>({id,type:'line',start:{...start,featureId:`${id}a`},end:{...end,featureId:`${id}b`}});

test('pure projected Line hit testing handles orientations, short/zero Lines, and tolerance',async()=>{
  const b=await browser();
  for(const [record,point] of [[make('h',{x:-10,y:0},{x:10,y:0}),{x:0,y:7}],
    [make('v',{x:2,y:-10},{x:2,y:10}),{x:7,y:0}],
    [make('d',{x:-10,y:-10},{x:10,y:10}),{x:3,y:-3}],
    [make('s',{x:-2,y:-3},{x:-1.5,y:-2.5}),{x:-1.5,y:2}],
    [make('z',{x:-4,y:-6},{x:-4,y:-6}),{x:-4,y:-1}]]){
    const result=hit(b,record,point);assert.equal(result.hit,true);assert.equal(result.recordId,record.id);
  }
  assert.equal(hit(b,make('out',{x:-10,y:0},{x:10,y:0}),{x:0,y:8.01}).hit,false);
});

test('nearest overlapping object wins and exact ties use stable record ID independent of order',async()=>{
  const b=await browser();b.window.__hits=[make('z',{x:-10,y:0},{x:10,y:0}),make('a',{x:-10,y:0},{x:10,y:0}),make('near',{x:-10,y:3},{x:10,y:3})];
  assert.equal(b.read(`window.CaderactSelection.hitTestLines({screenPoint:{x:0,y:-2.8},records:window.__hits,worldToScreen:(x,y)=>({x,y:-y})}).recordId`),'near');
  assert.equal(b.read(`window.CaderactSelection.hitTestLines({screenPoint:{x:0,y:0},records:window.__hits.slice(0,2),worldToScreen:(x,y)=>({x,y:-y})}).recordId`),'a');
  assert.equal(b.read(`window.CaderactSelection.hitTestLines({screenPoint:{x:0,y:0},records:window.__hits.slice(0,2).reverse(),worldToScreen:(x,y)=>({x,y:-y})}).recordId`),'a');
});

test('hit tolerance stays in CSS pixels across zoom, pan, and DPR',async()=>{
  const b=await browser();const record=make('line',{x:-100,y:0},{x:100,y:0});
  for(const zoom of [.01,1,1000]){
    assert.equal(hit(b,record,{x:321,y:207},{zoom,panX:321,panY:200}).hit,true);
    assert.equal(hit(b,record,{x:321,y:209},{zoom,panX:321,panY:200}).hit,false);
  }
  b.window.devicePixelRatio=4;assert.equal(hit(b,record,{x:321,y:207},{panX:321,panY:200}).hit,true);
});

test('idle click, replacement click, empty click, and Ctrl/Meta toggles follow selection rules',async()=>{
  const b=await browser();const first=line(b,{x:-20,y:0},{x:20,y:0});const second=line(b,{x:-20,y:20},{x:20,y:20});
  const persistent=b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})');
  b.point(400,300);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[first]);
  b.point(400,200);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[second]);
  b.point(400,300,'pointerdown',{ctrlKey:true});assert.deepEqual(b.read('window.caderactSelection.selectedIds()').sort(),[first,second].sort());
  b.point(400,200,'pointerdown',{ctrlKey:true});assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[first]);
  b.point(700,500,'pointerdown',{ctrlKey:true});assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[first]);
  b.point(400,200,'pointerdown',{metaKey:true});assert.deepEqual(b.read('window.caderactSelection.selectedIds()').sort(),[first,second].sort());
  b.point(700,500);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);
  assert.deepEqual(b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})'),persistent);
});

test('selection snapshots are immutable and expose no mutable Set',async()=>{
  const b=await browser();const id=line(b,{x:-20,y:0},{x:20,y:0});b.point(400,300);
  assert.equal(b.run('Object.isFrozen(window.caderactSelection.selectedIds())'),true);
  assert.throws(()=>b.run('window.caderactSelection.selectedIds().push("bad")'),{name:'TypeError'});
  assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);
});

test('active Line owns clicks and snapping while selection stays unchanged, then idle selection resumes',async()=>{
  const b=await browser();const id=line(b,{x:13,y:17},{x:33,y:17});b.point(465,215);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);
  b.launch();b.point(471,215);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.currentPoint'),{x:13,y:17});
  b.key('Enter');b.point(465,215);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);
  b.launch();b.point(400,300);b.key('Escape');b.point(700,500);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);
});

test('selected committed Line gets only a renderer-neutral segment highlight without grips',async()=>{
  const b=await browser();const id=line(b,{x:-20,y:0},{x:20,y:0});b.flush();
  assert.equal(b.renders.at(-1).selectionOverlay.segments.length,0);assert.equal(b.renders.at(-1).lineGroups[7].segments.length,0);
  b.point(400,300);b.flush();const scene=b.renders.at(-1);
  assert.deepEqual(Array.from(scene.selectionOverlay.recordIds),[id]);assert.equal(scene.selectionOverlay.segments.length,4);
  assert.deepEqual(Array.from(scene.lineGroups[7].segments),Array.from(scene.selectionOverlay.segments));assert.equal(scene.lineGroups[7].lineWidth,2);
});

test('history prunes missing selections, preserves valid IDs, and New/Open clear session selection',async()=>{
  const b=await browser();const id=line(b,{x:-20,y:0},{x:20,y:0});b.point(400,300);
  b.run(`unitGateway.setLengthUnit('cm')`);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);
  b.run('window.caderactHistory.undo()');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);
  b.run(`window.__selectionFile=window.CaderactPersistence.serializeDocument(modelReader.snapshot());window.__remove=documentController.beginTransaction();window.__remove.remove(${JSON.stringify(id)});window.__remove.publish()`);
  assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);b.run('window.caderactHistory.undo()');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);
  b.point(400,300);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);
  b.run(`window.__selectionAdapters={confirmDiscard:async()=>true,writeFile:async()=>{},pickOpenFile:async()=>({name:'selection.caderact',text:async()=>window.__selectionFile})};
    window.__selectionFiles=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:window.__selectionAdapters})`);
  await b.run('window.__selectionFiles.newProject()');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);
  await b.run('window.__selectionFiles.open()');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);assert.equal(b.read(`modelReader.layer(modelReader.snapshot().defaultLayerId)!==null`),true);
});
