'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const {browser}=require('../helpers/browser.cjs')

test('LAYOUT1 fresh document owns one default Model View and first geometry fits atomically',async()=>{
  const b=await browser();const initial=b.read('modelReader.layouts()[0]'),history=b.read('documentController.historyInfo.entryCount')
  assert.equal(initial.viewportOrder.length,1)
  b.run('window.__line=recordGateway.createLine({x:480,y:190},{x:520,y:210});window.__created=recordGateway.createAll([window.__line]);window.__layout=modelReader.layouts()[0];window.__view=window.__layout.viewports[window.__layout.viewportOrder[0]]')
  assert.equal(b.read('window.__created.status'),'committed');assert.equal(b.read('documentController.historyInfo.entryCount'),history+1)
  assert.deepEqual(b.read('window.__view.viewCenter'),{x:500,y:200})
  b.run('window.caderactLayoutContext.switchToLayout(window.__layout.id)');b.flush();assert.ok(b.renders.at(-1).drawGroups.some(group=>group.viewportId===b.read('window.__view.id')&&group.role!=='frame'&&group.lineGroup.segments.length))
  const after=b.read('modelReader.snapshot()');b.run('documentController.undo()');assert.equal(b.read('modelReader.records().length'),0);b.run('documentController.redo()');assert.deepEqual(b.read('modelReader.snapshot()'),after)
})

test('LAYOUT1 newly created Layout fits visible geometry in its single creation transaction',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createCircle({x:-250,y:75},25)])');const history=b.read('documentController.historyInfo.entryCount')
  const outcome=b.read('window.caderactDocumentSession.layoutGateway.create("Detail Sheet")'),view=outcome.layout.viewports[outcome.layout.viewportOrder[0]]
  assert.deepEqual(view.viewCenter,{x:-250,y:75});assert.equal(b.read('documentController.historyInfo.entryCount'),history+1)
})

test('LAYOUT1 extents include Text and derived annotation presentation',async()=>{
  const b=await browser();b.run(`window.__records=[recordGateway.createText({insertionPoint:{x:100,y:200},text:'ROOM',height:10,rotation:.4,horizontalAlignment:'center'}),recordGateway.createLinearDimension({mode:'aligned',firstPoint:{x:300,y:400},secondPoint:{x:340,y:400},dimensionLinePoint:{x:320,y:430}})];recordGateway.createAll(window.__records);window.__extent=window.CaderactModelExtents.calculate(modelReader.snapshot())`)
  const extent=b.read('window.__extent');assert.equal(extent.valid,true);assert.equal(extent.empty,false);assert.ok(extent.minX<100&&extent.maxX>=340);assert.ok(extent.minY<200&&extent.maxY>=430)
})

test('LAYOUT1 extents include Region and Hatch boundaries',async()=>{
  const b=await browser();b.run(`window.__region=recordGateway.createRegion([recordGateway.createCircle({x:-100,y:50},20)]);window.__hatch=recordGateway.createHatch([recordGateway.createCircle({x:200,y:-75},30)],{kind:'solid'});recordGateway.createAll([window.__region,window.__hatch]);window.__extent=window.CaderactModelExtents.calculate(modelReader.snapshot())`)
  assert.deepEqual(b.read('({minX:window.__extent.minX,minY:window.__extent.minY,maxX:window.__extent.maxX,maxY:window.__extent.maxY})'),{minX:-120,minY:-105,maxX:230,maxY:70})
})

test('LAYOUT1 extents include transformed nested Block content',async()=>{
  const b=await browser();b.run(`window.__leaf=blockDefinitionGateway.create({name:'Leaf',records:[recordGateway.createLine({x:0,y:0},{x:10,y:0}),recordGateway.createText({insertionPoint:{x:5,y:5},text:'B',height:2,rotation:0})]}).definition;window.__nestedRecord=recordGateway.createBlockInstance({definitionId:window.__leaf.id,insertionPoint:{x:20,y:0},rotation:Math.PI/2,scale:2,mirrored:false});window.__container=blockDefinitionGateway.create({name:'Container',records:[window.__nestedRecord]}).definition;window.__top=recordGateway.createBlockInstance({definitionId:window.__container.id,insertionPoint:{x:100,y:200},rotation:0,scale:3,mirrored:false});recordGateway.createAll([window.__top]);window.__extent=window.CaderactModelExtents.calculate(modelReader.snapshot())`)
  const extent=b.read('window.__extent');assert.equal(extent.valid,true);assert.equal(extent.empty,false);assert.ok(extent.minX>100&&extent.maxX>extent.minX);assert.ok(extent.minY>=190&&extent.maxY>250)
})

test('LAYOUT1 Add View fits current visible Model instead of origin and 1:1',async()=>{
  const b=await browser();b.resize(900,600);b.run(`recordGateway.createAll([recordGateway.createLine({x:900,y:450},{x:1100,y:550})]);window.__layout=modelReader.layouts()[0].id;window.caderactLayoutContext.switchToLayout(window.__layout);window.caderactViewport.layoutInteraction.beginPlacement();window.caderactViewport.layoutInteraction.pointerDown(worldToScreen(30,30));window.__newId=window.caderactViewport.layoutInteraction.pointerDown(worldToScreen(130,90));window.__view=modelReader.layout(window.__layout).viewports[window.__newId]`)
  assert.deepEqual(b.read('window.__view.viewCenter'),{x:1000,y:500});assert.ok(b.read('window.__view.scale')>1)
})
