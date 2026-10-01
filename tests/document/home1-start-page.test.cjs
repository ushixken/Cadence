const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {browser}=require('../helpers/browser.cjs')
const root=path.resolve(__dirname,'../..'),source=file=>fs.readFileSync(path.join(root,file),'utf8')

test('HOME1 recent drawings are bounded validated workspace metadata without document state',async()=>{
  const b=await browser();b.load('src/js/home/HomeRecentState.js')
  b.window.__data=new Map();b.window.__storage={getItem:key=>b.window.__data.get(key)||null,setItem:(key,value)=>b.window.__data.set(key,value)}
  b.run('window.__recent=window.CaderactHomeRecentState.create({persistence:window.__storage})')
  const before=b.read('({revision:documentController.currentRevision,dirty:documentController.isDirty,history:documentController.historyInfo})')
  assert.equal(b.read(`window.__recent.record({name:'Plan.caderact',source:'Caderact',lastOpened:20,lastModified:10}).status`),'recorded')
  b.run(`window.__recent.record({name:'Plan.caderact',source:'Caderact',lastOpened:30,lastModified:11});window.__recent.record({name:'Import.dxf',source:'DXF',lastOpened:25,lastModified:null})`)
  assert.deepEqual(b.read('window.__recent.value.map(value=>[value.name,value.lastOpened,value.source])'),[['Plan.caderact',30,'Caderact'],['Import.dxf',25,'DXF']])
  assert.equal(b.read(`window.__recent.record({name:'Fake',source:'Cloud',lastOpened:40}).status`),'invalid-recent')
  assert.deepEqual(b.read('({revision:documentController.currentRevision,dirty:documentController.isDirty,history:documentController.historyInfo})'),before)
})

test('HOME1 metric and imperial templates reuse New document authority and remain pristine',async()=>{
  const b=await browser();b.run(`window.__actions=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:{confirmDiscard:async()=>true,writeFile:async()=>({status:'committed'})}})`)
  let outcome=await b.run(`window.__actions.newProject({template:'imperial'})`)
  assert.equal(outcome.template,'imperial');assert.equal(b.read('modelReader.units().length'),'in');assert.deepEqual(b.read('documentController.historyInfo'),{entryCount:0,cursor:0});assert.equal(b.read('documentController.isDirty'),false)
  outcome=await b.run(`window.__actions.newProject({template:'metric'})`)
  assert.equal(outcome.template,'metric');assert.equal(b.read('modelReader.units().length'),'mm');assert.deepEqual(b.read('documentController.historyInfo'),{entryCount:0,cursor:0});assert.equal(b.read('documentController.isDirty'),false)
})

test('HOME1 exposes only truthful compact start navigation and file routes',()=>{
  const html=source('index.html'),css=source('src/css/home-page.css'),js=source('src/js/home/home-page.js')
  assert.match(html,/data-home-section="home"/);assert.match(html,/data-home-section="templates"/);assert.match(html,/href="\/help\/index\.html"/)
  assert.match(html,/<li hidden>[\s\S]*Collaborate/);assert.match(html,/<header class="home-header" hidden>/);assert.match(html,/id="home-recent-empty"/)
  assert.match(html,/data-home-template="metric"/);assert.match(html,/data-home-template="imperial"/);assert.match(html,/id="home-open-drawing"/);assert.doesNotMatch(html,/id="home-open-secondary"|id="home-import-dxf"/);assert.match(js,/files\.newProject\(\{template:/);assert.match(js,/files\.openDrawing\(\)/)
  assert.match(css,/\.sidebar-list\{[^}]*list-style:none/);assert.match(css,/@media\(max-width:800px\)/);assert.match(css,/@media\(max-width:600px\)/)
})

test('HOME1R Open Drawing classifies once then preserves native and DXF authorities',async()=>{
  const b=await browser(),serialized=b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');b.window.__serialized=serialized
  b.window.__dxf=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1018','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES','0','ENDSEC','0','EOF'].join('\n')+'\n'
  b.run(`window.__choice={name:'Native.caderact',text:async()=>window.__serialized};window.__actions=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:{confirmDiscard:async()=>true,pickDrawingFile:async()=>window.__choice,writeFile:async()=>({status:'committed'})}})`)
  assert.equal((await b.run('window.__actions.openDrawing()')).status,'open-completed')
  b.run(`window.__choice={name:'Exchange.dxf',text:async()=>window.__dxf}`)
  assert.equal((await b.run('window.__actions.openDrawing()')).status,'dxf-open-completed')
  b.run(`window.__choice={name:'Unsupported.txt',text:async()=>''}`)
  const unsupported=await b.run('window.__actions.openDrawing()');assert.equal(unsupported.status,'open-failed');assert.equal(unsupported.reason,'unsupported-file-type')
})

test('HOME1 native and DXF outcomes expose only available recent metadata',async()=>{
  const b=await browser(),serialized=b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');b.window.__serialized=serialized
  b.window.__dxf=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1018','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES','0','ENDSEC','0','EOF'].join('\n')+'\n'
  b.run(`window.__native=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:{confirmDiscard:async()=>true,pickOpenFile:async()=>({name:'Known.caderact',lastModified:123,text:async()=>window.__serialized}),writeFile:async()=>({status:'committed'})}});window.__import=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:{confirmDiscard:async()=>true,pickDxfFile:async()=>({name:'Source.dxf',lastModified:456,text:async()=>window.__dxf}),writeFile:async()=>({status:'committed'})}})`)
  const opened=await b.run('window.__native.open()'),imported=await b.run('window.__import.openDxf()')
  assert.deepEqual({filename:opened.filename,lastModified:opened.sourceModifiedAt},{filename:'Known.caderact',lastModified:123});assert.deepEqual({source:imported.sourceFilename,lastModified:imported.sourceModifiedAt},{source:'Source.dxf',lastModified:456})
})
