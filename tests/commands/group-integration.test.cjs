'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
function typed(b,value){b.input.value=value;b.emit(b.input,'input');return b.key('Enter',b.input)}
function seedLines(b){b.run('window.__members=[recordGateway.createLine({x:0,y:0},{x:10,y:0}),recordGateway.createLine({x:0,y:20},{x:10,y:20})];recordGateway.createAll(window.__members);window.__group=window.caderactDocumentSession.groupGateway.createGroup(window.__members.map(r=>r.id)).group');return b.read('({members:window.__members,group:window.__group})')}
function selectGroup(b){b.run('window.caderactSelection.selectOnly(window.__members[0].id)')}
function state(b){return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,history:documentController.historyInfo})')}
function features(record){const ids=[];const visit=value=>{if(!value||typeof value!=="object")return;if(typeof value.featureId==="string")ids.push(value.featureId);for(const child of Object.values(value))visit(child)};visit(record);return ids}

test('GB2 click represents a Group as one logical target and highlights every member',async()=>{
  const b=await browser(),{members,group}=seedLines(b);b.point(425,300);b.flush();
  assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),members.map(r=>r.id).sort());
  assert.deepEqual(b.read('window.caderactSelection.selectedTargets()'),[{kind:'group',id:group.id,recordIds:group.memberIds}]);
  assert.deepEqual(plain(b.renders.at(-1).selectionOverlay.recordIds),members.map(r=>r.id).sort());
  assert.equal(b.read('window.caderactGrips.grips().length'),0);
});

test('GB2 Window requires every member while Crossing expands any hit to the whole Group',async()=>{
  const windowCase=await browser(),seed=seedLines(windowCase);windowCase.point(390,290);windowCase.point(460,310,'pointermove');windowCase.point(460,310,'pointerup');assert.deepEqual(windowCase.read('window.caderactSelection.selectedIds()'),[]);
  const crossing=await browser(),crossingSeed=seedLines(crossing);crossing.point(460,310);crossing.point(390,290,'pointermove');crossing.point(390,290,'pointerup');assert.deepEqual(crossing.read('window.caderactSelection.selectedIds()'),crossingSeed.members.map(r=>r.id).sort());
});

test('GB2 hidden or locked members conservatively prevent whole-Group selection and editing',async()=>{
  for(const mode of ['hidden','locked']){const b=await browser();seedLines(b);b.run("layerGateway.create('Blocked');window.__blocked=modelReader.layers().find(l=>l.name==='Blocked');recordGateway.assignLayer([window.__members[1].id],window.__blocked.id)");b.run(mode==='hidden'?'layerGateway.setVisibility(window.__blocked.id,false)':'layerGateway.setLocked(window.__blocked.id,true)');b.point(425,300);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);assert.equal(b.read('window.caderactDocumentSession.recordGateway.setProperties(window.__members.map(r=>r.id),{color:"#ff0000"}).status'),'selection-not-editable')}
});

test('GB2 Group Delete is one transaction and Undo/Redo restore exact records and Group',async()=>{
  const b=await browser();seedLines(b);const before=state(b);selectGroup(b);b.launch('Delete');b.key('Enter',b.document);assert.equal(b.read('modelReader.records().length'),0);assert.equal(b.read('modelReader.groups().length'),0);assert.equal(b.read('documentController.historyInfo.entryCount'),before.history.entryCount+1);b.run('documentController.undo()');assert.deepEqual(b.read('modelReader.snapshot()'),before.document);b.run('documentController.redo()');assert.equal(b.read('modelReader.records().length'),0);assert.equal(b.read('modelReader.groups().length'),0)
});

test('GB2 Group Copy atomically creates fresh member, feature, and Group identities',async()=>{
  const b=await browser();b.run('window.__members=[recordGateway.createLine({x:0,y:0},{x:10,y:0}),recordGateway.createPolyline([{x:0,y:5},{x:5,y:10}],false),recordGateway.createText({insertionPoint:{x:0,y:15},text:"G",height:2,rotation:0})];recordGateway.createAll(window.__members);window.__group=window.caderactDocumentSession.groupGateway.createGroup(window.__members.map(r=>r.id)).group;window.caderactSelection.selectOnly(window.__members[0].id)');const originals=b.read('window.__members'),before=state(b);b.launch('Copy');typed(b,'0,0');typed(b,'5,0');const copies=b.read('window.caderactCommandRouter.lastResult.recordIds.map(id=>modelReader.records().find(r=>r.id===id))'),groups=b.read('modelReader.groups()');assert.equal(groups.length,2);const copied=groups.find(g=>g.id!==b.read('window.__group.id'));assert.deepEqual(copied.memberIds,copies.map(r=>r.id).sort());assert.notEqual(copied.id,b.read('window.__group.id'));for(const copy of copies){const source=originals.find(r=>r.type===copy.type);assert.notEqual(copy.id,source.id);for(const id of features(copy))assert.equal(features(source).includes(id),false)}assert.equal(b.read('documentController.historyInfo.entryCount'),before.history.entryCount+1);assert.deepEqual(b.read('window.caderactSelection.selectedTargets()').map(t=>t.id),[copied.id])
});

test('GB2 partial or failed Group Copy publishes nothing',async()=>{
  const b=await browser();seedLines(b);const before=state(b);b.run('window.__copy=recordGateway.copyWithFreshIdentity(window.__members[0])');assert.equal(b.read('window.caderactDocumentSession.groupGateway.publishCopies([window.__members[0].id],[window.__copy]).status'),'partial-group-copy');assert.deepEqual(state(b),before);selectGroup(b);b.launch('Copy');typed(b,'0,0');b.run('window.__blocking=documentController.beginTransaction()');typed(b,'5,0');assert.deepEqual(state(b),before);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Copy');b.run('window.__blocking.rollback()')
});

