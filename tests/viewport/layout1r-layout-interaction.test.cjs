'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {browser}=require('../helpers/browser.cjs')

test('LAYOUT1R New Layout uses the shared dialog authority before publication',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/js/editor/layout-tabs.js'),'utf8')
  assert.match(source,/actionDialog\(\{className:"layout-new-dialog"/);assert.match(source,/newViews\.value="1"/);assert.match(source,/add\.addEventListener\("click",\(\)=>openNewLayout\(add\)\)/);assert.match(source,/cancelButton\.addEventListener\("click",close\)/);assert.doesNotMatch(source,/add\.addEventListener\("click",\(\)=>\{const outcome=session\.layoutGateway\.create/)
})

test('LAYOUT1R layout creation accepts None or one fitted view and custom paper atomically',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createLine({x:100,y:40},{x:140,y:60})])');const before=b.read('documentController.historyInfo.entryCount')
  const none=b.read(`window.caderactDocumentSession.layoutGateway.create('Blank Sheet',{initialModelViews:0,paper:{size:'Custom',orientation:'portrait',width:180,height:240,units:'mm',margins:{top:10,right:10,bottom:10,left:10},plot:{area:'layout',scale:1,placement:'centered',offset:{x:0,y:0},colorMode:'color'}}})`)
  assert.equal(none.layout.viewportOrder.length,0);assert.deepEqual([none.layout.paper.width,none.layout.paper.height,none.layout.paper.units],[180,240,'mm'])
  const one=b.read(`window.caderactDocumentSession.layoutGateway.create('Model Sheet',{initialModelViews:1,paper:{size:'A3',orientation:'landscape',width:420,height:297,units:'mm',margins:{top:10,right:10,bottom:10,left:10},plot:{area:'layout',scale:1,placement:'centered',offset:{x:0,y:0},colorMode:'color'}}})`)
  assert.equal(one.layout.viewportOrder.length,1);assert.deepEqual(one.layout.viewports[one.layout.viewportOrder[0]].viewCenter,{x:120,y:50});assert.equal(b.read('documentController.historyInfo.entryCount'),before+2)
  b.run('documentController.undo()');assert.equal(b.read("modelReader.layouts().some(layout=>layout.name==='Model Sheet')"),false);b.run('documentController.redo()');assert.equal(b.read("modelReader.layouts().some(layout=>layout.name==='Model Sheet')"),true)
})

test('LAYOUT1R active view grid axes geometry and raw cursor stay clipped and themed',async()=>{
  const b=await browser();b.resize(900,600);b.run(`recordGateway.createAll([recordGateway.createLine({x:-100,y:0},{x:100,y:0})]);window.__layout=modelReader.layouts()[0];window.caderactLayoutContext.switchToLayout(window.__layout.id);window.__view=window.__layout.viewports[window.__layout.viewportOrder[0]];window.caderactViewport.layoutInteraction.activateAt(worldToScreen(window.__view.frame.x+5,window.__view.frame.y+5));window.caderactWorkspacePreferences.set({canvasTheme:'custom',customCanvasColors:{...window.caderactWorkspacePreferences.value.customCanvasColors,gridMinor:'#123456',gridMajor:'#234567',axisX:'#345678',axisY:'#456789'}})`);b.flush()
  const scene=b.renders.at(-1),id=b.read('window.__view.id'),frame=b.read('window.__view.frame'),a=b.read('worldToScreen(window.__view.frame.x,window.__view.frame.y)'),c=b.read('worldToScreen(window.__view.frame.x+window.__view.frame.width,window.__view.frame.y+window.__view.frame.height)'),groups=scene.drawGroups.filter(group=>group.viewportId===id)
  for(const group of groups.filter(group=>['model-grid-minor','model-grid-major','model-x-axis','model-y-axis'].includes(group.role))){const values=group.lineGroup.segments;for(let index=0;index<values.length;index+=2){assert.ok(values[index]>=Math.min(a.x,c.x)-.01&&values[index]<=Math.max(a.x,c.x)+.01);assert.ok(values[index+1]>=Math.min(a.y,c.y)-.01&&values[index+1]<=Math.max(a.y,c.y)+.01)}}
  assert.equal(groups.filter(group=>group.role==='model-grid-minor').length,1);assert.equal(groups.filter(group=>group.role==='model-grid-major').length,1);assert.equal(groups.filter(group=>group.role==='model-x-axis').length,1);assert.equal(groups.filter(group=>group.role==='model-y-axis').length,1);assert.equal(groups.filter(group=>group.role===undefined).length,1)
  assert.equal(groups.find(group=>group.role==='model-grid-minor').lineGroup.color,'#123456');assert.equal(groups.find(group=>group.role==='model-grid-major').lineGroup.color,'#234567');assert.equal(groups.find(group=>group.role==='model-x-axis').lineGroup.color,'#345678');assert.equal(groups.find(group=>group.role==='model-y-axis').lineGroup.color,'#456789')
  const inside=b.read('worldToScreen(window.__view.frame.x+10,window.__view.frame.y+10)');b.emit(b.canvas,'pointermove',{clientX:inside.x,clientY:inside.y});assert.equal(b.read('window.caderactViewport.getInteractionVisualState().visible'),true);const first=b.read('window.caderactViewport.getInteractionVisualState()');b.emit(b.canvas,'pointermove',{clientX:inside.x+18,clientY:inside.y+11});const second=b.read('window.caderactViewport.getInteractionVisualState()');assert.notDeepEqual([second.x,second.y],[first.x,first.y]);assert.equal(second.visible,true)
  b.run('window.caderactViewport.layoutInteraction.clear()');b.flush();assert.equal(b.renders.at(-1).drawGroups.some(group=>group.role==="model-grid-minor"),false)
  assert.equal(frame.width>0,true)
})

