const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

function seed(b){return b.read(`(()=>{const records=[recordGateway.createLine({x:0,y:0},{x:3,y:4}),recordGateway.createCircle({x:0,y:0},5),recordGateway.createPolyline([{x:0,y:0},{x:2,y:0},{x:2,y:2}],true)];recordGateway.createAll(records);return records})()`)}
function sections(b){return b.propertiesContent.children.filter(child=>child.classList.contains('property-section'))}
function section(b,name){return sections(b).find(node=>node.children[0].textContent===name)}
function row(b,sectionName,label){return section(b,sectionName).children.find(child=>child.children?.[0]?.textContent===label)}
function state(b){return b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})')}

test('Properties shares the sidebar, follows selection, and C2 opens and focuses it',async()=>{
  const b=await browser(),records=seed(b);assert.equal(b.propertiesView.hidden,true);b.run(`window.caderactSelection.selectOnly(${JSON.stringify(records[0].id)})`);b.window.caderactPropertiesPanel.open();assert.equal(b.propertiesView.hidden,false);assert.equal(b.layersView.hidden,true);assert.equal(b.propertiesTab.getAttribute('aria-selected'),'true');assert.equal(b.document.activeElement,b.propertiesTab);assert.equal(row(b,'Selection','Type').children[1].textContent,'Line');assert.equal(row(b,'Selection','Count').children[1].textContent,'1');
  b.window.caderactPropertiesPanel.showLayers();assert.equal(b.layersView.hidden,false);b.emit(b.canvas,'contextmenu',{clientX:420,clientY:340});const item=b.contextMenu.children.find(child=>child.textContent==='Properties');b.emit(item,'click');assert.equal(b.propertiesView.hidden,false);assert.equal(b.document.activeElement,b.propertiesTab)
});

test('single dimensions expose a formatted measurement and one safe atomic Text Override editor',async()=>{
  const b=await browser(),record=b.read(`(()=>{const value=recordGateway.createLinearDimension({mode:'aligned',firstPoint:{x:0,y:0},secondPoint:{x:3,y:4},dimensionLinePoint:{x:2,y:3}});recordGateway.createAll([value]);window.caderactSelection.selectOnly(value.id);return value})()`);b.window.caderactPropertiesPanel.open()
  assert.equal(row(b,'Selection','Type').children[1].textContent,'Aligned Dimension');assert.match(row(b,'Geometry','Measurement').children[1].textContent,/5\.000/)
  const before=state(b),input=row(b,'Dimension','Text Override').children[1];assert.equal(input.value,'');assert.equal(input.maxLength,256);input.value='VERIFY';b.emit(input,'change');const changed=b.read('modelReader.records()[0]');assert.equal(changed.textOverride,'VERIFY');assert.equal(changed.id,record.id);assert.equal(changed.firstPoint.featureId,record.firstPoint.featureId);assert.equal(state(b).history.entryCount,before.history.entryCount+1)
  b.run('window.caderactHistory.undo()');assert.equal(b.read('modelReader.records()[0].textOverride'),null);b.run('window.caderactHistory.redo()');assert.equal(b.read('modelReader.records()[0].textOverride'),'VERIFY')
  const empty=row(b,'Dimension','Text Override').children[1];empty.value='';b.emit(empty,'change');assert.equal(b.read('modelReader.records()[0].textOverride'),null)
})

test('dimension text override validation rejects overlong and control-character persistence',async()=>{
  const b=await browser(),record=b.read(`recordGateway.createLinearDimension({mode:'horizontal',firstPoint:{x:0,y:0},secondPoint:{x:1,y:0},dimensionLinePoint:{x:0,y:1}})`);b.window.__r=record
  assert.ok(b.read("window.CaderactDocument.validateDocument({...modelReader.snapshot(),geometry:{objects:{[window.__r.id]:{...window.__r,textOverride:'x'.repeat(257)}}}})").some(message=>message.includes('textOverride')))
  assert.ok(b.read("window.CaderactDocument.validateDocument({...modelReader.snapshot(),geometry:{objects:{[window.__r.id]:{...window.__r,textOverride:'bad\\u0001'}}}})").some(message=>message.includes('textOverride')))
})

test('multi-selection uses the authoritative MIXED aggregation and edits one atomic transaction',async()=>{
  const b=await browser(),records=seed(b),ids=records.slice(0,2).map(record=>record.id);b.run(`recordGateway.setProperties([${JSON.stringify(ids[0])}],{linetype:'dashed'});window.caderactSelection.applyRecordIds(${JSON.stringify(ids)})`);b.window.caderactPropertiesPanel.open();assert.equal(row(b,'Selection','Type').children[1].textContent,'Multiple (2)');let linetype=row(b,'Appearance','Linetype').children[1].children[0];assert.equal(linetype.value,'mixed');const before=state(b);linetype.value='dotted';b.emit(linetype,'change');assert.equal(b.read(`modelReader.records().filter(record=>${JSON.stringify(ids)}.includes(record.id)).every(record=>record.linetype==='dotted')`),true);const after=state(b);assert.equal(after.revision,before.revision+1);assert.equal(after.history.entryCount,before.history.entryCount+1);b.run('documentController.undo()');assert.equal(row(b,'Appearance','Linetype').children[1].children[0].value,'mixed');b.run('documentController.redo()');assert.equal(row(b,'Appearance','Linetype').children[1].children[0].value,'dotted')
});

