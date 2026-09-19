const test=require('node:test')
const assert=require('node:assert/strict')
const {browser}=require('../helpers/browser.cjs')

function linear(b){return b.read(`(()=>{const record=recordGateway.createLinearDimension({mode:'horizontal',firstPoint:{x:-20,y:0},secondPoint:{x:20,y:0},dimensionLinePoint:{x:0,y:10}});recordGateway.createAll([record]);return record})()`)}

test('dimension presentation is one semantic point-selection target with stable line and text hits',async()=>{
  const b=await browser(),record=linear(b)
  b.run('window.__p=window.CaderactDimensionGeometry.derive(modelReader.records()[0],modelReader.dimensionStyle(),modelReader.units())')
  const lineHit=b.read('window.CaderactSelection.hitTestRecords({screenPoint:worldToScreen(-10,10),records:modelReader.records(),worldToScreen})')
  const textHit=b.read('window.CaderactSelection.hitTestRecords({screenPoint:worldToScreen(window.__p.text.point.x,window.__p.text.point.y),records:modelReader.records(),worldToScreen})')
  assert.equal(lineHit.recordId,record.id);assert.equal(textHit.recordId,record.id)
  b.point(400,250);b.flush();assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[record.id]);assert.ok(b.renders.at(-1).lineGroups.some(group=>group.segments.length>0));assert.equal(b.renders.at(-1).annotationOverlay.items[0].color,'#63b7e6')
})

test('dimension Window/Crossing selection uses its visible presentation and Select All includes it',async()=>{
  const b=await browser(),record=linear(b)
  const windowResult=b.read("window.CaderactSelectionBox.query({start:{x:280,y:235},current:{x:520,y:310},records:modelReader.records(),worldToScreen}).recordIds")
  const crossingResult=b.read("window.CaderactSelectionBox.query({start:{x:405,y:260},current:{x:395,y:240},records:modelReader.records(),worldToScreen}).recordIds")
  assert.ok(windowResult.includes(record.id));assert.ok(crossingResult.includes(record.id))
  b.run('window.caderactViewport.selectAllCommittedGeometry()');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[record.id])
})

test('linear angular and radial dimensions expose semantic grips with stable feature identities',async()=>{
  const b=await browser();b.run(`window.__dims=[recordGateway.createLinearDimension({mode:'aligned',firstPoint:{x:0,y:0},secondPoint:{x:10,y:0},dimensionLinePoint:{x:5,y:5}}),recordGateway.createAngularDimension({firstRayPoint:{x:10,y:0},vertex:{x:0,y:0},secondRayPoint:{x:0,y:10},dimensionArcPoint:{x:5,y:5}}),recordGateway.createRadialDimension({mode:'radius',centerPoint:{x:20,y:0},dimensionPoint:{x:25,y:0},leaderPoint:{x:30,y:5}})];recordGateway.createAll(window.__dims);window.caderactSelection.applyRecordIds(window.__dims.map(record=>record.id))`)
  const grips=b.read('window.caderactGrips.grips()');assert.deepEqual(grips.reduce((counts,grip)=>(counts[grip.recordId]=(counts[grip.recordId]||0)+1,counts),{}),Object.fromEntries(b.read('window.__dims').map((record,index)=>[record.id,[3,4,3][index]])))
  assert.ok(grips.every(grip=>typeof grip.featureId==='string'&&grip.featureId.length>0))
})

test('dimension grip edit previews transiently then commits one identity-preserving history step',async()=>{
  const b=await browser(),record=linear(b);b.run(`window.caderactSelection.selectOnly(${JSON.stringify(record.id)})`);b.flush()
  const before=b.read('({revision:documentController.currentRevision,count:documentController.historyInfo.entryCount})')
  b.point(300,300);b.point(325,275,'pointermove');b.flush();assert.equal(b.read('window.caderactGrips.isActive'),true);assert.deepEqual(b.read('modelReader.records()[0]'),record);assert.equal(b.renders.at(-1).annotationOverlay.items.some(item=>item.preview),true)
  b.point(325,275,'pointerup');const changed=b.read('modelReader.records()[0]');assert.equal(changed.id,record.id);assert.equal(changed.firstPoint.featureId,record.firstPoint.featureId);assert.deepEqual([changed.firstPoint.x,changed.firstPoint.y],[-15,5]);assert.equal(b.read('documentController.currentRevision'),before.revision+1);assert.equal(b.read('documentController.historyInfo.entryCount'),before.count+1)
  b.run('window.caderactHistory.undo()');assert.deepEqual(b.read('modelReader.records()[0]'),record);b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.records()[0]'),changed)
})

test('invalid dimension grip edit stays retryable and does not publish',async()=>{
  const b=await browser(),record=linear(b);b.run(`window.caderactSelection.selectOnly(${JSON.stringify(record.id)})`);b.flush();const before=b.read('({revision:documentController.currentRevision,count:documentController.historyInfo.entryCount})')
  b.point(300,300);b.point(500,300,'pointermove');b.point(500,300,'pointerup');assert.equal(b.read('window.caderactGrips.isActive'),true);assert.deepEqual(b.read('modelReader.records()[0]'),record);assert.deepEqual(b.read('({revision:documentController.currentRevision,count:documentController.historyInfo.entryCount})'),before);b.key('Escape');assert.equal(b.read('window.caderactGrips.isActive'),false)
})

test('dimension transforms preserve semantic identity while copies receive fresh identities',async()=>{
  const b=await browser(),record=linear(b);b.window.__r=record
  for(const expression of ["translateRecord(window.__r,3,4)","rotateRecord(window.__r,{x:0,y:0},Math.PI/2)","scaleRecord(window.__r,{x:0,y:0},2)","mirrorRecord(window.__r,{x:0,y:-1},{x:0,y:1})"]){const transformed=b.read(`window.CaderactGeometryTransform.${expression}`);assert.equal(transformed.id,record.id);assert.equal(transformed.firstPoint.featureId,record.firstPoint.featureId)}
  const copy=b.read('recordGateway.copyWithFreshIdentity(window.__r)');assert.notEqual(copy.id,record.id);assert.notEqual(copy.firstPoint.featureId,record.firstPoint.featureId)
})

test('Delete removes a selected dimension atomically and Undo restores its exact identity',async()=>{
  const b=await browser(),record=linear(b);b.run(`window.caderactSelection.selectOnly(${JSON.stringify(record.id)})`);const before=b.read('documentController.historyInfo.entryCount');b.launch('Delete');b.key('Enter',b.document);assert.equal(b.read('modelReader.records().length'),0);assert.equal(b.read('documentController.historyInfo.entryCount'),before+1);b.run('window.caderactHistory.undo()');assert.deepEqual(b.read('modelReader.records()[0]'),record)
})

test('Trim Extend and Offset exclude dimensions without document mutation',async()=>{
  for(const command of ['Trim','Extend','Offset']){const b=await browser(),record=linear(b);b.run(`window.caderactSelection.selectOnly(${JSON.stringify(record.id)})`);const before=b.read('({document:modelReader.snapshot(),history:documentController.historyInfo.entryCount})');b.launch(command);assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),command==='Offset'?'select':command==='Trim'?'cutting-edges':'boundaries');assert.deepEqual(b.read('({document:modelReader.snapshot(),history:documentController.historyInfo.entryCount})'),before);b.key('Escape')}
})
