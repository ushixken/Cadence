'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {browser}=require('../helpers/browser.cjs')

const documentState=b=>b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount,dirty:documentController.isDirty})')
const setting=(b,name)=>b.settingsControls[name]
const snap=(b,name)=>b.settingsSnapOptions.find(option=>option.dataset.settingsSnapMode===name)

test('DUX2 Tools entry opens the shared Preferences dialog at Drafting with six sections',async()=>{
  const b=await browser();b.emit(b.draftingSettingsTrigger,'click');assert.equal(b.settingsPanel.hidden,false);assert.deepEqual(b.read('window.caderactDraftingSettings.getState()'),{open:true,activeSection:'grid'});assert.equal(b.document.activeElement,b.settingsTabs[1]);assert.deepEqual(b.settingsTabs.map(tab=>tab.dataset.settingsTab),['appearance','grid','polar','osnap','tracking','dynamic'])
  for(const [index,name] of ['appearance','grid','polar','osnap','tracking','dynamic'].entries()){b.emit(b.settingsTabs[index],'click');assert.equal(b.read('window.caderactDraftingSettings.getState().activeSection'),name);assert.equal(b.settingsPages[index].hidden,false)}
})

test('DUX2 Grid and Grid Snap bind independently and synchronize DUX1 immediately',async()=>{
  const b=await browser(),before=documentState(b);b.emit(b.draftingSettingsTrigger,'click');setting(b,'grid-visible').checked=false;b.emit(setting(b,'grid-visible'),'change');assert.equal(b.read('window.caderactUserPreferences.value.gridVisible'),false);assert.equal(b.gridVisibleButton.getAttribute('aria-pressed'),'false');assert.equal(b.read('window.caderactViewport.snapModes.grid'),false)
  setting(b,'grid-snap').checked=true;b.emit(setting(b,'grid-snap'),'change');assert.equal(b.read('window.caderactViewport.snapModes.grid'),true);assert.equal(b.gridSnapButton.getAttribute('aria-pressed'),'true');assert.equal(b.read('window.caderactUserPreferences.value.gridVisible'),false);assert.deepEqual(documentState(b),before)
})

test('DUX2 Object Snap modes support Select All Clear All and Insertion without changing resolver policy',async()=>{
  const b=await browser(),before=documentState(b);b.emit(b.draftingSettingsTrigger,'click');b.emit(b.settingsTabs[3],'click');b.emit(b.settingsClearAll,'click');assert.equal(b.settingsSnapOptions.every(option=>!option.checked),true);assert.equal(b.read('window.caderactViewport.snapModes.insertion'),false);assert.equal(b.read('window.caderactViewport.snapModes.endpoint'),false)
  b.emit(b.settingsSelectAll,'click');assert.equal(b.settingsSnapOptions.every(option=>option.checked),true);assert.equal(b.read('window.caderactViewport.snapModes.insertion'),true);snap(b,'insertion').checked=false;b.emit(snap(b,'insertion'),'change');assert.equal(b.insertionSnapOption.checked,false);assert.equal(b.read('window.caderactViewport.snapModes.object'),true);assert.deepEqual(documentState(b),before)
})

test('DUX2 Polar Tracking Extension and Dynamic Input use existing viewport setters',async()=>{
  const b=await browser(),before=documentState(b);setting(b,'polar-enabled').checked=true;b.emit(setting(b,'polar-enabled'),'change');setting(b,'polar-increment').value='15';b.emit(setting(b,'polar-increment'),'change');assert.equal(b.read('window.caderactViewport.polarEnabled'),true);assert.equal(b.polarButton.getAttribute('aria-pressed'),'true');assert.equal(b.polarIncrementOption.value,'15')
  setting(b,'track-enabled').checked=false;b.emit(setting(b,'track-enabled'),'change');setting(b,'extension-enabled').checked=false;b.emit(setting(b,'extension-enabled'),'change');assert.equal(b.trackButton.getAttribute('aria-pressed'),'false');assert.equal(b.extensionTrackingOption.checked,false);assert.equal(b.read('window.caderactViewport.snapModes.object'),true)
  setting(b,'dynamic-enabled').checked=false;b.emit(setting(b,'dynamic-enabled'),'change');assert.equal(b.dynamicInputButton.getAttribute('aria-pressed'),'false');assert.equal(b.read('window.caderactViewport.dynamicInputEnabled'),false);assert.deepEqual(documentState(b),before)
})

test('DUX2 settings persist through UserPreferences and never enter native drawing data',async()=>{
  const b=await browser(),result=b.read(`(()=>{const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};const first=window.CaderactUserPreferences.create({storage});first.set({gridVisible:false,polarIncrementDegrees:30,insertionSnapEnabled:false,extensionTrackingEnabled:false});const second=window.CaderactUserPreferences.create({storage});return {value:second.value,native:window.CaderactPersistence.serializeDocument(modelReader.snapshot())}})()`);assert.equal(result.value.gridVisible,false);assert.equal(result.value.polarIncrementDegrees,30);assert.equal(result.value.insertionSnapEnabled,false);assert.equal(result.value.extensionTrackingEnabled,false);assert.doesNotMatch(result.native,/polarIncrement|insertionSnap|extensionTracking|gridVisible/)
})

test('DUX2 keyboard tab navigation Escape focus restoration and modal overflow remain accessible',async()=>{
  const b=await browser();b.emit(b.draftingSettingsTrigger,'click');b.emit(b.settingsTabs[1],'keydown',{key:'ArrowRight'});assert.equal(b.read('window.caderactDraftingSettings.getState().activeSection'),'polar');assert.equal(b.document.activeElement,b.settingsTabs[2]);b.key('Escape',b.document);assert.equal(b.settingsPanel.hidden,true);assert.equal(b.document.activeElement,b.draftingSettingsTrigger)
  const css=fs.readFileSync('src/css/editor-page.css','utf8');assert.match(css,/#settings-panel\s*\{[^}]*max-height:\s*calc\(100vh - 32px\)[^}]*overflow:\s*hidden/s);assert.match(css,/\.settings-panel-body\s*\{[^}]*overflow-y:auto/s);assert.match(css,/\.drafting-settings-tabs\s*\{[^}]*overflow-x:auto/s)
})

test('DUX2 exposes only implemented drafting settings and flyouts deep-link to canonical sections',()=>{
  const html=fs.readFileSync('index.html','utf8');assert.match(html,/id="drafting-settings-trigger"[^>]*>Drafting Settings…/);for(const section of ['grid','polar','osnap','tracking','dynamic'])assert.match(html,new RegExp(`data-open-drafting-settings="${section}"`));for(const mode of ['endpoint','midpoint','center','quadrant','intersection','perpendicular','tangent','nearest','vertex','insertion'])assert.match(html,new RegExp(`data-settings-snap-mode="${mode}"`));assert.doesNotMatch(html,/id="settings-(?:grid-spacing|snap-spacing|aperture|precision|parallel-enabled)"/)
})
