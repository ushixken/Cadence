'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

test('R2 Region snapshots a closed Polyline with native topology and atomic history',async()=>{
  const b=await browser();
  b.run('window.__source=recordGateway.createPolyline([{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}],true);recordGateway.createAll([window.__source])');
  const source=b.read('window.__source');b.window.__sourceId=source.id;
  b.run('selection.applyRecordIds([window.__sourceId])');b.launch('Region');b.key('Enter');
  assert.equal(b.read('window.caderactCommandRouter.lastResult.status'),'command-completed');
  const records=b.read('modelReader.records()'),region=records.find(x=>x.type==='region');
  assert.equal(records.length,2);assert.ok(region);assert.equal(region.loops[0].edges.length,4);
  assert.equal(b.read('window.CaderactDocument.validateDocument(modelReader.snapshot()).length'),0);
  assert.equal(b.read('documentController.historyInfo.entryCount'),2);assert.ok(records.some(x=>x.id===source.id));
});

test('R2 Region supports hole parity persistence bounds transforms and fresh identities',async()=>{
  const b=await browser();
  b.run('window.__a=recordGateway.createCircle({x:0,y:0},10);window.__h=recordGateway.createCircle({x:0,y:0},4);window.__r=recordGateway.createRegion([window.__a,window.__h]);recordGateway.createAll([window.__r])');
  assert.deepEqual(b.read('window.__r.loops.map(x=>x.depth)'),[0,1]);
  assert.equal(b.read('window.CaderactRegionGeometry.classifyPoint(window.__r,{x:8,y:0})'),'inside');
  assert.equal(b.read('window.CaderactRegionGeometry.classifyPoint(window.__r,{x:0,y:0})'),'hole');
  assert.deepEqual(b.read('window.CaderactRegionGeometry.bounds(window.__r)'),{minX:-10,minY:-10,maxX:10,maxY:10});
  assert.equal(b.read('Object.values(window.CaderactPersistence.deserializeDocument(window.CaderactPersistence.serializeDocument(modelReader.snapshot())).geometry.objects)[0].type'),'region');
  b.run('window.__m=window.CaderactGeometryTransform.mirrorRecord(window.__r,{x:0,y:0},{x:0,y:1});window.__c=recordGateway.copyWithFreshIdentity(window.__m)');
  assert.equal(b.read('window.CaderactRegionGeometry.validate(window.__m).length'),0);
  assert.notEqual(b.read('window.__c.id'),b.read('window.__r.id'));
});

test('R2 rejects open and unsupported sources without publication',async()=>{
  const b=await browser(),before=b.read('modelReader.snapshot()');
  b.run('window.__open=recordGateway.createPolyline([{x:0,y:0},{x:1,y:0}],false)');
  assert.throws(()=>b.run('recordGateway.createRegion([window.__open])'));
  assert.throws(()=>b.run('recordGateway.createRegion([{type:"text"}])'));
  assert.deepEqual(b.read('modelReader.snapshot()'),before);
});

test('R2 ordered Line loops are copied while sources remain independent',async()=>{
  const b=await browser();
  b.run('window.__lines=[recordGateway.createLine({x:0,y:0},{x:3,y:0}),recordGateway.createLine({x:3,y:0},{x:3,y:2}),recordGateway.createLine({x:3,y:2},{x:0,y:2}),recordGateway.createLine({x:0,y:2},{x:0,y:0})];window.__region=recordGateway.createRegion(window.__lines);recordGateway.createAll([...window.__lines,window.__region])');
  assert.equal(b.read('window.__region.loops[0].edges.length'),4);
  assert.equal(b.read('modelReader.records().filter(x=>x.type==="line").length'),4);
  b.run('window.__moved=window.CaderactGeometryTransform.translateRecord(window.__region,10,0)');
  assert.equal(b.read('window.__moved.loops[0].edges[0].start.x'),10);
  assert.equal(b.read('window.__lines[0].start.x'),0);
});

test('R2 whole-object selection respects filled interior holes and exposes one centroid grip',async()=>{
  const b=await browser();
  b.run('window.__region=recordGateway.createRegion([recordGateway.createCircle({x:0,y:0},10),recordGateway.createCircle({x:0,y:0},4)]);recordGateway.createAll([window.__region]);window.__records=modelReader.records()');
  assert.equal(b.read('window.CaderactSelection.hitTestRecords({screenPoint:worldToScreen(8,0),records:window.__records,worldToScreen}).recordId'),b.read('window.__region.id'));
  assert.equal(b.read('window.CaderactSelection.hitTestRecords({screenPoint:worldToScreen(0,0),records:window.__records,worldToScreen}).hit'),false);
  assert.equal(b.read('window.CaderactGrips.discoverRegionGrips(window.__records,[window.__region.id]).length'),1);
});

test('R2 DXF export fails explicitly instead of flattening native Region semantics',async()=>{
  const b=await browser();b.run('window.__region=recordGateway.createRegion([recordGateway.createCircle({x:0,y:0},2)]);recordGateway.createAll([window.__region])');
  assert.throws(()=>b.run('window.CaderactDxfExport.exportDocument(modelReader.snapshot())'),/unsupported native records/);
});