test('LAYOUT1R paper edge printable area and Model View have separate visual roles',async()=>{
  const b=await browser();b.resize(900,600);b.run('window.caderactLayoutContext.switchToLayout(modelReader.layouts()[0].id)');b.flush();const scene=b.renders.at(-1),edge=scene.drawGroups.find(group=>group.role==='paper-edge'),margin=scene.drawGroups.find(group=>group.role==='printable-area'),frame=scene.drawGroups.find(group=>group.role==='frame');assert.ok(edge&&margin&&frame);assert.equal(edge.lineGroup.linetype,'continuous');assert.equal(edge.lineGroup.lineWidth,.75);assert.equal(margin.lineGroup.linetype,'dashed');assert.equal(margin.lineGroup.lineWidth,.5);assert.match(margin.lineGroup.color,/0\.14/);assert.ok(margin.lineGroup.lineWidth<frame.lineGroup.lineWidth);assert.notEqual(margin.lineGroup.color,frame.lineGroup.color)
})

test('LAYOUT1R2 active Model View background follows Dark Light and Custom canvas authority',async()=>{
  const b=await browser();b.resize(900,600);b.run('window.__layout=modelReader.layouts()[0];window.__view=window.__layout.viewports[window.__layout.viewportOrder[0]];window.caderactLayoutContext.switchToLayout(window.__layout.id);window.caderactViewport.layoutInteraction.activateAt(worldToScreen(window.__view.frame.x+5,window.__view.frame.y+5))');b.flush()
  const background=()=>b.renders.at(-1).triangleGroups.find(group=>group.role==='model-view-background')
  let group=background();assert.equal(group.triangles.length,2);assert.ok(group.triangles.every(triangle=>triangle.color==='#182633'&&triangle.viewportId===b.read('window.__view.id')))
  b.run("window.caderactWorkspacePreferences.set({canvasTheme:'light'})");b.flush();group=background();assert.ok(group.triangles.every(triangle=>triangle.color==='#f4f6f7'))
  b.run("window.caderactWorkspacePreferences.set({canvasTheme:'custom',customCanvasColors:{...window.caderactWorkspacePreferences.value.customCanvasColors,background:'#123456'}})");b.flush();group=background();assert.ok(group.triangles.every(triangle=>triangle.color==='#123456'))
  b.run('window.caderactViewport.layoutInteraction.clear()');b.flush();assert.equal(background().triangles.length,0)
})

