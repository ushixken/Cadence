'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {browser}=require('../helpers/browser.cjs')

const root=path.join(__dirname,'../..'),css=()=>fs.readFileSync(path.join(root,'src/css/editor-page.css'),'utf8')
const state=b=>b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount,dirty:documentController.isDirty})')
const row=(b,id)=>b.layersList.children.find(child=>child.dataset.layerId===id)

test('UX9C dock drag clamps, persists workspace width, and notifies viewport without document mutation',async()=>{
  const b=await browser(),before=state(b),sizes=b.sizes.length;assert.equal(b.window.caderactRightDock.width,288);b.emit(b.rightDockResize,'pointerdown',{clientX:700,pointerId:9});b.emit(b.rightDockResize,'pointermove',{clientX:400,pointerId:9});assert.equal(b.window.caderactRightDock.width,450);assert.equal(b.layersPanel.style.width,'450px');b.flush();assert.equal(b.sizes.length,sizes);b.emit(b.rightDockResize,'pointerup',{clientX:400,pointerId:9});assert.equal(b.read('window.caderactUserPreferences.value.rightDockWidth'),450);b.emit(b.rightDockResize,'pointerdown',{clientX:400,pointerId:10});b.emit(b.rightDockResize,'pointermove',{clientX:900,pointerId:10});assert.equal(b.window.caderactRightDock.width,230);b.emit(b.rightDockResize,'pointerup',{pointerId:10});assert.deepEqual(state(b),before)
})

test('UX9C dock keyboard resizing and cancellation are deterministic',async()=>{
  const b=await browser();b.emit(b.rightDockResize,'keydown',{key:'ArrowLeft'});assert.equal(b.window.caderactRightDock.width,296);b.emit(b.rightDockResize,'keydown',{key:'End'});assert.equal(b.window.caderactRightDock.width,450);b.emit(b.rightDockResize,'pointerdown',{clientX:500,pointerId:4});b.emit(b.rightDockResize,'pointermove',{clientX:600,pointerId:4});assert.equal(b.window.caderactRightDock.width,350);b.emit(b.rightDockResize,'pointercancel',{pointerId:4});assert.equal(b.window.caderactRightDock.width,450)
})

test('UX9C layer color popover stages edits, cancels cleanly, and applies through LayerGateway once',async()=>{
  const b=await browser();b.run("layerGateway.create('Long Architectural Exterior Wall Layer');window.__layer=modelReader.layers().find(layer=>layer.name.startsWith('Long'))");const id=b.read('window.__layer.id'),before=state(b),trigger=row(b,id).children[3];b.emit(trigger,'click');const pop=b.window.caderactColorPopover;assert.equal(pop.getState().open,true);pop.hex.value='#123456';b.emit(pop.hex,'input');assert.deepEqual(state(b),before);b.emit(pop.cancel,'click');assert.deepEqual(state(b),before);b.emit(row(b,id).children[3],'click');pop.hex.value='#123456';b.emit(pop.hex,'input');b.emit(pop.apply,'click');assert.equal(b.read('modelReader.layer(window.__layer.id).color'),'#123456');assert.equal(b.read('documentController.historyInfo.entryCount'),before.history+1)
})

test('UX9C color validation, RGB synchronization, Escape, and outside close preserve staged ownership',async()=>{
  const b=await browser();b.run("layerGateway.create('Color Test');window.__layer=modelReader.layers().find(layer=>layer.name==='Color Test')");const id=b.read('window.__layer.id'),before=state(b),pop=b.window.caderactColorPopover;b.emit(row(b,id).children[3],'click');pop.hex.value='#zzzzzz';b.emit(pop.hex,'input');assert.equal(pop.apply.disabled,true);pop.channels[0].value='12.5';b.emit(pop.channels[0],'input');assert.equal(pop.apply.disabled,true);b.emit(b.document,'keydown',{key:'Escape'});assert.equal(pop.getState().open,false);assert.deepEqual(state(b),before);b.emit(row(b,id).children[3],'click');b.emit(b.canvas,'pointerdown');assert.equal(pop.getState().open,false);assert.deepEqual(state(b),before)
})

test('UX9C Properties color popover supports explicit and ByLayer through the existing property authority',async()=>{
  const b=await browser();b.run('window.__line=recordGateway.createLine({x:0,y:0},{x:2,y:0});recordGateway.createAll([window.__line]);window.caderactSelection.selectOnly(window.__line.id)');b.window.caderactPropertiesPanel.open();const section=b.propertiesContent.children.find(node=>node.children[0]?.textContent==='Appearance'),control=section.children.find(node=>node.children[0]?.textContent==='Color').children[1],pop=b.window.caderactColorPopover;b.emit(control,'click');assert.equal(pop.mode.hidden,false);pop.mode.value='custom';b.emit(pop.mode,'change');pop.hex.value='#abcdef';b.emit(pop.hex,'input');b.emit(pop.apply,'click');assert.equal(b.read('modelReader.records()[0].color'),'#abcdef');const next=section=>section.children.find(node=>node.children[0]?.textContent==='Color').children[1],current=b.propertiesContent.children.find(node=>node.children[0]?.textContent==='Appearance');b.emit(next(current),'click');pop.mode.value='by-layer';b.emit(pop.mode,'change');b.emit(pop.apply,'click');assert.equal(b.read('modelReader.records()[0].color'),null)
})

test('UX9C production CSS owns full-height scrolling, flexible rows, truncation, and responsive Properties',()=>{
  const source=css();assert.match(source,/\.sidebar-panel\s*\{[^}]*grid-template-rows:32px minmax\(0,1fr\)[^}]*min-height:0[^}]*overflow:hidden/s);assert.match(source,/\.layers-list\s*\{[^}]*overflow-x:hidden[^}]*overflow-y:auto/s);assert.match(source,/\.layer-row\s*\{[^}]*grid-template-columns:20px 24px 24px 24px minmax\(0,1fr\) 24px/s);assert.match(source,/\.layer-select\s*\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/s);assert.match(source,/\.property-row\s*\{[^}]*grid-template-columns:minmax\(86px,100px\) minmax\(0,1fr\)/s);assert.match(source,/\.right-dock-resize\s*\{[^}]*width:6px[^}]*cursor:col-resize/s)
})