test('Layer reuses L3 assignment while appearance controls support explicit and ByLayer values',async()=>{
  const b=await browser(),records=seed(b),id=records[0].id;b.run(`layerGateway.create('Detail');window.caderactSelection.selectOnly(${JSON.stringify(id)})`);b.window.caderactPropertiesPanel.open();const layer=row(b,'General','Layer').children[1],target=b.read(`modelReader.layers().find(layer=>layer.name==='Detail').id`);layer.value=target;b.emit(layer,'change');assert.equal(b.read(`modelReader.records().find(record=>record.id===${JSON.stringify(id)}).layerId`),target);let color=row(b,'Appearance','Color').children[1],mode=color.children[0];mode.value='explicit';b.emit(mode,'change');assert.equal(b.read(`modelReader.records().find(record=>record.id===${JSON.stringify(id)}).color`),'#e8edf4');color=row(b,'Appearance','Color').children[1];mode=color.children[0];mode.value='by-layer';b.emit(mode,'change');assert.equal(b.read(`modelReader.records().find(record=>record.id===${JSON.stringify(id)}).color`),null)
});

test('single-selection geometry is read-only and active commands disable all property editors',async()=>{
  const b=await browser(),records=seed(b);b.run(`window.caderactSelection.selectOnly(${JSON.stringify(records[0].id)})`);b.window.caderactPropertiesPanel.open();assert.equal(row(b,'Geometry','Length').children[1].textContent,'5');b.launch('Move');assert.equal(row(b,'General','Layer').children[1].disabled,true);for(const name of ['Linetype','Lineweight'])assert.equal(row(b,'Appearance',name).children[1].children[0].disabled,true);assert.ok(b.propertiesContent.children.some(child=>child.classList.contains('properties-disabled-note')));b.key('Escape');assert.equal(row(b,'General','Layer').children[1].disabled,false)
});

test('selection/document lifecycle refreshes without mutations and empty selection shows an empty state',async()=>{
  const b=await browser(),records=seed(b),before=state(b);b.run(`window.caderactSelection.selectOnly(${JSON.stringify(records[2].id)})`);b.window.caderactPropertiesPanel.open();assert.equal(row(b,'Geometry','Vertex Count').children[1].textContent,'3');assert.equal(row(b,'Geometry','Open/Closed').children[1].textContent,'Closed');assert.deepEqual(state(b),before);b.run('window.caderactSelection.clear()');assert.equal(b.propertiesContent.children[0].classList.contains('properties-empty'),true);b.run(`window.caderactDocumentSession.replaceStore(window.CaderactDocument.createStore(),{reason:'test'})`);assert.equal(b.window.caderactPropertiesPanel.getState().selectedCount,0)
});

test('ByLayer remains the property state while inherited appearance is communicated without arbitrary mixed values',async()=>{
  const b=await browser(),records=seed(b),ids=records.slice(0,2).map(record=>record.id);b.run(`layerGateway.create('Red');window.__red=modelReader.layers().find(layer=>layer.name==='Red');window.__tx=documentController.beginTransaction();window.__tx.replaceIn('layers',window.__red.id,{...window.__red,color:'#ff0000',linetype:'dashed',lineweight:.7});window.__tx.publish();recordGateway.assignLayer([${JSON.stringify(ids[1])}],window.__red.id);window.caderactSelection.selectOnly(${JSON.stringify(ids[1])})`);b.window.caderactPropertiesPanel.open();let color=row(b,'Appearance','Color').children[1];assert.equal(color.children[0].value,'by-layer');assert.equal(color.children[1].value,'#ff0000');assert.equal(color.children[1].disabled,true);let line=row(b,'Appearance','Linetype').children[1];assert.equal(line.children[0].value,'by-layer');assert.equal(line.children[1].textContent,'→ Dashed');assert.equal(row(b,'Appearance','Lineweight').children[1].children[1].textContent,'→ 0.7 mm');b.run(`window.caderactSelection.applyRecordIds(${JSON.stringify(ids)})`);color=row(b,'Appearance','Color').children[1];assert.equal(color.children[0].value,'by-layer');assert.equal(color.children[1].textContent,'→ Mixed')
});

test('hide and lock reconciliation removes stale selection and property controls while Undo restores layer state',async()=>{
  for(const action of ['setVisibility','setLocked']){const b=await browser(),record=seed(b)[0];b.run(`layerGateway.create('Target');window.__target=modelReader.layers().find(layer=>layer.name==='Target');recordGateway.assignLayer([${JSON.stringify(record.id)}],window.__target.id);window.caderactSelection.selectOnly(${JSON.stringify(record.id)})`);b.window.caderactPropertiesPanel.open();b.run(`layerGateway.${action}(window.__target.id,${action==='setVisibility'?'false':'true'})`);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);assert.equal(b.propertiesContent.children[0].classList.contains('properties-empty'),true);b.run('documentController.undo()');assert.equal(b.read(`modelReader.layer(window.__target.id).${action==='setVisibility'?'visible':'locked'}`),action==='setVisibility')}
});

test('tabs support arrow navigation and context menus close on selection or document capability changes',async()=>{
  const b=await browser(),records=seed(b);b.emit(b.layersTab,'keydown',{key:'ArrowRight'});assert.equal(b.propertiesView.hidden,false);assert.equal(b.document.activeElement,b.propertiesTab);b.emit(b.propertiesTab,'keydown',{key:'Home'});assert.equal(b.layersView.hidden,false);b.run(`window.caderactSelection.selectOnly(${JSON.stringify(records[0].id)})`);b.emit(b.canvas,'contextmenu',{clientX:420,clientY:340});assert.equal(b.read('window.caderactContextMenu.getState().open'),true);b.run(`window.caderactSelection.selectOnly(${JSON.stringify(records[1].id)})`);assert.equal(b.read('window.caderactContextMenu.getState().open'),false);b.emit(b.canvas,'contextmenu',{clientX:420,clientY:340});b.run(`recordGateway.setProperties([${JSON.stringify(records[0].id)}],{color:'#ff0000'})`);assert.equal(b.read('window.caderactContextMenu.getState().open'),false)
});