test('LAYOUT1R2 double-click inside retains or switches a view and paper exits while Escape still clears',async()=>{
  const b=await browser();b.resize(900,600);b.run('window.__layout=modelReader.layouts()[0];window.__first=window.__layout.viewports[window.__layout.viewportOrder[0]];window.__second=window.caderactDocumentSession.layoutGateway.createViewport(window.__layout.id,{frame:{x:210,y:25,width:50,height:40},viewCenter:{x:0,y:0},scale:1,locked:false}).viewport;window.caderactLayoutContext.switchToLayout(window.__layout.id)')
  const first=b.read('worldToScreen(window.__first.frame.x+5,window.__first.frame.y+5)'),second=b.read('worldToScreen(window.__second.frame.x+5,window.__second.frame.y+5)'),paper=b.read('worldToScreen(5,5)')
  b.point(first.x,first.y,'dblclick');assert.equal(b.read('window.caderactViewport.layoutInteraction.snapshot().activeId'),b.read('window.__first.id'));b.point(first.x+2,first.y+2,'dblclick');assert.equal(b.read('window.caderactViewport.layoutInteraction.snapshot().activeId'),b.read('window.__first.id'));b.point(second.x,second.y,'dblclick');assert.equal(b.read('window.caderactViewport.layoutInteraction.snapshot().activeId'),b.read('window.__second.id'));b.point(paper.x,paper.y,'dblclick');assert.equal(b.read('window.caderactViewport.layoutInteraction.snapshot().activeId'),null)
  b.point(first.x,first.y,'dblclick');b.key('Escape',b.document);assert.equal(b.read('window.caderactViewport.layoutInteraction.snapshot().activeId'),null)
})

test('LAYOUT1R1 renders exactly one thin neutral frame before and during Model View activation',async()=>{
  const b=await browser();b.resize(900,600);b.run('window.__layout=modelReader.layouts()[0];window.__view=window.__layout.viewports[window.__layout.viewportOrder[0]];window.caderactLayoutContext.switchToLayout(window.__layout.id)');b.flush()
  const frames=()=>b.renders.at(-1).drawGroups.filter(group=>group.viewportId===b.read('window.__view.id')&&group.role==='frame')
  let values=frames();assert.equal(values.length,1);assert.equal(values[0].lineGroup.segments.length,16);assert.equal(values[0].lineGroup.lineWidth,1);assert.equal(values[0].lineGroup.color,'#252b31')
  b.run('window.caderactViewport.layoutInteraction.activateAt(worldToScreen(window.__view.frame.x+5,window.__view.frame.y+5))');b.flush();values=frames();assert.equal(values.length,1);assert.equal(values[0].lineGroup.segments.length,16);assert.equal(values[0].lineGroup.lineWidth,1);assert.equal(values[0].lineGroup.color,'#252b31');assert.ok(b.renders.at(-1).drawGroups.some(group=>group.viewportId===b.read('window.__view.id')&&group.role==='model-grid-minor'))
})

test('layout projection emits each Line and Polyline edge exactly once before renderer submission',async()=>{
  const b=await browser();b.resize(900,600);b.run(`recordGateway.createAll([
    recordGateway.createLine({x:-8,y:8},{x:-2,y:7}),
    recordGateway.createPolyline([{x:-8,y:4},{x:-5,y:3},{x:-2,y:4}],false),
    recordGateway.createPolyline([{x:2,y:8},{x:7,y:8},{x:7,y:3},{x:2,y:3}],true)
  ]);window.__layout=modelReader.layouts()[0];window.__view=window.__layout.viewports[window.__layout.viewportOrder[0]];window.caderactLayoutContext.switchToLayout(window.__layout.id);window.caderactViewport.layoutInteraction.activateAt(worldToScreen(window.__view.frame.x+5,window.__view.frame.y+5))`);b.flush()
  const groups=b.renders.at(-1).drawGroups.filter(group=>group.viewportId===b.read('window.__view.id')&&group.role===undefined),segments=groups.flatMap(group=>Array.from(group.lineGroup.segments));assert.equal(segments.length,7*4)
  const keys=[];for(let index=0;index<segments.length;index+=4){const a=`${segments[index].toFixed(4)},${segments[index+1].toFixed(4)}`,c=`${segments[index+2].toFixed(4)},${segments[index+3].toFixed(4)}`;keys.push([a,c].sort().join('|'))}assert.equal(new Set(keys).size,7)
  assert.equal(b.renders.at(-1).worldGeometry,undefined)
})