test('GB2 Move, Rotate, Scale, and Mirror transform every member atomically and preserve Group identity',async()=>{
  for(const command of ['Move','Rotate','Scale','Mirror']){const b=await browser();seedLines(b);selectGroup(b);const group=b.read('window.__group'),ids=b.read('window.__members.map(r=>r.id)'),history=b.read('documentController.historyInfo.entryCount');b.launch(command);if(command==='Move'){typed(b,'0,0');typed(b,'5,3')}else if(command==='Rotate'){typed(b,'0,0');typed(b,'1,0');typed(b,'0,1')}else if(command==='Scale'){typed(b,'0,0');typed(b,'1,0');typed(b,'2,0')}else{b.run('window.caderactCommandRouter.activeSession.handleOption("copy")');typed(b,'0,0');typed(b,'0,1')}assert.deepEqual(b.read('modelReader.groups()[0]'),group);assert.deepEqual(b.read('modelReader.records().map(r=>r.id)'),ids.slice().sort());assert.equal(b.read('documentController.historyInfo.entryCount'),history+1);assert.deepEqual(b.read('window.CaderactDocument.validateDocument(modelReader.snapshot())'),[])}
});

test('GB2 transform failure is atomic for the complete Group',async()=>{
  const b=await browser();seedLines(b);selectGroup(b);const before=state(b);b.launch('Scale');typed(b,'0,0');typed(b,'1,0');typed(b,'1e308');assert.deepEqual(state(b),before);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Scale');assert.deepEqual(b.read('modelReader.groups()[0]'),b.read('window.__group'))
});

test('GB2 heterogeneous semantic members transform together and Escape leaves previews transient',async()=>{
  const b=await browser();b.run('window.__members=[recordGateway.createCircle({x:0,y:0},2),recordGateway.createPolyline([{x:5,y:0},{x:8,y:2}],false),recordGateway.createText({insertionPoint:{x:10,y:0},text:"A",height:2,rotation:0}),recordGateway.createLinearDimension({mode:"aligned",firstPoint:{x:0,y:5},secondPoint:{x:4,y:5},dimensionLinePoint:{x:0,y:7}}),recordGateway.createRegion([recordGateway.createCircle({x:20,y:0},3)]),recordGateway.createHatch([recordGateway.createCircle({x:30,y:0},3)]),recordGateway.createHatch([recordGateway.createCircle({x:40,y:0},3)],{kind:"named",name:"ANSI31",angle:0,scale:1,origin:{x:0,y:0}})];recordGateway.createAll(window.__members);window.__group=window.caderactDocumentSession.groupGateway.createGroup(window.__members.map(r=>r.id)).group;window.caderactSelection.selectOnly(window.__members[0].id)');const before=state(b);b.launch('Move');typed(b,'0,0');b.point(425,275,'pointermove');b.flush();assert.equal(b.read('window.caderactCommandRouter.activeSession.getMovePreview().records.length'),7);b.key('Escape');assert.deepEqual(state(b),before);b.launch('Move');typed(b,'0,0');typed(b,'2,3');assert.deepEqual(b.read('modelReader.groups()[0]'),before.document.groups[b.read('window.__group.id')]);assert.equal(b.read('modelReader.records().length'),7)
});

test('GB2 Properties and Layer operations flatten Group members atomically without Group appearance',async()=>{
  const b=await browser();seedLines(b);b.run('recordGateway.setProperties([window.__members[0].id],{color:"#ff0000"});window.caderactSelection.selectOnly(window.__members[0].id)');assert.equal(b.run('modelReader.aggregateRecordProperties(window.caderactSelection.selectedIds()).color===window.CaderactObjectProperties.MIXED'),true);const history=b.read('documentController.historyInfo.entryCount');assert.equal(b.read('recordGateway.setProperties(window.caderactSelection.selectedIds(),{color:"#00ff00",linetype:"dashed",lineweight:.5}).status'),'committed');assert.ok(b.read('window.__members.map(r=>modelReader.records().find(x=>x.id===r.id)).every(r=>r.color==="#00ff00"&&r.linetype==="dashed"&&r.lineweight===.5)'));assert.equal(b.read('documentController.historyInfo.entryCount'),history+1);b.run("layerGateway.create('Target')");const layer=b.read("modelReader.layers().find(l=>l.name==='Target')");assert.equal(b.read(`recordGateway.assignLayer(window.caderactSelection.selectedIds(),${JSON.stringify(layer.id)}).status`),'committed');assert.ok(b.read(`window.__members.every(r=>modelReader.records().find(x=>x.id===r.id).layerId===${JSON.stringify(layer.id)})`));assert.deepEqual(Object.keys(b.read('modelReader.groups()[0]')).sort(),['id','memberIds','name'])
});

test('GB2 Groups add no geometry, snap, tracking, or measurement authority and persistence stays exact',async()=>{
  const b=await browser();seedLines(b);const recordsBefore=b.read('modelReader.records()'),serialized=b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');b.flush();assert.equal(b.renders.at(-1).recordCount,undefined);assert.deepEqual(b.read('modelReader.records()'),recordsBefore);b.launch('Line');b.point(400,300,'pointermove');assert.ok(b.read('window.__members.map(r=>r.id).includes(activeSnapResult.reference.recordId)'));assert.notEqual(b.read('activeSnapResult.reference.recordId'),b.read('window.__group.id'));b.key('Escape');assert.equal(b.read('window.CaderactMeasurement.measureRecord(modelReader.records()[0]).length'),10);b.window.__serialized=serialized;b.run('window.__loaded=window.CaderactPersistence.loadStore(window.__serialized)');assert.equal(b.run('window.CaderactPersistence.serializeDocument(window.__loaded.reader.snapshot())'),serialized)
});
