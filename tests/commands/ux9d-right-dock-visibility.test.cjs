'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {browser}=require('../helpers/browser.cjs')

const root=path.join(__dirname,'../..')
const state=b=>b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount,dirty:documentController.isDirty})')
const visibility=b=>b.read('window.caderactPropertiesPanel.getState().visibility')

test('UX9D toggles each panel independently and hidden tabs leave no gaps',async()=>{
  const b=await browser(),before=state(b)
  assert.deepEqual(visibility(b),{layers:true,groups:true,blocks:true,properties:true})
  for(const [name,tab] of [['properties',b.propertiesTab],['blocks',b.blocksTab],['groups',b.groupsTab]]){
    b.run(`window.caderactPropertiesPanel.togglePanel('${name}')`)
    assert.equal(visibility(b)[name],false);assert.equal(tab.hidden,true)
    b.run(`window.caderactPropertiesPanel.togglePanel('${name}')`)
    assert.equal(visibility(b)[name],true);assert.equal(tab.hidden,false)
  }
  assert.deepEqual(state(b),before)
})

test('UX9D hiding the active panel chooses the next visible tab while hiding an inactive panel preserves it',async()=>{
  const b=await browser();assert.equal(b.read('window.caderactPropertiesPanel.getState().activePanel'),'layers')
  b.run("window.caderactPropertiesPanel.togglePanel('blocks')")
  assert.equal(b.read('window.caderactPropertiesPanel.getState().activePanel'),'layers')
  b.run("window.caderactPropertiesPanel.togglePanel('layers')")
  assert.equal(b.read('window.caderactPropertiesPanel.getState().activePanel'),'groups')
  assert.equal(b.layersView.hidden,true);assert.equal(b.groupsView.hidden,false);assert.equal(b.groupsTab.getAttribute('aria-selected'),'true')
})

test('UX9D all hidden collapses through RightDock and restoring one panel preserves saved width',async()=>{
  const b=await browser(),before=state(b),observerCount=b.observerStats.observeCount
  b.window.caderactRightDock.apply(404,{persist:true})
  for(const name of ['layers','groups','blocks','properties'])b.run(`window.caderactPropertiesPanel.setPanelVisible('${name}',false)`)
  assert.equal(b.layersPanel.hidden,true);assert.equal(b.window.caderactRightDock.visible,false);assert.equal(b.editorWorkspace.style.getPropertyValue('--right-dock-width'),'0px')
  assert.equal(b.read('window.caderactPropertiesPanel.getState().activePanel'),null)
  b.run("window.caderactPropertiesPanel.setPanelVisible('blocks',true)")
  assert.equal(b.layersPanel.hidden,false);assert.equal(b.window.caderactRightDock.visible,true);assert.equal(b.window.caderactRightDock.width,404)
  assert.equal(b.layersPanel.style.width,'404px');assert.equal(b.editorWorkspace.style.getPropertyValue('--right-dock-width'),'404px')
  assert.equal(b.read('window.caderactPropertiesPanel.getState().activePanel'),'blocks');assert.equal(b.blocksView.hidden,false)
  assert.equal(b.observerStats.observeCount,observerCount);assert.deepEqual(state(b),before)
})

test('UX9D public panel entry restores a hidden requested panel without destroying state',async()=>{
  const b=await browser();b.run("window.caderactPropertiesPanel.setPanelVisible('properties',false)")
  b.window.caderactPropertiesPanel.open()
  assert.equal(visibility(b).properties,true);assert.equal(b.propertiesTab.hidden,false);assert.equal(b.propertiesView.hidden,false)
})

test('UX9D visibility preferences persist, validate, and remain outside drawing persistence',async()=>{
  const b=await browser(),result=b.read(`(()=>{const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};const first=window.CaderactUserPreferences.create({storage});first.set({rightDockLayersVisible:false,rightDockBlocksVisible:false});const second=window.CaderactUserPreferences.create({storage});values.set(window.CaderactUserPreferences.KEY,JSON.stringify({version:window.CaderactUserPreferences.VERSION,preferences:{rightDockLayersVisible:'bad'}}));const malformed=window.CaderactUserPreferences.create({storage});return {saved:second.value,malformed:malformed.value,serialized:window.CaderactPersistence.serializeDocument(modelReader.snapshot())}})()`)
  assert.equal(result.saved.rightDockLayersVisible,false);assert.equal(result.saved.rightDockBlocksVisible,false);assert.equal(result.saved.rightDockGroupsVisible,true)
  assert.equal(result.malformed.rightDockLayersVisible,true);assert.doesNotMatch(result.serialized,/rightDock(?:Layers|Groups|Blocks|Properties)Visible/)
})

test('UX9D Window menu exposes and synchronizes four checkable panel actions',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),source=fs.readFileSync(path.join(root,'src/js/editor/application-shell.js'),'utf8'),css=fs.readFileSync(path.join(root,'src/css/application-shell.css'),'utf8')
  for(const panel of ['layers','groups','blocks','properties'])assert.match(html,new RegExp(`role="menuitemcheckbox" data-window-panel="${panel}" aria-checked="true"`))
  assert.match(source,/windowPanelActions/);assert.match(source,/togglePanel\(panel\)/);assert.match(source,/setAttribute\("aria-checked"/);assert.match(source,/caderactUserPreferences\.subscribe\(syncWindowPanels\)/)
  assert.match(css,/\.application-menu\[data-menu="window"\] \[role="menuitemcheckbox"\]\{justify-content:space-between;gap:8px\}/)
  assert.match(css,/\.application-menu\[data-menu="window"\] \[role="menuitemcheckbox"\]\[aria-checked="true"\]::after\{content:"✓"\}/)
  assert.doesNotMatch(css,/\.application-menu-dropdown \[role="menuitemcheckbox"\]::before/)
})
