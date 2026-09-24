const test=require('node:test')
const assert=require('node:assert/strict')
const {browser}=require('../helpers/browser.cjs')

function section(b,name){return b.propertiesContent.children.find(node=>node.classList.contains('property-section')&&node.children[0]?.textContent===name)}
function row(b,sectionName,label){return section(b,sectionName)?.children.find(node=>node.children?.[0]?.textContent===label)}
function edit(b,sectionName,label,value){const input=row(b,sectionName,label).children[1];input.value=String(value);b.emit(input,'change')}
function state(b){return b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount,dirty:documentController.isDirty})')}

test('UX9B Line definition fields commit once, preserve topology identity, and Undo Redo exactly',async()=>{
  const b=await browser();b.run('window.__line=recordGateway.createLine({x:1,y:2},{x:4,y:6});recordGateway.createAll([window.__line]);window.caderactSelection.selectOnly(window.__line.id)');b.window.caderactPropertiesPanel.open();const before=b.read('modelReader.records()[0]'),history=b.read('documentController.historyInfo.entryCount');edit(b,'Definition','Start X',2);const after=b.read('modelReader.records()[0]');assert.equal(after.start.x,2);assert.equal(after.start.featureId,before.start.featureId);assert.equal(after.end.featureId,before.end.featureId);assert.equal(b.read('documentController.historyInfo.entryCount'),history+1);assert.equal(row(b,'Geometry','Length').children[1].textContent,String(Number(Math.hypot(2,4).toFixed(3))));b.run('documentController.undo()');assert.deepEqual(b.read('modelReader.records()[0]'),before);b.run('documentController.redo()');assert.deepEqual(b.read('modelReader.records()[0]'),after)
})

test('UX9B invalid geometry values publish nothing and Circle edits refresh derived readouts',async()=>{
  const b=await browser();b.run('window.__circle=recordGateway.createCircle({x:5,y:6},2);recordGateway.createAll([window.__circle]);window.caderactSelection.selectOnly(window.__circle.id)');b.window.caderactPropertiesPanel.open();const before=state(b);edit(b,'Definition','Radius',0);assert.deepEqual(state(b),before);assert.equal(b.read('modelReader.records()[0].radius'),2);edit(b,'Definition','Center X',8);edit(b,'Definition','Radius',4);assert.deepEqual(b.read('modelReader.records()[0].center'),{x:8,y:6});assert.equal(row(b,'Geometry','Diameter').children[1].textContent,'8')
})

test('UX9B Arc center and radius use identity-preserving geometry transforms',async()=>{
  const b=await browser();b.run('window.__arc=recordGateway.createArc({center:{x:0,y:0},start:{x:2,y:0},end:{x:0,y:2},radius:2,sweep:Math.PI/2});recordGateway.createAll([window.__arc]);window.caderactSelection.selectOnly(window.__arc.id)');b.window.caderactPropertiesPanel.open();const features=b.read('[window.__arc.start.featureId,window.__arc.end.featureId]');edit(b,'Definition','Center Y',3);edit(b,'Definition','Radius',4);const arc=b.read('modelReader.records()[0]');assert.deepEqual(arc.center,{x:0,y:3});assert.deepEqual({x:arc.start.x,y:arc.start.y},{x:4,y:3});assert.deepEqual([arc.start.featureId,arc.end.featureId],features);assert.equal(row(b,'Geometry','Radius').children[1].textContent,'4')
})

test('UX9B Text insertion and existing semantic text fields remain one inspector authority',async()=>{
  const b=await browser();b.run('window.__text=recordGateway.createText({insertionPoint:{x:1,y:2},text:"Note",height:2,rotation:0});recordGateway.createAll([window.__text]);window.caderactSelection.selectOnly(window.__text.id)');b.window.caderactPropertiesPanel.open();edit(b,'Definition','Insertion X',7);edit(b,'Text','Height',3);const text=b.read('modelReader.records()[0]');assert.equal(text.insertionPoint.x,7);assert.equal(text.height,3);assert.equal(text.insertionPoint.featureId,b.read('window.__text.insertionPoint.featureId'))
})

test('UX9B Block Instance edits instance transform only and never rewrites its definition',async()=>{
  const b=await browser();b.run(`window.__member=recordGateway.createLine({x:0,y:0},{x:2,y:0});window.__definition=blockDefinitionGateway.create({name:'Fixture',records:[window.__member]}).definition;window.__instance=recordGateway.createBlockInstance({definitionId:window.__definition.id,insertionPoint:{x:10,y:20}});recordGateway.createAll([window.__instance]);window.caderactSelection.selectOnly(window.__instance.id)`);b.window.caderactPropertiesPanel.open();const definition=b.read('modelReader.blockDefinitions()[0]'),history=b.read('documentController.historyInfo.entryCount');edit(b,'Block Transform','Insertion X',12);edit(b,'Block Transform','Rotation',90);edit(b,'Block Transform','Scale',2);const mirror=row(b,'Block Transform','Mirrored').children[1];mirror.value='true';b.emit(mirror,'change');const instance=b.read('modelReader.records()[0]');assert.equal(instance.insertionPoint.x,12);assert.ok(Math.abs(instance.rotation-Math.PI/2)<1e-12);assert.equal(instance.scale,2);assert.equal(instance.mirrored,true);assert.equal(instance.definitionId,definition.id);assert.deepEqual(b.read('modelReader.blockDefinitions()[0]'),definition);assert.equal(b.read('documentController.historyInfo.entryCount'),history+4)
})

test('UX9B mixed selections expose only safe shared properties and remain viewport-neutral',async()=>{
  const b=await browser(),geometry=b.read('({width:window.caderactViewport.cssWidth,height:window.caderactViewport.cssHeight})');b.run('window.__records=[recordGateway.createLine({x:0,y:0},{x:1,y:0}),recordGateway.createCircle({x:3,y:0},1)];recordGateway.createAll(window.__records);window.caderactSelection.applyRecordIds(window.__records.map(record=>record.id))');b.window.caderactPropertiesPanel.open();assert.equal(row(b,'Selection','Type').children[1].textContent,'Multiple (2)');assert.equal(section(b,'Definition'),undefined);assert.equal(section(b,'Block Transform'),undefined);assert.ok(row(b,'General','Layer'));assert.ok(row(b,'Appearance','Color'));assert.deepEqual(b.read('({width:window.caderactViewport.cssWidth,height:window.caderactViewport.cssHeight})'),geometry)
})
