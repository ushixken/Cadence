'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const {browser}=require('../helpers/browser.cjs')

test('UX13-F1 a newly created Layout gets one printable model-fitting viewport atomically',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createLine({x:-100,y:-25},{x:100,y:25})])')
  const before=b.read('documentController.historyInfo.entryCount')
  const result=b.read('window.caderactDocumentSession.layoutGateway.create("Model Sheet")')
  assert.equal(result.status,'committed');assert.equal(result.layout.viewportOrder.length,1)
  const viewport=result.layout.viewports[result.layout.viewportOrder[0]],paper=result.layout.paper
  assert.ok(viewport.frame.x>=paper.margins.left&&viewport.frame.y>=paper.margins.bottom)
  assert.ok(viewport.frame.x+viewport.frame.width<=paper.width-paper.margins.right)
  assert.ok(viewport.frame.y+viewport.frame.height<=paper.height-paper.margins.top)
  assert.deepEqual(viewport.viewCenter,{x:0,y:0});assert.ok(viewport.scale>=1)
  assert.equal(b.read('documentController.historyInfo.entryCount'),before+1)
})

test('UX13-F1 existing blank Layouts remain blank through save load and document replacement',async()=>{
  const b=await browser();b.run('window.__snapshot=JSON.parse(JSON.stringify(modelReader.snapshot()));window.__layout=window.__snapshot.layouts[window.__snapshot.layoutOrder[0]];window.__layout.viewports={};window.__layout.viewportOrder=[];window.__blank=window.CaderactDocument.createStore({document:window.__snapshot});window.__saved=window.CaderactPersistence.serializeDocument(window.__blank.reader.snapshot());window.__loaded=window.CaderactPersistence.loadStore(window.__saved)')
  assert.equal(b.read('window.__blank.reader.layouts()[0].viewportOrder.length'),0)
  assert.equal(b.read('window.__loaded.reader.layouts()[0].viewportOrder.length'),0)
})

test('UX13-F1 default viewport presents existing Model geometry and survives exact Undo Redo',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createLine({x:-20,y:0},{x:20,y:0})]);window.__before=modelReader.snapshot();window.__created=window.caderactDocumentSession.layoutGateway.create("Presentation").layout;window.caderactLayoutContext.switchToLayout(window.__created.id)');b.flush()
  const scene=b.renders.at(-1);assert.ok(scene.layoutViewportOverlay.items.length===1);assert.ok(scene.drawGroups.some(group=>group.viewportId&&group.role!=="frame"&&group.lineGroup.segments.length))
  const created=b.read('modelReader.snapshot()');b.run('documentController.undo()');assert.deepEqual(b.read('modelReader.snapshot()'),b.read('window.__before'));b.run('documentController.redo()');assert.deepEqual(b.read('modelReader.snapshot()'),created)
})

test('UX13-F1 Create Viewport placement keeps raw cursor and frame preview synchronized then clears',async()=>{
  const b=await browser();b.resize(900,600);b.run('window.__layout=modelReader.layouts()[0].id;window.caderactLayoutContext.switchToLayout(window.__layout);window.caderactViewport.layoutInteraction.beginPlacement()')
  b.point(220,180,'pointermove');assert.deepEqual(b.read('(({x,y,visible})=>({x,y,visible}))(window.caderactViewport.getInteractionVisualState())'),{x:230,y:190,visible:true})
  b.point(220,180);b.point(420,330,'pointermove');assert.equal(b.read('window.caderactViewport.layoutInteraction.projectedViewports().at(-1).frameOnly'),true)
  b.key('Escape');assert.equal(b.read('window.caderactViewport.layoutInteraction.snapshot().placing'),false);assert.equal(b.read('window.caderactViewport.layoutInteraction.projectedViewports().some(value=>value.frameOnly)'),false)
})

test('UX13-F1 viewport activation preserves camera isolation lock and independent viewport state',async()=>{
  const b=await browser();b.resize(900,600);b.run('window.__modelCamera={...camera};window.__layout=window.caderactDocumentSession.layoutGateway.create("Views").layout;window.__first=window.__layout.viewports[window.__layout.viewportOrder[0]];window.caderactLayoutContext.switchToLayout(window.__layout.id);window.__second=window.caderactDocumentSession.layoutGateway.createViewport(window.__layout.id,{frame:{x:150,y:20,width:80,height:60},viewCenter:{x:100,y:50},scale:20,locked:true}).viewport;window.caderactViewport.layoutInteraction.activateAt(worldToScreen(window.__first.frame.x+5,window.__first.frame.y+5))')
  b.flush();const draftingRoles=b.renders.at(-1).drawGroups.filter(group=>group.viewportId===b.read('window.__first.id')).map(group=>group.role);assert.ok(draftingRoles.includes('model-grid-minor'));assert.ok(draftingRoles.includes('model-x-axis'));assert.ok(draftingRoles.includes('model-y-axis'))
  const before=b.read('window.caderactViewport.layoutInteraction.snapshot().viewport');b.run('window.caderactViewport.layoutInteraction.navigate({dx:20,dy:10})');assert.notDeepEqual(b.read('window.caderactViewport.layoutInteraction.snapshot().viewport.viewCenter'),before.viewCenter)
  b.run('window.caderactViewport.layoutInteraction.clear();window.caderactViewport.layoutInteraction.activateAt(worldToScreen(window.__second.frame.x+5,window.__second.frame.y+5));window.caderactViewport.layoutInteraction.navigate({dx:20,factor:2})');assert.deepEqual(b.read('window.caderactViewport.layoutInteraction.snapshot().viewport.viewCenter'),{x:100,y:50});assert.equal(b.read('window.caderactViewport.layoutInteraction.snapshot().viewport.scale'),20);b.run('window.caderactLayoutContext.switchToModel()');assert.deepEqual(b.read('camera'),b.read('window.__modelCamera'))
})
