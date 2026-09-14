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

test('multi-selection uses the authoritative MIXED aggregation and edits one atomic transaction',async()=>{
  const b=await browser(),records=seed(b),ids=records.slice(0,2).map(record=>record.id);b.run(`recordGateway.setProperties([${JSON.stringify(ids[0])}],{linetype:'dashed'});window.caderactSelection.applyRecordIds(${JSON.stringify(ids)})`);b.window.caderactPropertiesPanel.open();assert.equal(row(b,'Selection','Type').children[1].textContent,'Multiple (2)');const linetype=row(b,'Appearance','Linetype').children[1];assert.equal(linetype.value,'mixed');const before=state(b);linetype.value='dotted';b.emit(linetype,'change');assert.equal(b.read(`modelReader.records().filter(record=>${JSON.stringify(ids)}.includes(record.id)).every(record=>record.linetype==='dotted')`),true);const after=state(b);assert.equal(after.revision,before.revision+1);assert.equal(after.history.entryCount,before.history.entryCount+1);b.run('documentController.undo()');assert.equal(row(b,'Appearance','Linetype').children[1].value,'mixed');b.run('documentController.redo()');assert.equal(row(b,'Appearance','Linetype').children[1].value,'dotted')
});

test('Layer reuses L3 assignment while appearance controls support explicit and ByLayer values',async()=>{
  const b=await browser(),records=seed(b),id=records[0].id;b.run(`layerGateway.create('Detail');window.caderactSelection.selectOnly(${JSON.stringify(id)})`);b.window.caderactPropertiesPanel.open();const layer=row(b,'General','Layer').children[1],target=b.read(`modelReader.layers().find(layer=>layer.name==='Detail').id`);layer.value=target;b.emit(layer,'change');assert.equal(b.read(`modelReader.records().find(record=>record.id===${JSON.stringify(id)}).layerId`),target);let color=row(b,'Appearance','Color').children[1],mode=color.children[0];mode.value='explicit';b.emit(mode,'change');assert.equal(b.read(`modelReader.records().find(record=>record.id===${JSON.stringify(id)}).color`),'#e8edf4');color=row(b,'Appearance','Color').children[1];mode=color.children[0];mode.value='by-layer';b.emit(mode,'change');assert.equal(b.read(`modelReader.records().find(record=>record.id===${JSON.stringify(id)}).color`),null)
});

test('single-selection geometry is read-only and active commands disable all property editors',async()=>{
  const b=await browser(),records=seed(b);b.run(`window.caderactSelection.selectOnly(${JSON.stringify(records[0].id)})`);b.window.caderactPropertiesPanel.open();assert.equal(row(b,'Geometry','Length').children[1].textContent,'5');b.launch('Move');for(const name of ['Layer','Linetype','Lineweight'])assert.equal(row(b,name==='Layer'?'General':'Appearance',name).children[1].disabled,true);assert.ok(b.propertiesContent.children.some(child=>child.classList.contains('properties-disabled-note')));b.key('Escape');assert.equal(row(b,'General','Layer').children[1].disabled,false)
});

test('selection/document lifecycle refreshes without mutations and empty selection shows an empty state',async()=>{
  const b=await browser(),records=seed(b),before=state(b);b.run(`window.caderactSelection.selectOnly(${JSON.stringify(records[2].id)})`);b.window.caderactPropertiesPanel.open();assert.equal(row(b,'Geometry','Vertices').children[1].textContent,'3');assert.equal(row(b,'Geometry','Status').children[1].textContent,'Closed');assert.deepEqual(state(b),before);b.run('window.caderactSelection.clear()');assert.equal(b.propertiesContent.children[0].classList.contains('properties-empty'),true);b.run(`window.caderactDocumentSession.replaceStore(window.CaderactDocument.createStore(),{reason:'test'})`);assert.equal(b.window.caderactPropertiesPanel.getState().selectedCount,0)
});
