'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {browser}=require('../helpers/browser.cjs');
function typed(b,value){b.input.value=value;b.emit(b.input,'input');b.key('Enter',b.input)}
test('Mirror/MI reflect native records and reverse arc sweep',async()=>{
  const b=await browser();b.run('window.__line=recordGateway.createLine({x:2,y:3},{x:6,y:3});window.__arc=recordGateway.createArc({center:{x:5,y:2},radius:2,start:{x:7,y:2},end:{x:5,y:4},sweep:Math.PI/2});recordGateway.createAll([window.__line,window.__arc]);selection.applyRecordIds([window.__line.id,window.__arc.id])');
  b.launch('MI');b.run('window.caderactCommandRouter.activateOption("copy")');typed(b,'0,0');typed(b,'0,10');const records=b.read('modelReader.records()');const line=records.find(record=>record.type==='line'),arc=records.find(record=>record.type==='arc');assert.deepEqual({x:line.start.x,y:line.start.y},{x:-2,y:3});assert.equal(arc.sweep,-Math.PI/2);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);
});
test('Mirror Copy creates fresh identities and selects only copies; degenerate axis remains retryable',async()=>{
  const b=await browser();b.run('window.__line=recordGateway.createLine({x:2,y:3},{x:6,y:3});recordGateway.createAll([window.__line]);selection.applyRecordIds([window.__line.id])');b.launch('Mirror');assert.equal(b.read('window.caderactCommandRouter.activeSession.options[0].value'),'Yes');typed(b,'0,0');typed(b,'0,0');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Mirror');typed(b,'0,10');assert.equal(b.read('modelReader.records().length'),2);const records=b.read('modelReader.records()'),copy=records.find(record=>record.id!==records.find(other=>other.id===b.read('window.__line.id'))?.id);assert.notEqual(copy.id,b.read('window.__line.id'));assert.notEqual(copy.start.featureId,b.read('window.__line.start.featureId'));assert.deepEqual(b.read('selection.selectedIds()'),[copy.id]);
});
test('Mirror Copy preference defaults to Yes, remembers changes across cancellation, and resets without document mutation',async()=>{
  const b=await browser();b.run('window.__line=recordGateway.createLine({x:2,y:3},{x:6,y:3});recordGateway.createAll([window.__line]);selection.selectOnly(window.__line.id)');
  const before=b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount,dirty:documentController.isDirty})');
  b.launch('Mirror');assert.equal(b.read('window.caderactCommandRouter.activeSession.copyMode'),true);b.run('window.caderactCommandRouter.activateOption("copy")');assert.equal(b.read('window.caderactUserPreferences.value.mirrorCopyEnabled'),false);assert.deepEqual(b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount,dirty:documentController.isDirty})'),before);
  b.key('Escape');b.launch('Mirror');assert.equal(b.read('window.caderactCommandRouter.activeSession.options[0].value'),'No');b.run('window.caderactCommandRouter.activateOption("copy")');b.key('Escape');b.launch('Mirror');assert.equal(b.read('window.caderactCommandRouter.activeSession.options[0].value'),'Yes');
  b.key('Escape');b.run('window.caderactUserPreferences.set({mirrorCopyEnabled:false});window.caderactViewport.resetForDocumentReplacement()');assert.equal(b.read('window.caderactUserPreferences.value.mirrorCopyEnabled'),false);b.run('window.caderactUserPreferences.reset()');assert.equal(b.read('window.caderactUserPreferences.value.mirrorCopyEnabled'),true);
});
test('Mirror Copy preference persists through its shared storage and malformed values fall back to Yes',async()=>{
  const b=await browser();
  assert.equal(b.read('(()=>{let raw=null;const storage={getItem:()=>raw,setItem:(key,value)=>{raw=value}};const first=window.CaderactUserPreferences.create({storage});first.set({mirrorCopyEnabled:false});return window.CaderactUserPreferences.create({storage}).value.mirrorCopyEnabled})()'),false);
  assert.equal(b.read('(()=>{const storage={getItem:()=>JSON.stringify({version:1,preferences:{mirrorCopyEnabled:"invalid"}}),setItem:()=>{}};return window.CaderactUserPreferences.create({storage}).value.mirrorCopyEnabled})()'),true);
});
test('Mirror uses only the fixed A/B world axis for preview and commit, even far from source geometry',async()=>{
  const b=await browser();
  b.run('window.__line=recordGateway.createLine({x:100,y:100},{x:200,y:100});recordGateway.createAll([window.__line]);selection.selectOnly(window.__line.id)');
  b.launch('Mirror');b.run('window.caderactCommandRouter.activateOption("copy")');typed(b,'0,0');
  b.run('window.caderactCommandRouter.activeSession.handlePointerMove({x:0,y:10})');b.flush();
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.axisA'),{x:0,y:0});
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.axisB'),{x:0,y:10});
  const preview=b.read('window.caderactCommandRouter.activeSession.getMovePreview()');
  assert.equal(preview.mode,'mirror');assert.deepEqual(preview.basePoint,{x:0,y:0});assert.deepEqual(preview.candidatePoint,{x:0,y:10});
  assert.deepEqual(preview.records[0].start,{...b.read('window.__line.start'),x:-100,y:100});
  assert.deepEqual(preview.records[0].end,{...b.read('window.__line.end'),x:-200,y:100});
  typed(b,'0,10');
  assert.deepEqual(b.read('modelReader.lines()[0].start'),{...b.read('window.__line.start'),x:-100,y:100});
  assert.deepEqual(b.read('modelReader.lines()[0].end'),{...b.read('window.__line.end'),x:-200,y:100});
});
test('Mirror reflects all native records across an arbitrary source-independent axis',async()=>{
  const b=await browser();
  b.run(`window.__records=[
    recordGateway.createLine({x:100,y:100},{x:200,y:100}),
    recordGateway.createCircle({x:120,y:120},5),
    recordGateway.createArc({center:{x:130,y:120},radius:5,start:{x:135,y:120},end:{x:130,y:125},sweep:Math.PI/2}),
    recordGateway.createEllipse({center:{x:140,y:120},majorAxis:{x:10,y:0},minorRadius:3}),
    recordGateway.createPolyline([{x:110,y:110},{x:120,y:110},{x:120,y:120}],true)
  ];recordGateway.createAll(window.__records);selection.applyRecordIds(window.__records.map(record=>record.id))`);
  assert.deepEqual(b.read('window.CaderactGeometryTransform.mirrorPoint({x:100,y:100},{x:150,y:0},{x:150,y:10})'),{x:200,y:100});b.launch('MI');b.run('window.caderactCommandRouter.activateOption("copy")');typed(b,'150,0');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.axisA'),{x:150,y:0});b.run('window.caderactCommandRouter.activeSession.handlePointerMove({x:150,y:10})');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.axisB'),{x:150,y:10});assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.getMovePreview().records.find(record=>record.type==="line").start.x'),200);typed(b,'150,10');
  const records=b.read('modelReader.records()');
  const line=records.find(record=>record.type==='line'),circle=records.find(record=>record.type==='circle'),arc=records.find(record=>record.type==='arc'),ellipse=records.find(record=>record.type==='ellipse'),polyline=records.find(record=>record.type==='polyline');
  assert.deepEqual({x:line.start.x,y:line.start.y},{x:200,y:100});assert.deepEqual({x:line.end.x,y:line.end.y},{x:100,y:100});
  assert.deepEqual({x:circle.center.x,y:circle.center.y},{x:180,y:120});assert.deepEqual({x:arc.center.x,y:arc.center.y},{x:170,y:120});assert.equal(arc.sweep,-Math.PI/2);
  assert.deepEqual({x:ellipse.center.x,y:ellipse.center.y},{x:160,y:120});assert.deepEqual({x:ellipse.majorAxis.x,y:ellipse.majorAxis.y},{x:-10,y:0});
  assert.equal(polyline.closed,true);assert.deepEqual(polyline.vertices.map(vertex=>({x:vertex.x,y:vertex.y})),[{x:190,y:110},{x:180,y:110},{x:180,y:120}]);
});
