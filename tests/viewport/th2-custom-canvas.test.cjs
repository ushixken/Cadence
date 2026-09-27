'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {browser}=require('../helpers/browser.cjs')

const state=b=>b.read('({revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty})')
const setCustom=b=>{b.run("window.caderactWorkspacePreferences.set({canvasTheme:'custom'})");b.flush()}
const colorInput=(b,key)=>b.canvasColorInputs.find(input=>input.dataset.canvasColor===key)

test('TH2 exposes four professional complete canvas templates',async()=>{
  const b=await browser(),templates=b.read('window.CaderactWorkspacePreferences.CANVAS_TEMPLATES'),keys=b.read('window.CaderactWorkspacePreferences.COLOR_KEYS')
  assert.deepEqual(Object.keys(templates),['classic-dark','technical-light','blueprint','high-contrast'])
  for(const palette of Object.values(templates)){assert.deepEqual(Object.keys(palette),keys);for(const value of Object.values(palette))assert.match(value,/^#[0-9a-f]{6}$/)}
})

test('TH2 Custom mode projects every renderer-neutral canvas color live without resize',async()=>{
  const b=await browser();b.resize(800,600);b.flush();const sizes=b.sizes.length
  b.run(`window.caderactWorkspacePreferences.set({canvasTheme:'custom',customCanvasColors:{...window.caderactWorkspacePreferences.value.customCanvasColors,background:'#112233',gridMinor:'#223344',gridMajor:'#334455',axisX:'#aa3344',axisY:'#33aa66',geometry:'#ddeeff',selection:'#22aaff',grip:'#eeeeee',gripHover:'#ffcc44',osnap:'#ffee33',tracking:'#44ccdd',crosshair:'#ffffff',dynamicSurface:'#101820',dynamicText:'#f0f4f8'}})`);b.flush();const scene=b.renders.at(-1),colors=new Set(scene.lineGroups.map(group=>group.color))
  assert.equal(scene.backgroundColor,'#112233');assert.equal(scene.lineGroups[0].color,'#223344');assert.equal(scene.lineGroups[1].color,'#334455');assert.equal(scene.lineGroups[2].color,'#aa3344');assert.equal(scene.lineGroups[3].color,'#33aa66');assert.equal(scene.lineGroups[4].color,'#ddeeff');for(const color of ['#22aaff','#ffcc44','#ffee33','#44ccdd'])assert.equal(colors.has(color),true);assert.equal(b.sizes.length,sizes)
  assert.equal(b.document.documentElement.style.getPropertyValue('--cad-crosshair'),'#ffffff');assert.equal(b.document.documentElement.style.getPropertyValue('--surface-viewport-hud'),'#101820');assert.equal(b.document.documentElement.style.getPropertyValue('--cad-hud-text'),'#f0f4f8')
})

test('TH2 template selection populates Custom and Reset restores the selected template',async()=>{
  const b=await browser();b.emit(b.preferencesTrigger,'click');b.settingsControls['canvas-theme'].value='custom';b.emit(b.settingsControls['canvas-theme'],'change');assert.equal(b.customCanvasSection.hidden,false)
  b.settingsControls['canvas-template'].value='blueprint';b.emit(b.settingsControls['canvas-template'],'change');b.flush();assert.equal(b.read('window.caderactWorkspacePreferences.value.customCanvasTemplate'),'blueprint');assert.deepEqual(b.read('window.caderactWorkspacePreferences.value.customCanvasColors'),b.read('window.CaderactWorkspacePreferences.CANVAS_TEMPLATES.blueprint'))
  colorInput(b,'background').value='#445566';b.emit(colorInput(b,'background'),'input');assert.equal(b.read('window.caderactWorkspacePreferences.value.customCanvasColors.background'),'#445566');b.emit(b.canvasTemplateReset,'click');assert.equal(b.read('window.caderactWorkspacePreferences.value.customCanvasColors.background'),'#12395a')
})

test('TH2 custom palette persists and malformed fields safely fall back to its template',async()=>{
  const b=await browser(),result=b.read(`(()=>{const authority=window.CaderactWorkspacePreferences,values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},first=authority.create({storage});first.set({uiTheme:'dark',canvasTheme:'custom',customCanvasTemplate:'technical-light',customCanvasColors:{...authority.CANVAS_TEMPLATES['technical-light'],background:'#abcdef'}});const restored=authority.create({storage}).value;values.set(authority.KEY,JSON.stringify({version:authority.VERSION,preferences:{uiTheme:'dark',canvasTheme:'custom',customCanvasTemplate:'blueprint',customCanvasColors:{background:'bad',geometry:'#123456'}}}));return {restored,malformed:authority.create({storage}).value}})()`)
  assert.equal(result.restored.uiTheme,'dark');assert.equal(result.restored.canvasTheme,'custom');assert.equal(result.restored.customCanvasColors.background,'#abcdef');assert.equal(result.malformed.customCanvasColors.background,'#12395a');assert.equal(result.malformed.customCanvasColors.geometry,'#123456');assert.equal(result.malformed.customCanvasColors.osnap,'#ffd166')
})

test('TH2 Custom canvas remains independent from the TH1 UI theme',async()=>{
  const b=await browser();setCustom(b);const palette=b.read('window.caderactWorkspacePreferences.value.customCanvasColors');for(const uiTheme of ['dark','light']){b.run(`window.caderactWorkspacePreferences.set({uiTheme:${JSON.stringify(uiTheme)}})`);b.flush();assert.equal(b.document.documentElement.dataset.uiTheme,uiTheme);assert.equal(b.document.documentElement.dataset.canvasTheme,'custom');assert.deepEqual(b.read('window.caderactWorkspacePreferences.value.customCanvasColors'),palette)}
})

test('TH2 never mutates explicit entity Layer or ByLayer colors or drawing state',async()=>{
  const b=await browser();b.run(`window.__line=recordGateway.createLine({x:0,y:0},{x:10,y:0});window.__byLayer=recordGateway.createLine({x:0,y:2},{x:10,y:2});recordGateway.createAll([window.__line,window.__byLayer]);recordGateway.setProperties([window.__line.id],{color:'#ff00aa'});window.__layerId=modelReader.snapshot().currentLayerId`);const before=state(b),records=b.read('modelReader.records()'),layer=b.read('modelReader.layer(window.__layerId)'),native=b.read('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');setCustom(b)
  assert.deepEqual(state(b),before);assert.deepEqual(b.read('modelReader.records()'),records);assert.deepEqual(b.read('modelReader.layer(window.__layerId)'),layer);assert.equal(b.read('modelReader.records().find(record=>record.id===window.__line.id).color'),'#ff00aa');assert.equal(b.read('modelReader.records().find(record=>record.id===window.__byLayer.id).color'),null);assert.equal(b.read('window.CaderactPersistence.serializeDocument(modelReader.snapshot())'),native);assert.doesNotMatch(native,/customCanvas|canvasTheme/)
})

test('TH2 warns about poor presentation contrast without silently changing colors',async()=>{
  const b=await browser();b.run(`window.caderactWorkspacePreferences.set({canvasTheme:'custom',customCanvasColors:{...window.caderactWorkspacePreferences.value.customCanvasColors,background:'#111111',geometry:'#111111',crosshair:'#111111',dynamicSurface:'#222222',dynamicText:'#222222'}})`);assert.match(b.canvasContrast.textContent,/Low contrast: default geometry, crosshair, Dynamic Input/);assert.equal(b.read('window.caderactWorkspacePreferences.value.customCanvasColors.geometry'),'#111111')
  const html=fs.readFileSync('index.html','utf8');for(const key of b.read('window.CaderactWorkspacePreferences.COLOR_KEYS'))assert.match(html,new RegExp(`data-canvas-color="${key}"`))
})
