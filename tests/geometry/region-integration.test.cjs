'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('R4 Region measurement uses exact semantic edges and nesting parity',async()=>{
  const b=await browser();
  const measured=b.read(`(()=>{const outer=recordGateway.createCircle({x:0,y:0},10),hole=recordGateway.createCircle({x:0,y:0},4),island=recordGateway.createCircle({x:0,y:0},1),region=recordGateway.createRegion([outer,hole,island]);return window.CaderactMeasurement.measureRecord(region)})()`);
  assert.equal(measured.type,'region');assert.equal(measured.loopCount,3);near(measured.area,85*Math.PI);near(measured.perimeter,30*Math.PI);
  const ellipse=b.read(`window.CaderactMeasurement.measureRecord(recordGateway.createRegion([recordGateway.createEllipse({center:{x:0,y:0},majorAxis:{x:5,y:0},minorRadius:2})]))`);
  near(ellipse.area,10*Math.PI);assert.ok(ellipse.perimeter>22&&ellipse.perimeter<24);
  const mixed=b.read(`(()=>{const arc=recordGateway.createArc({center:{x:0,y:0},radius:2,start:{x:2,y:0},end:{x:-2,y:0},sweep:Math.PI}),line=recordGateway.createLine({x:-2,y:0},{x:2,y:0});return window.CaderactMeasurement.measureRecord(recordGateway.createRegion([arc,line]))})()`);
  near(mixed.area,2*Math.PI);near(mixed.perimeter,2*Math.PI+4);
  const rectangle=b.read(`window.CaderactMeasurement.measureRecord(recordGateway.createRegion([recordGateway.createPolyline([{x:0,y:0},{x:6,y:0},{x:6,y:4},{x:0,y:4}],true)]))`);
  assert.equal(rectangle.area,24);assert.equal(rectangle.perimeter,20);
});

test('R4 Area and Perimeter commands accept Region without document mutation',async()=>{
  for(const [command,field,expected] of [['Area','area',84*Math.PI],['Perimeter','perimeter',28*Math.PI]]){const b=await browser();b.run(`window.__r=recordGateway.createRegion([recordGateway.createCircle({x:0,y:0},10),recordGateway.createCircle({x:0,y:0},4)]);recordGateway.createAll([window.__r]);window.caderactSelection.selectOnly(window.__r.id)`);const before=b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount,dirty:documentController.isDirty})');b.launch(command);const result=b.read('window.caderactCommandRouter.lastResult');near(result.measurement[field],expected);assert.deepEqual(b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount,dirty:documentController.isDirty})'),before)}
});

test('R4 Region properties expose geometry and retain generic layer/appearance behavior',async()=>{
  const b=await browser();b.run(`window.__r=recordGateway.createRegion([recordGateway.createCircle({x:0,y:0},3)]);recordGateway.createAll([window.__r]);layerGateway.create('Regions');window.__layer=modelReader.layers().find(x=>x.name==='Regions');recordGateway.assignLayer([window.__r.id],window.__layer.id);recordGateway.setProperties([window.__r.id],{color:'#abcdef',linetype:'dashed',lineweight:.5});window.caderactSelection.selectOnly(window.__r.id);window.caderactPropertiesPanel.open()`);
  assert.deepEqual(b.read('window.CaderactObjectProperties.recordProperties(modelReader.records().find(x=>x.id===window.__r.id))'),{color:'#abcdef',linetype:'dashed',lineweight:.5});
  assert.equal(b.read('modelReader.records().find(x=>x.id===window.__r.id).layerId'),b.read('window.__layer.id'));
  const rows=Object.fromEntries(b.propertiesContent.children.find(x=>x.children?.[0]?.textContent==='Geometry').children.slice(1).map(x=>[x.children[0].textContent,x.children[1].textContent]));
  assert.deepEqual(rows,{Area:'28.274',Perimeter:'18.85','Loop Count':'1'});
});

test('R4 semantic selection distinguishes fill, holes, islands and retains centroid grip',async()=>{
  const b=await browser();b.run(`camera.zoom=20;window.__r=recordGateway.createRegion([recordGateway.createCircle({x:0,y:0},10),recordGateway.createCircle({x:0,y:0},4),recordGateway.createCircle({x:0,y:0},1)]);recordGateway.createAll([window.__r])`);
  for(const [x,hit] of [[8,true],[2,false],[0,true]])assert.equal(b.read(`window.CaderactSelection.hitTestRecords({screenPoint:worldToScreen(${x},0),records:[window.__r],worldToScreen,screenToWorld}).hit`),hit);
  assert.equal(b.read('window.CaderactGrips.discoverRegionGrips([window.__r],[window.__r.id]).length'),1);
});

test('R4 Region transforms preserve valid nested topology and copy identity policy',async()=>{
  const b=await browser();b.run(`window.__r=recordGateway.createRegion([recordGateway.createCircle({x:0,y:0},10),recordGateway.createCircle({x:0,y:0},4)]);window.__variants=[window.CaderactGeometryTransform.translateRecord(window.__r,3,7),window.CaderactGeometryTransform.rotateRecord(window.__r,{x:0,y:0},.3),window.CaderactGeometryTransform.scaleRecord(window.__r,{x:0,y:0},2),window.CaderactGeometryTransform.mirrorRecord(window.__r,{x:0,y:0},{x:1,y:1})];window.__copy=recordGateway.copyWithFreshIdentity(window.__r)`);
  assert.deepEqual(b.read('window.__variants.map(x=>window.CaderactRegionGeometry.validate(x).length)'),[0,0,0,0]);assert.deepEqual(b.read('window.__variants.map(x=>x.loops.map(y=>y.depth))'),[[0,1],[0,1],[0,1],[0,1]]);assert.notEqual(b.read('window.__copy.id'),b.read('window.__r.id'));
});

test('R4 Region persists exactly, remains excluded from Osnap, and DXF fails explicitly',async()=>{
  const b=await browser();b.run(`window.__r=recordGateway.createRegion([recordGateway.createCircle({x:0,y:0},2)]);recordGateway.createAll([window.__r]);window.__json=window.CaderactPersistence.serializeDocument(modelReader.snapshot());window.__loaded=window.CaderactPersistence.loadStore(window.__json);window.__json2=window.CaderactPersistence.serializeDocument(window.__loaded.reader.snapshot());window.__loaded2=window.CaderactPersistence.loadStore(window.__json2)`);
  assert.equal(b.read('window.__json2'),b.read('window.__json'));assert.equal(b.read('window.CaderactPersistence.serializeDocument(window.__loaded2.reader.snapshot())'),b.read('window.__json'));
  const snap=b.read(`window.CaderactSnapResolver.createResolver().resolve({rawWorldPoint:{x:2,y:0},worldToScreen:(x,y)=>({x,y}),records:[window.__r],gridSpacing:10,enabled:{endpoint:true,midpoint:true,center:true,intersection:true,nearest:true,perpendicular:true,tangent:true,quadrant:true,vertex:true,grid:false}})`);
  assert.equal(snap.snapped,false);assert.throws(()=>b.run('window.CaderactDxfExport.exportDocument(modelReader.snapshot())'),/unsupported native records/);
});
