'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {browser}=require('../helpers/browser.cjs')

const documentState=b=>b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount,dirty:documentController.isDirty})')
const active=button=>button.classList.contains('is-active')&&button.getAttribute('aria-pressed')==='true'

test('DUX1 seven primary controls expose and toggle existing drafting authorities',async()=>{
  const b=await browser(),before=documentState(b)
  assert.equal(active(b.gridVisibleButton),true);b.emit(b.gridVisibleButton,'click');assert.equal(b.read('window.caderactUserPreferences.value.gridVisible'),false);assert.equal(active(b.gridVisibleButton),false)
  b.emit(b.gridSnapButton,'click');assert.equal(b.read('window.caderactViewport.snapModes.grid'),true);assert.equal(active(b.gridSnapButton),true)
  b.emit(b.orthoButton,'click');assert.equal(b.read('window.caderactViewport.orthoEnabled'),true);assert.equal(active(b.orthoButton),true)
  b.emit(b.polarButton,'click');assert.equal(b.read('window.caderactViewport.polarEnabled'),true);assert.equal(b.read('window.caderactViewport.orthoEnabled'),false);assert.equal(active(b.polarButton),true)
  b.emit(b.snapTrigger,'click');assert.equal(b.read('window.caderactViewport.snapModes.object'),false);assert.equal(active(b.snapTrigger),false)
  b.emit(b.trackButton,'click');assert.equal(b.read('window.caderactViewport.objectSnapTrackingEnabled'),false);assert.equal(active(b.trackButton),false)
  b.emit(b.dynamicInputButton,'click');assert.equal(b.read('window.caderactViewport.dynamicInputEnabled'),false);assert.equal(active(b.dynamicInputButton),false)
  assert.deepEqual(documentState(b),before)
})

test('DUX1 Grid visibility and Grid Snap remain independent through primary and flyout controls',async()=>{
  const b=await browser();b.gridVisibleOption.checked=false;b.emit(b.gridVisibleOption,'change');assert.equal(b.read('window.caderactUserPreferences.value.gridVisible'),false);assert.equal(b.read('window.caderactViewport.snapModes.grid'),false)
  b.gridSnapOption.checked=true;b.emit(b.gridSnapOption,'change');assert.equal(b.read('window.caderactUserPreferences.value.gridVisible'),false);assert.equal(b.read('window.caderactViewport.snapModes.grid'),true)
})

test('DUX1 Osnap Insertion and Track Extension preserve distinct preferences',async()=>{
  const b=await browser(),before=documentState(b)
  b.insertionSnapOption.checked=false;b.emit(b.insertionSnapOption,'change');assert.equal(b.read('window.caderactViewport.snapModes.insertion'),false);assert.equal(b.read('window.caderactViewport.objectSnapTrackingEnabled'),true)
  b.extensionTrackingOption.checked=false;b.emit(b.extensionTrackingOption,'change');assert.equal(b.read('window.caderactViewport.extensionTrackingEnabled'),false);assert.equal(b.read('window.caderactViewport.snapModes.object'),true)
  b.trackEnabledOption.checked=false;b.emit(b.trackEnabledOption,'change');assert.equal(b.read('window.caderactViewport.objectSnapTrackingEnabled'),false);assert.equal(b.read('window.caderactViewport.snapModes.object'),true)
  assert.deepEqual(documentState(b),before)
})

test('DUX1 Polar and Dynamic Input flyout controls share runtime validation and preferences',async()=>{
  const b=await browser();b.polarEnabledOption.checked=true;b.emit(b.polarEnabledOption,'change');b.polarIncrementOption.value='30';b.emit(b.polarIncrementOption,'change');assert.equal(b.read('window.caderactViewport.polarEnabled'),true);assert.equal(b.read('window.caderactViewport.polarIncrementDegrees'),30)
  b.dynamicInputEnabledOption.checked=false;b.emit(b.dynamicInputEnabledOption,'change');assert.equal(b.read('window.caderactViewport.dynamicInputEnabled'),false);assert.equal(active(b.dynamicInputButton),false)
  b.run('window.caderactUserPreferences.reset()');assert.equal(b.polarIncrementOption.value,'45');assert.equal(b.dynamicInputEnabledOption.checked,true);assert.equal(active(b.dynamicInputButton),true)
})

test('DUX1 drafting flyouts are exclusive overlays and Escape restores trigger focus',async()=>{
  const b=await browser();b.emit(b.gridMenuTrigger,'click');assert.equal(b.gridMenu.hidden,false);assert.equal(b.gridMenuTrigger.getAttribute('aria-expanded'),'true')
  b.emit(b.osnapMenuTrigger,'click');assert.equal(b.gridMenu.hidden,true);assert.equal(b.snapMenu.hidden,false);assert.equal(b.osnapMenuTrigger.getAttribute('aria-expanded'),'true')
  b.key('Escape',b.document);assert.equal(b.snapMenu.hidden,true);assert.equal(b.osnapMenuTrigger.getAttribute('aria-expanded'),'false');assert.equal(b.document.activeElement,b.osnapMenuTrigger)
})

test('DUX1 production markup and responsive CSS keep seven compact accessible controls',()=>{
  const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('src/css/editor-page.css','utf8')
  for(const id of ['grid-visible-toggle','grid-snap-toggle','ortho-toggle','polar-toggle','track-toggle','dynamic-input-toggle'])assert.match(html,new RegExp(`id="${id}"[^>]*aria-pressed=`))
  assert.match(html,/class="footer-tool snap-trigger"[^>]*aria-pressed=/);assert.match(html,/data-snap-mode="insertion"/);assert.match(html,/id="extension-tracking-enabled"/)
  assert.match(css,/@media \(max-width: 980px\) \{ \.drafting-label \{ display:none;/);assert.match(css,/\.footer-tools \{ max-width:244px; overflow-x:auto;/);assert.match(css,/\.snap-menu,\.drafting-menu\s*\{[^}]*position:fixed/s)
})
