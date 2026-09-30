'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {browser}=require('../helpers/browser.cjs')

test('PLOT1R3 fresh and newly created default Model Views exactly match Printable Area',async()=>{
  const b=await browser()
  const frame=layout=>layout.viewports[layout.viewportOrder[0]].frame
  const initial=b.read('modelReader.layouts()[0]')
  assert.deepEqual(frame(initial),{x:10,y:10,width:277,height:190})
  b.window.__paper={size:'Custom',orientation:'portrait',width:200,height:300,units:'mm',margins:{top:12,right:13,bottom:14,left:15}}
  const created=b.read("window.caderactDocumentSession.layoutGateway.create('Exact Printable',{paper:window.__paper}).layout")
  assert.deepEqual(frame(created),{x:15,y:14,width:172,height:274})
})

test('PLOT1R3 margin edits atomically move only the still-default full-page Model View',async()=>{
  const b=await browser(),layout=b.read('modelReader.layouts()[0]'),view=layout.viewports[layout.viewportOrder[0]],history=b.read('documentController.historyInfo.entryCount')
  b.window.__layout=layout.id;b.window.__paper={...layout.paper,margins:{top:20,right:21,bottom:22,left:23}};b.run("window.__additional=window.caderactDocumentSession.layoutGateway.createViewport(window.__layout,{frame:{x:30,y:40,width:80,height:60},viewCenter:{x:75,y:-20},scale:25,locked:true}).viewport")
  const additional=b.read('window.__additional'),before=b.read('modelReader.layout(window.__layout)'),beforeApplyHistory=b.read('documentController.historyInfo.entryCount')
  const result=b.read('window.caderactDocumentSession.layoutGateway.setPageSetup(window.__layout,window.__paper)')
  assert.equal(result.status,'committed');assert.equal(result.matchedDefaultViewport,true);assert.equal(b.read('documentController.historyInfo.entryCount'),beforeApplyHistory+1)
  const updated=b.read(`modelReader.layout(window.__layout).viewports[${JSON.stringify(view.id)}]`)
  assert.deepEqual(updated.frame,{x:23,y:22,width:253,height:168});assert.deepEqual(updated.viewCenter,view.viewCenter);assert.equal(updated.scale,view.scale);assert.equal(updated.locked,view.locked)
  assert.deepEqual(b.read(`modelReader.layout(window.__layout).viewports[${JSON.stringify(additional.id)}]`),additional)
  const exact=b.read('modelReader.layout(window.__layout)');b.run('documentController.undo()');assert.deepEqual(b.read('modelReader.layout(window.__layout)'),before);b.run('documentController.redo()');assert.deepEqual(b.read('modelReader.layout(window.__layout)'),exact);assert.ok(history<beforeApplyHistory)
})

test('PLOT1R3 deliberately repositioned primary Model View remains independent of later margins',async()=>{
  const b=await browser(),layout=b.read('modelReader.layouts()[0]'),view=layout.viewports[layout.viewportOrder[0]],custom={x:35,y:27,width:180,height:120}
  b.window.__layout=layout.id;b.window.__view=view.id;b.window.__custom=custom;b.run('window.caderactDocumentSession.layoutGateway.updateViewport(window.__layout,window.__view,{frame:window.__custom})');b.window.__paper={...layout.paper,margins:{top:20,right:21,bottom:22,left:23}}
  const result=b.read('window.caderactDocumentSession.layoutGateway.setPageSetup(window.__layout,window.__paper)')
  assert.equal(result.status,'committed');assert.equal(result.matchedDefaultViewport,false);assert.deepEqual(b.read('modelReader.layout(window.__layout).viewports[window.__view].frame'),custom)
})

test('PLOT1R3 explicit match is one exact history step preserving Model View identity and camera',async()=>{
  const b=await browser(),layout=b.read('modelReader.layouts()[0]'),id=layout.id,view=layout.viewports[layout.viewportOrder[0]],history=b.read('documentController.historyInfo.entryCount')
  b.window.__layout=id;b.window.__paper={...layout.paper,margins:{top:20,right:21,bottom:22,left:23}}
  const result=b.read('window.caderactDocumentSession.layoutGateway.setPageSetupAndMatchPrimaryViewport(window.__layout,window.__paper)')
  assert.equal(result.status,'committed');assert.equal(b.read('documentController.historyInfo.entryCount'),history+1)
  const matched=b.read(`modelReader.layout(window.__layout).viewports[${JSON.stringify(view.id)}]`)
  assert.equal(matched.id,view.id);assert.deepEqual(matched.viewCenter,view.viewCenter);assert.equal(matched.scale,view.scale);assert.equal(matched.locked,view.locked)
  assert.deepEqual(matched.frame,{x:23,y:22,width:253,height:168})
  const exact=b.read('modelReader.layout(window.__layout)');b.run('documentController.undo()');assert.deepEqual(b.read('modelReader.layout(window.__layout)'),layout);b.run('documentController.redo()');assert.deepEqual(b.read('modelReader.layout(window.__layout)'),exact)
})

test('PLOT1R3 Page Setup stages matching explicitly and explains separate authorities',()=>{
  const source=fs.readFileSync('src/js/editor/layout-tabs.js','utf8')
  assert.match(source,/Match Model View to Printable Area/)
  assert.match(source,/Printable Area and Model View are independent/)
  assert.match(source,/pendingMatchPrintable\?session\.layoutGateway\.setPageSetupAndMatchPrimaryViewport/)
  assert.match(source,/matchPrintable\.disabled=!layout\.viewportOrder\.length/)
})
