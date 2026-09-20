'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

const install=(b,expression)=>b.run(`window.__sources=${expression}`);
const rectangle=(x1,y1,x2,y2,prefix='r')=>`[
 {id:'${prefix}1',type:'line',start:{x:${x1},y:${y1}},end:{x:${x2},y:${y1}}},
 {id:'${prefix}2',type:'line',start:{x:${x2},y:${y2}},end:{x:${x1},y:${y2}}},
 {id:'${prefix}3',type:'line',start:{x:${x1},y:${y2}},end:{x:${x1},y:${y1}}},
 {id:'${prefix}4',type:'line',start:{x:${x2},y:${y1}},end:{x:${x2},y:${y2}}}]`;

test('R3 unordered and reversed rectangle traversal is deterministic',async()=>{const b=await browser();install(b,rectangle(0,0,4,3));let plan=b.read('window.CaderactBoundaryDiscovery.discover(window.__sources)');assert.equal(plan.valid,true);assert.equal(plan.faces.length,1);assert.equal(plan.faces[0].area,12);b.run('window.__sources=window.__sources.reverse().map((r,i)=>i%2?{...r,start:r.end,end:r.start}:r)');const shuffled=b.read('window.CaderactBoundaryDiscovery.discover(window.__sources)');assert.equal(shuffled.faces[0].area,12);assert.deepEqual(shuffled.faces[0].bounds,plan.faces[0].bounds)});

test('R3 intersection splitting extracts multiple bounded faces',async()=>{const b=await browser();install(b,`[...${rectangle(0,0,4,2)}, {id:'divider',type:'line',start:{x:2,y:-1},end:{x:2,y:3}}]`);const plan=b.read('window.CaderactBoundaryDiscovery.discover(window.__sources)');assert.equal(plan.valid,true);assert.deepEqual(plan.faces.map(x=>x.area),[4,4]);assert.ok(plan.stats.intersections>=6);assert.ok(plan.stats.halfEdges>10)});

test('R3 Line and circular Arc form an exact semantic face',async()=>{const b=await browser();install(b,"[{id:'a',type:'arc',center:{x:0,y:0},radius:2,start:{x:2,y:0},end:{x:-2,y:0},sweep:Math.PI},{id:'l',type:'line',start:{x:-2,y:0},end:{x:2,y:0}}]");const plan=b.read('window.CaderactBoundaryDiscovery.discover(window.__sources)');assert.equal(plan.valid,true);assert.ok(Math.abs(plan.faces[0].area-2*Math.PI)<1e-9);assert.equal(plan.faces[0].edges.some(x=>x.kind==='arc'),true)});

test('R3 straight Polyline segments and T junctions remain semantic',async()=>{const b=await browser();install(b,"[{id:'p',type:'polyline',closed:true,vertices:[{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}]},{id:'t',type:'line',start:{x:2,y:3},end:{x:2,y:2}}]");const plan=b.read('window.CaderactBoundaryDiscovery.discover(window.__sources)');assert.equal(plan.valid,true,JSON.stringify(plan));assert.equal(plan.faces.some(x=>Math.abs(x.area-12)<1e-9),true,JSON.stringify(plan))});

test('R3 endpoint clustering closes only gaps within model tolerance',async()=>{const b=await browser();install(b,"[{id:'a',type:'line',start:{x:0,y:0},end:{x:2,y:0}},{id:'b',type:'line',start:{x:2,y:0},end:{x:2,y:2}},{id:'c',type:'line',start:{x:2,y:2},end:{x:0,y:2}},{id:'d',type:'line',start:{x:0,y:2},end:{x:0,y:5e-10}}]");assert.equal(b.read('window.CaderactBoundaryDiscovery.discover(window.__sources).valid'),true);b.run('window.__sources[3].end.y=1e-4');const failed=b.read('window.CaderactBoundaryDiscovery.discover(window.__sources)');assert.equal(failed.valid,false);assert.equal(failed.reason,'no-bounded-face')});

test('R3 overlapping and unsupported Ellipse discovery fail structurally',async()=>{const b=await browser();install(b,"[{id:'a',type:'line',start:{x:0,y:0},end:{x:3,y:0}},{id:'b',type:'line',start:{x:1,y:0},end:{x:2,y:0}}]");assert.equal(b.read('window.CaderactBoundaryDiscovery.discover(window.__sources).reason'),'overlapping-or-coincident-geometry');install(b,"[{id:'e',type:'ellipse',center:{x:0,y:0},majorAxis:{x:2,y:0},minorRadius:1}]");assert.equal(b.read('window.CaderactBoundaryDiscovery.discover(window.__sources).reason'),'unsupported-ellipse-discovery')});

test('R3 duplicate sources are ignored and complexity caps fail before graph allocation',async()=>{const b=await browser();install(b,rectangle(0,0,2,2));b.run('window.__sources.push(window.__sources[0])');assert.equal(b.read('window.CaderactBoundaryDiscovery.atomicCurves(window.__sources).curves.length'),4);b.run('window.__many=Array.from({length:10001},(_,i)=>({id:`x${i}`,type:"line",start:{x:i,y:0},end:{x:i,y:1}}))');const failed=b.read('window.CaderactBoundaryDiscovery.atomicCurves(window.__many)');assert.equal(failed.reason,'complexity-limit-exceeded');assert.equal(failed.limit,'curves')});

test('R3 nested topology gives hole and island parity for point choice',async()=>{const b=await browser();install(b,`[...${rectangle(-10,-10,10,10,'a')},...${rectangle(-6,-6,6,6,'b')},...${rectangle(-2,-2,2,2,'c')}]`);b.run('window.__plan=window.CaderactBoundaryDiscovery.discover(window.__sources)');assert.equal(b.read('window.__plan.valid'),true);assert.equal(b.read('window.CaderactBoundaryDiscovery.chooseAtPoint(window.__plan,{x:8,y:0}).valid'),true);assert.equal(b.read('window.CaderactBoundaryDiscovery.chooseAtPoint(window.__plan,{x:4,y:0}).reason'),'no-enclosing-boundary');assert.equal(b.read('window.CaderactBoundaryDiscovery.chooseAtPoint(window.__plan,{x:0,y:0}).valid'),true);assert.equal(b.read('window.CaderactBoundaryDiscovery.chooseAtPoint(window.__plan,{x:10,y:0}).reason'),'point-on-boundary')});

test('R3 broad phase is deterministic and avoids all-pairs work',async()=>{const b=await browser();b.run('window.__sources=Array.from({length:100},(_,i)=>({id:`l${i}`,type:"line",start:{x:i*10,y:0},end:{x:i*10+1,y:1}}));window.__atomic=window.CaderactBoundaryDiscovery.atomicCurves(window.__sources)');const broad=b.read('window.CaderactBoundaryDiscovery.candidatePairs(window.__atomic.curves)');assert.equal(broad.valid,true);assert.equal(broad.pairs.length,0)});

test('R3 semantic tangent contact is rejected as ambiguous',async()=>{const b=await browser();install(b,"[{id:'a',type:'arc',center:{x:0,y:0},radius:1,start:{x:1,y:0},end:{x:-1,y:0},sweep:Math.PI},{id:'l',type:'line',start:{x:-2,y:1},end:{x:2,y:1}}]");assert.equal(b.read('window.CaderactBoundaryDiscovery.discover(window.__sources).reason'),'ambiguous-tangent-contact')});
