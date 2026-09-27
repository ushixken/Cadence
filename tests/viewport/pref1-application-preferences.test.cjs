'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {browser}=require('../helpers/browser.cjs')

const state=b=>b.read('({revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty})')
const preferenceTabs=b=>b.settingsTabs.filter(tab=>tab.dataset.settingsGroup==='preferences')
const preferencePages=b=>b.settingsPages.filter(page=>page.dataset.settingsGroup==='preferences')

test('PREF1 Edit Preferences opens the application surface independently from Drafting Settings',async()=>{
  const b=await browser();b.emit(b.preferencesTrigger,'click');assert.equal(b.settingsPanel.hidden,false);assert.equal(b.settingsTitle.textContent,'Preferences');assert.equal(b.settingsSubtitle.textContent,'Application and workspace');assert.equal(b.preferencesTabs.hidden,false);assert.equal(b.draftingTabs.hidden,true);assert.equal(b.draftingFooter.hidden,true);assert.deepEqual(preferenceTabs(b).map(tab=>tab.dataset.settingsTab),['appearance','workspace','command','cursor']);assert.equal(b.document.activeElement,preferenceTabs(b)[0])
  b.emit(b.settingsClose,'click');b.emit(b.draftingSettingsTrigger,'click');assert.equal(b.settingsTitle.textContent,'Drafting Settings');assert.equal(b.preferencesTabs.hidden,true);assert.equal(b.draftingTabs.hidden,false);assert.equal(b.draftingFooter.hidden,false);assert.equal(b.read('window.caderactDraftingSettings.getState().activeSection'),'grid')
})

test('PREF1 section navigation is keyboard accessible and Escape restores the Edit trigger',async()=>{
  const b=await browser(),tabs=preferenceTabs(b),pages=preferencePages(b);b.emit(b.preferencesTrigger,'click');b.emit(tabs[0],'keydown',{key:'ArrowRight'});assert.equal(b.read('window.caderactDraftingSettings.getState().activeSection'),'workspace');assert.equal(b.document.activeElement,tabs[1]);assert.equal(pages[1].hidden,false);b.emit(tabs[1],'keydown',{key:'End'});assert.equal(b.read('window.caderactDraftingSettings.getState().activeSection'),'cursor');b.key('Escape',b.document);assert.equal(b.settingsPanel.hidden,true);assert.equal(b.document.activeElement,b.preferencesTrigger)
})

test('PREF1 Appearance remains synchronized and Reset Appearance is strictly scoped',async()=>{
  const b=await browser(),draftingBefore=b.read('window.caderactUserPreferences.value');b.run(`window.caderactWorkspacePreferences.set({rightDockWidth:421,uiTheme:'dark',canvasTheme:'custom',customCanvasTemplate:'blueprint',customCanvasColors:window.CaderactWorkspacePreferences.CANVAS_TEMPLATES.blueprint})`);b.emit(b.preferencesTrigger,'click');assert.equal(b.settingsControls['ui-theme'].value,'dark');assert.equal(b.settingsControls['canvas-theme'].value,'custom');b.emit(b.appearanceReset,'click');const value=b.read('window.caderactWorkspacePreferences.value'),defaults=b.read('window.CaderactWorkspacePreferences.defaults');assert.equal(value.uiTheme,defaults.uiTheme);assert.equal(value.canvasTheme,defaults.canvasTheme);assert.deepEqual(value.customCanvasColors,defaults.customCanvasColors);assert.equal(value.rightDockWidth,421);assert.deepEqual(b.read('window.caderactUserPreferences.value'),draftingBefore)
})

test('PREF1 Workspace controls synchronize panels and collection through existing authorities',async()=>{
  const b=await browser(),tabs=preferenceTabs(b);b.emit(b.preferencesTrigger,'click');b.emit(tabs[1],'click');const layers=b.workspacePanelInputs.find(input=>input.dataset.workspacePanel==='layers');layers.checked=false;b.emit(layers,'change');assert.equal(b.read('window.caderactWorkspacePreferences.value.rightDockLayersVisible'),false);assert.equal(b.layersTab.hidden,true);b.activeCollection.value='Measure';b.emit(b.activeCollection,'change');assert.equal(b.read('window.caderactWorkspacePreferences.value.activeToolCollection'),'Measure');b.run("window.caderactPropertiesPanel.setPanelVisible('layers',true)");assert.equal(layers.checked,true)
})

test('PREF1 Reset Workspace restores layout only and updates the live dock',async()=>{
  const b=await browser(),drafting=b.read('window.caderactUserPreferences.value');b.run(`window.caderactWorkspacePreferences.set({rightDockWidth:450,rightDockGroupsVisible:false,activeDockPanel:'blocks',activeToolCollection:'Measure',uiTheme:'dark',canvasTheme:'light'});window.caderactRightDock.apply(450,{persist:false})`);b.emit(b.preferencesTrigger,'click');b.emit(b.workspaceReset,'click');const value=b.read('window.caderactWorkspacePreferences.value'),defaults=b.read('window.CaderactWorkspacePreferences.defaults');for(const key of ['rightDockWidth','rightDockLayersVisible','rightDockGroupsVisible','rightDockBlocksVisible','rightDockPropertiesVisible','activeDockPanel','activeToolCollection'])assert.deepEqual(value[key],defaults[key]);assert.equal(b.window.caderactRightDock.width,288);assert.equal(value.uiTheme,'dark');assert.equal(value.canvasTheme,'light');assert.deepEqual(b.read('window.caderactUserPreferences.value'),drafting)
})

test('PREF1 preferences survive document replacement without document mutation or native contamination',async()=>{
  const b=await browser(),before=state(b);b.run(`window.caderactWorkspacePreferences.set({uiTheme:'dark',canvasTheme:'light',rightDockPropertiesVisible:false});window.caderactDocumentSession.replaceStore(window.CaderactDocument.createStore({initiallySaved:true}),{reason:'pref1'});window.caderactViewport.resetForDocumentReplacement()`);assert.deepEqual(state(b),before);assert.equal(b.read('window.caderactWorkspacePreferences.value.uiTheme'),'dark');assert.equal(b.read('window.caderactWorkspacePreferences.value.rightDockPropertiesVisible'),false);const native=b.read('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');assert.doesNotMatch(native,/uiTheme|canvasTheme|rightDock/)
})

test('PREF1 excludes document Units and provides truthful Command and Cursor audits',()=>{
  const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('src/css/editor-page.css','utf8');assert.match(html,/Drawing units are configured per document\./);assert.doesNotMatch(html,/settings-(?:drawing-)?units/);assert.match(html,/No configurable command preferences are available yet\./);assert.match(html,/Cursor size and pickbox configuration are not currently user-configurable\./);assert.match(css,/#settings-panel\s*\{[^}]*max-height:\s*calc\(100vh - 32px\)[^}]*overflow:\s*hidden/s);assert.match(css,/\.settings-panel-body\s*\{[^}]*overflow-y:auto/s)
})
