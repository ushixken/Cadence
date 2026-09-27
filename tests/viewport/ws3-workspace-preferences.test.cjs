'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {browser}=require('../helpers/browser.cjs')

const root=path.join(__dirname,'../..')
const documentState=b=>b.read('({revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty})')

test('WS3 workspace defaults are complete and remain separate from drafting preferences',async()=>{
  const b=await browser(),workspace=b.read('window.caderactWorkspacePreferences.value'),drafting=b.read('window.caderactUserPreferences.value')
  assert.deepEqual(workspace,b.read('window.CaderactWorkspacePreferences.defaults'))
  for(const key of Object.keys(workspace))assert.equal(Object.hasOwn(drafting,key),false)
})

test('WS3 persists validated state and safely normalizes corrupt or unknown values',async()=>{
  const b=await browser(),result=b.read(`(()=>{const authority=window.CaderactWorkspacePreferences,values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};const first=authority.create({storage});first.set({rightDockWidth:444.6,rightDockLayersVisible:false,activeDockPanel:'blocks',activeToolCollection:'Measure'});const restored=authority.create({storage}).value;values.set(authority.KEY,JSON.stringify({version:authority.VERSION,preferences:{rightDockWidth:20,rightDockGroupsVisible:'no',activeDockPanel:'unknown',activeToolCollection:'Fake',unknownValue:42}}));const low=authority.create({storage}).value;values.set(authority.KEY,JSON.stringify({version:authority.VERSION,preferences:{rightDockWidth:2000}}));const high=authority.create({storage}).value;values.set(authority.KEY,'{bad json');const corrupt=authority.create({storage}).value;return {restored,low,high,corrupt}})()`)
  assert.deepEqual({...result.restored,customCanvasColors:undefined},{rightDockWidth:445,rightDockLayersVisible:false,rightDockGroupsVisible:true,rightDockBlocksVisible:true,rightDockPropertiesVisible:true,activeDockPanel:'blocks',activeToolCollection:'Measure',uiTheme:'light',canvasTheme:'dark',customCanvasTemplate:'classic-dark',customCanvasColors:undefined})
  assert.equal(result.low.rightDockWidth,230);assert.equal(result.low.rightDockGroupsVisible,true);assert.equal(result.low.activeDockPanel,'layers');assert.equal(result.low.activeToolCollection,'Draw');assert.equal(Object.hasOwn(result.low,'unknownValue'),false)
  assert.equal(result.high.rightDockWidth,960);assert.deepEqual(result.corrupt,b.read('window.CaderactWorkspacePreferences.defaults'))
})

test('WS3 migrates legacy dock values once without retaining them in drafting state',async()=>{
  const b=await browser(),result=b.read(`(()=>{const user=window.CaderactUserPreferences,workspace=window.CaderactWorkspacePreferences,values=new Map([[user.KEY,JSON.stringify({version:user.VERSION,preferences:{gridVisible:false,rightDockWidth:412,rightDockLayersVisible:false,rightDockGroupsVisible:true,rightDockBlocksVisible:false,rightDockPropertiesVisible:true}})]]),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};const migrated=workspace.create({storage});return {value:migrated.value,saved:JSON.parse(values.get(workspace.KEY))}})()`)
  assert.equal(result.value.rightDockWidth,412);assert.equal(result.value.rightDockLayersVisible,false);assert.equal(result.value.rightDockBlocksVisible,false)
  assert.equal(result.saved.version,1);assert.deepEqual(result.saved.preferences,result.value)
})

test('WS3 dock panel and collection choices use the workspace authority',async()=>{
  const b=await browser();b.window.caderactPropertiesPanel.showBlocks()
  assert.equal(b.read('window.caderactWorkspacePreferences.value.activeDockPanel'),'blocks')
  b.window.caderactPropertiesPanel.setPanelVisible('groups',false)
  assert.equal(b.read('window.caderactWorkspacePreferences.value.rightDockGroupsVisible'),false)
  const source=fs.readFileSync(path.join(root,'src/js/editor/application-shell.js'),'utf8')
  assert.match(source,/workspacePreferences\.set\(\{activeToolCollection:name\}\)/)
  assert.match(source,/showCategory\(workspacePreferences\.value\.activeToolCollection\)/)
})

test('WS3 changes and document replacement remain isolated from drawing state and persistence',async()=>{
  const b=await browser(),before=documentState(b),serialized=b.read('window.CaderactPersistence.serializeDocument(modelReader.snapshot())')
  b.run(`window.caderactWorkspacePreferences.set({rightDockWidth:377,activeToolCollection:'Annotate'});window.caderactPropertiesPanel.open();window.caderactDocumentSession.replaceStore(window.CaderactDocument.createStore({initiallySaved:true}),{reason:'ws3-test'});window.caderactViewport.resetForDocumentReplacement()`)
  assert.deepEqual(b.read('({rightDockWidth:window.caderactWorkspacePreferences.value.rightDockWidth,activeDockPanel:window.caderactWorkspacePreferences.value.activeDockPanel,activeToolCollection:window.caderactWorkspacePreferences.value.activeToolCollection,uiTheme:window.caderactWorkspacePreferences.value.uiTheme,canvasTheme:window.caderactWorkspacePreferences.value.canvasTheme})'),{rightDockWidth:377,activeDockPanel:'properties',activeToolCollection:'Annotate',uiTheme:'light',canvasTheme:'dark'})
  assert.deepEqual(documentState(b),before)
  const replacement=b.read('window.CaderactPersistence.serializeDocument(modelReader.snapshot())')
  for(const value of [serialized,replacement])assert.doesNotMatch(value,/rightDock|activeDockPanel|activeToolCollection|workspace-preferences/)
})

test('WS3 reset emits once for a change and no-op writes do not duplicate updates',async()=>{
  const b=await browser(),result=b.read(`(()=>{const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},preferences=window.CaderactWorkspacePreferences.create({storage});let emissions=0;preferences.subscribe(()=>emissions++);preferences.set({activeToolCollection:'Draw'});preferences.set({activeToolCollection:'Modify'});preferences.set({activeToolCollection:'Modify'});preferences.reset();return {emissions,value:preferences.value}})()`)
  assert.equal(result.emissions,3);assert.deepEqual(result.value,b.read('window.CaderactWorkspacePreferences.defaults'))
})
