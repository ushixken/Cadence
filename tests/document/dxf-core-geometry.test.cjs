'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

const pair = (code, value) => [String(code), String(value)];
function dxf(entities) { return ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1027','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES',...entities.flat(),'0','ENDSEC','0','EOF'].join('\n')+'\n'; }
function lw(vertices, { closed=false, handle='LW1', extra=[] } = {}) {
  return ['0','LWPOLYLINE','5',handle,'90',String(vertices.length),'70',closed?'1':'0',...extra,...vertices.flatMap(vertex => [...pair(10,vertex.x),...pair(20,vertex.y),...(vertex.bulge === undefined ? [] : pair(42,vertex.bulge)),...(vertex.width === undefined ? [] : [...pair(40,vertex.width),...pair(41,vertex.width)])])];
}
function legacy(vertices,{closed=false,flags=0,handle='P1',extra=[]}={}) {
  return ['0','POLYLINE','5',handle,'70',String(flags|(closed?1:0)),...extra,...vertices.flatMap(vertex=>['0','VERTEX',...pair(10,vertex.x),...pair(20,vertex.y),...(vertex.z===undefined?[]:pair(30,vertex.z)),...(vertex.bulge===undefined?[]:pair(42,vertex.bulge)),...(vertex.flags===undefined?[]:pair(70,vertex.flags))]),'0','SEQEND'];
}
const circle=(overrides={})=>['0','CIRCLE','5',overrides.handle||'C1',...pair(10,overrides.x??2),...pair(20,overrides.y??3),...pair(30,overrides.z??0),...pair(40,overrides.radius??5),...(overrides.extra||[])];
const arc=(overrides={})=>['0','ARC','5',overrides.handle||'A1',...pair(10,overrides.x??0),...pair(20,overrides.y??0),...pair(30,overrides.z??0),...pair(40,overrides.radius??10),...pair(50,overrides.start??0),...pair(51,overrides.end??90),...(overrides.extra||[])];
const ellipse=(overrides={})=>['0','ELLIPSE','5',overrides.handle||'E1',...pair(10,overrides.x??0),...pair(20,overrides.y??0),...pair(30,overrides.z??0),...pair(11,overrides.majorX??6),...pair(21,overrides.majorY??0),...pair(31,overrides.majorZ??0),...pair(40,overrides.ratio??.5),...pair(41,overrides.start??0),...pair(42,overrides.end??Math.PI*2),...(overrides.extra||[])];
function load(b,entities,options={}){b.window.__dxf=dxf(entities);b.window.__options=options;b.run('window.__imported=window.CaderactDxfImport.createStore(window.__dxf,window.__options)');return b.read('({records:window.__imported.store.reader.records(),parsed:window.__imported.parsed,diagnostics:window.__imported.diagnostics,dirty:window.__imported.store.controller.isDirty,history:window.__imported.store.controller.historyInfo})')}

test('open and closed LWPOLYLINE preserve ordered vertices and native closure semantics',async()=>{
  const b=await browser(),result=load(b,[lw([{x:3,y:4},{x:-1,y:5},{x:8,y:2}]),lw([{x:0,y:0},{x:5,y:0},{x:0,y:5}],{closed:true,handle:'LW2'})]);
  const records=result.records.filter(record=>record.type==='polyline').sort((a,b)=>a.closed-b.closed);
  assert.deepEqual(records[0].vertices.map(({x,y})=>({x,y})),[{x:3,y:4},{x:-1,y:5},{x:8,y:2}]);assert.equal(records[0].closed,false);assert.equal(records[1].closed,true);
  const featureIds=records.flatMap(record=>record.vertices.map(vertex=>vertex.featureId));assert.equal(new Set(featureIds).size,6);
});

test('LWPOLYLINE bulge and width are never discarded while malformed vertex data fails',async()=>{
  const skipped=await browser(),result=load(skipped,[lw([{x:0,y:0,bulge:1},{x:5,y:0}]),lw([{x:0,y:0,width:2},{x:5,y:0}],{handle:'LW2'})]);
  assert.equal(result.records.length,0);assert.ok(result.diagnostics.some(value=>value.code==='DXF_POLYLINE_BULGE_UNSUPPORTED'));assert.ok(result.diagnostics.some(value=>value.code==='DXF_LWPOLYLINE_WIDTH_UNSUPPORTED'));
  for(const entity of [['0','LWPOLYLINE','90','3','70','0','10','0','20','0','10','1','20','1'],['0','LWPOLYLINE','90','2','20','0','10','1','20','1']]){const b=await browser();b.window.__dxf=dxf([entity]);assert.throws(()=>b.run('window.CaderactDxfImport.createStore(window.__dxf)'),/vertex count|before vertex X/)}
});

test('legacy POLYLINE groups VERTEX through SEQEND and preserves open/closed order',async()=>{
  const b=await browser(),result=load(b,[legacy([{x:5,y:1},{x:4,y:2}]),legacy([{x:0,y:0},{x:2,y:0},{x:1,y:3}],{closed:true,handle:'P2'})]);
  const records=result.records.filter(record=>record.type==='polyline').sort((a,b)=>a.closed-b.closed);
  assert.deepEqual(records[0].vertices.map(({x,y})=>[x,y]),[[5,1],[4,2]]);assert.equal(records[1].closed,true);
  const malformed=await browser();malformed.window.__dxf=dxf([['0','POLYLINE','70','0','0','VERTEX','10','0','20','0']]);assert.throws(()=>malformed.run('window.CaderactDxfImport.createStore(window.__dxf)'),/SEQEND/);
  const stray=await browser();stray.window.__dxf=dxf([['0','VERTEX','10','0','20','0']]);assert.throws(()=>stray.run('window.CaderactDxfImport.createStore(window.__dxf)'),/outside a POLYLINE/);
});

test('legacy 3D, fitted, mesh, polyface, bulged, and non-planar variants skip deterministically',async()=>{
  const variants=[8,16,64,2].map((flags,index)=>legacy([],{flags,handle:`P${index}`}));variants.push(legacy([{x:0,y:0,bulge:1},{x:2,y:0}],{handle:'PB'}),legacy([{x:0,y:0,z:2},{x:2,y:0}],{handle:'PZ'}));
  const b=await browser(),result=load(b,variants);assert.equal(result.records.length,0);assert.ok(result.diagnostics.some(value=>value.code==='DXF_POLYLINE_VARIANT_UNSUPPORTED'));assert.ok(result.diagnostics.some(value=>value.code==='DXF_POLYLINE_BULGE_UNSUPPORTED'));assert.ok(result.diagnostics.some(value=>value.code==='DXF_POLYLINE_NON_PLANAR'));
});

test('CIRCLE imports natively and invalid radius fails atomically',async()=>{
  const b=await browser(),result=load(b,[circle({x:-2,y:7,radius:3.5})]);const record=result.records[0];assert.equal(record.type,'circle');assert.deepEqual(record.center,{x:-2,y:7});assert.equal(record.radius,3.5);
  for(const radius of [0,-1]){const invalid=await browser();invalid.window.__dxf=dxf([circle({radius})]);assert.throws(()=>invalid.run('window.CaderactDxfImport.createStore(window.__dxf)'),/greater than zero/)}
});

test('ARC conversion preserves minor, major, wrapped, and reversed-looking counterclockwise sweeps',async()=>{
  const b=await browser(),result=load(b,[arc({start:0,end:90}),arc({handle:'A2',start:10,end:280}),arc({handle:'A3',start:350,end:10}),arc({handle:'A4',start:90,end:0})]);
  const sweeps=result.records.filter(record=>record.type==='arc').map(record=>record.sweep).sort((a,b)=>a-b);
  const expected=[20,90,270,270].map(value=>value*Math.PI/180).sort((a,b)=>a-b);for(let i=0;i<4;i++)assert.ok(Math.abs(sweeps[i]-expected[i])<1e-12);
  const wrapped=result.records.find(record=>Math.abs(record.sweep-20*Math.PI/180)<1e-12);assert.ok(Math.abs(wrapped.start.x-10*Math.cos(350*Math.PI/180))<1e-12);assert.ok(Math.abs(wrapped.end.x-10*Math.cos(10*Math.PI/180))<1e-12);
  const invalid=await browser();invalid.window.__dxf=dxf([arc({start:45,end:45})]);assert.throws(()=>invalid.run('window.CaderactDxfImport.createStore(window.__dxf)'),/zero or degenerate/);
});

test('full and rotated ELLIPSE map axis vector and ratio while partial/invalid ellipses do not approximate',async()=>{
  const b=await browser(),result=load(b,[ellipse(),ellipse({handle:'E2',majorX:3,majorY:4,ratio:.4})]);const records=result.records.filter(record=>record.type==='ellipse');
  const geometry=records.map(record=>({majorAxis:record.majorAxis,minorRadius:record.minorRadius})).sort((a,b)=>a.majorAxis.x-b.majorAxis.x);
  assert.deepEqual(geometry,[{majorAxis:{x:3,y:4},minorRadius:2},{majorAxis:{x:6,y:0},minorRadius:3}]);
  const partial=await browser(),skipped=load(partial,[ellipse({end:Math.PI})]);assert.equal(skipped.records.length,0);assert.equal(skipped.diagnostics[0].code,'DXF_ELLIPSE_PARTIAL_UNSUPPORTED');
  for(const patch of [{ratio:0},{ratio:1.1},{majorX:0,majorY:0}]){const invalid=await browser();invalid.window.__dxf=dxf([ellipse(patch)]);assert.throws(()=>invalid.run('window.CaderactDxfImport.createStore(window.__dxf)'),/nonzero major axis and ratio/)}
});

test('new entities enforce the shared planar/default-extrusion policy',async()=>{
  const b=await browser(),entities=[circle({z:1}),arc({handle:'A2',extra:['210','1','220','0','230','1']}),ellipse({handle:'E3',majorZ:2}),lw([{x:0,y:0},{x:2,y:0}],{handle:'LW4',extra:['38','1']})];
  const result=load(b,entities);assert.equal(result.records.length,0);for(const code of ['DXF_CIRCLE_NON_PLANAR','DXF_ARC_NON_PLANAR','DXF_ELLIPSE_NON_PLANAR','DXF_LWPOLYLINE_NON_PLANAR'])assert.ok(result.diagnostics.some(value=>value.code===code));
});

test('mixed supported and skipped geometry imports atomically with empty history and dirty state',async()=>{
  const b=await browser(),line=['0','LINE','10','0','20','0','11','1','21','1'],result=load(b,[line,lw([{x:0,y:0},{x:4,y:0}]),circle(),arc(),ellipse(),ellipse({handle:'EP',end:Math.PI})]);
  assert.deepEqual(result.records.map(record=>record.type).sort(),['arc','circle','ellipse','line','polyline']);assert.equal(result.dirty,true);assert.deepEqual(result.history,{entryCount:0,cursor:0});assert.ok(result.diagnostics.some(value=>value.code==='DXF_ELLIPSE_PARTIAL_UNSUPPORTED'));
});

test('legacy sequence members count toward entity limits and fatal DXF2 failure preserves active drawing',async()=>{
  const limited=await browser();limited.window.__dxf=dxf([legacy([{x:0,y:0},{x:1,y:1}])]);limited.window.__limits={maxEntities:3};assert.throws(()=>limited.run('window.CaderactDxfParser.parse(window.__dxf,{limits:window.__limits})'),/entity limit/);
  const b=await browser();b.run(`recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:30,y:30})]);window.__before=window.CaderactPersistence.serializeDocument(modelReader.snapshot());window.__bad={name:'bad.dxf',text:async()=>window.__dxf};window.__files=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:{confirmDiscard:async()=>true,pickDxfFile:async()=>window.__bad,writeFile:async()=>{}}})`);b.window.__dxf=dxf([circle({radius:0})]);assert.equal((await b.run('window.__files.openDxf()')).status,'dxf-open-failed');assert.equal(b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())'),b.run('window.__before'));
});
