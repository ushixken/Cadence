'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {browser}=require('../helpers/browser.cjs')

const state=b=>b.read('({revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty})')
const setTheme=(b,uiTheme,canvasTheme)=>{b.run(`window.caderactWorkspacePreferences.set({uiTheme:${JSON.stringify(uiTheme)},canvasTheme:${JSON.stringify(canvasTheme)}})`);b.flush()}

test('TH1 validates light UI and dark canvas defaults with corrupt fallback',async()=>{
  const b=await browser(),result=b.read(`(()=>{const authority=window.CaderactWorkspacePreferences,values=new Map([[authority.KEY,JSON.stringify({version:authority.VERSION,preferences:{uiTheme:'sepia',canvasTheme:7}})]]),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};return authority.create({storage}).value})()`)
  assert.equal(result.uiTheme,'light');assert.equal(result.canvasTheme,'dark')
})

test('TH1 applies all four UI and canvas combinations independently and immediately',async()=>{
  const b=await browser();b.resize(800,600);b.flush();const sizes=b.sizes.length
  for(const [ui,canvas,background] of [['light','dark','#182633'],['light','light','#f4f6f7'],['dark','dark','#182633'],['dark','light','#f4f6f7']]){
    setTheme(b,ui,canvas);assert.equal(b.document.documentElement.dataset.uiTheme,ui);assert.equal(b.document.documentElement.dataset.canvasTheme,canvas);assert.equal(b.viewportHost.dataset.canvasTheme,canvas);assert.equal(b.renders.at(-1).backgroundColor,background)
  }
  assert.equal(b.sizes.length,sizes)
})

test('TH1 Preferences Appearance controls update the workspace authority live',async()=>{
  const b=await browser();b.emit(b.preferencesTrigger,'click');assert.deepEqual(b.read('window.caderactDraftingSettings.getState()'),{open:true,activeSection:'appearance'})
  b.settingsControls['ui-theme'].value='dark';b.emit(b.settingsControls['ui-theme'],'change');b.settingsControls['canvas-theme'].value='light';b.emit(b.settingsControls['canvas-theme'],'change');b.flush()
  assert.deepEqual(b.read('window.caderactThemes.getState()'),{uiTheme:'dark',canvasTheme:'light'});assert.equal(b.renders.at(-1).backgroundColor,'#f4f6f7')
})

test('TH1 persists both themes across workspace recreation',async()=>{
  const b=await browser(),result=b.read(`(()=>{const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},first=window.CaderactWorkspacePreferences.create({storage});first.set({uiTheme:'dark',canvasTheme:'light'});return window.CaderactWorkspacePreferences.create({storage}).value})()`)
  assert.equal(result.uiTheme,'dark');assert.equal(result.canvasTheme,'light')
})

test('TH1 theme changes do not mutate drawing state or native persistence',async()=>{
  const b=await browser(),before=state(b),native=b.read('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');setTheme(b,'dark','light');assert.deepEqual(state(b),before);assert.equal(b.read('window.CaderactPersistence.serializeDocument(modelReader.snapshot())'),native);assert.doesNotMatch(native,/uiTheme|canvasTheme/)
})

test('TH1 canvas palettes preserve semantic drafting distinctions and explicit record colors',async()=>{
  const b=await browser();b.run(`window.__colored=recordGateway.createLine({x:0,y:0},{x:10,y:0});recordGateway.createAll([window.__colored]);recordGateway.setProperties([window.__colored.id],{color:'#ff00aa'})`);b.resize(800,600);setTheme(b,'light','dark');const dark=b.renders.at(-1);setTheme(b,'light','light');const light=b.renders.at(-1)
  assert.notEqual(dark.backgroundColor,light.backgroundColor);assert.notEqual(dark.lineGroups[4].color,light.lineGroups[4].color);assert.ok(light.propertyDrawGroups.some(group=>group.style.color==='#ff00aa'));const colors=new Set(light.lineGroups.map(group=>group.color));for(const color of ['#0878bb','#9a5c00','#007e99'])assert.equal(colors.has(color),true)
})

test('TH1 semantic tokens cover dark chrome and light canvas feedback without duplicate stylesheets',()=>{
  const css=fs.readFileSync('src/css/base.css','utf8'),html=fs.readFileSync('index.html','utf8')
  assert.match(css,/:root\[data-ui-theme="dark"\]/);assert.match(css,/:root\[data-canvas-theme="light"\]/)
  for(const token of ['--surface-app','--surface-chrome','--surface-panel','--surface-popup','--text-primary','--border-default','--accent','--focus-ring'])assert.match(css,new RegExp(token))
  for(const token of ['--surface-viewport','--cad-crosshair','--cad-osnap','--cad-track','--cad-hud-text','--cad-hud-active'])assert.match(css,new RegExp(token))
  assert.match(html,/id="preferences-trigger"[^>]*data-open-drafting-settings="appearance"/);assert.match(html,/id="settings-ui-theme"/);assert.match(html,/id="settings-canvas-theme"/)
})
