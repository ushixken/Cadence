const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

const state=b=>b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty,count:modelReader.records().length})');
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);

test('ME2 shared authority measures every supported native record without rounding',async()=>{
  const b=await browser();
  const measured=b.read(`(()=>{const m=window.CaderactMeasurement.measureRecord;return [m(recordGateway.createLine({x:0,y:0},{x:3,y:4})),m(recordGateway.createCircle({x:0,y:0},5)),m(recordGateway.createArc({center:{x:0,y:0},start:{x:2,y:0},end:{x:0,y:2},radius:2,sweep:-Math.PI/2})),m(recordGateway.createPolyline([{x:0,y:0},{x:3,y:0},{x:3,y:4}],false)),m(recordGateway.createPolyline([{x:0,y:0},{x:3,y:0},{x:3,y:4}],true)),m(recordGateway.createEllipse({center:{x:0,y:0},majorAxis:{x:3,y:4},minorRadius:2}))]})()`);
  assert.equal(measured[0].length,5);assert.equal(measured[1].radius,5);assert.equal(measured[1].diameter,10);near(measured[1].circumference,10*Math.PI);assert.equal(measured[2].sweepRadians,-Math.PI/2);near(measured[2].arcLength,Math.PI);assert.equal(measured[3].length,7);assert.equal(measured[4].length,12);assert.equal(measured[4].closed,true);assert.equal(measured[5].majorRadius,5);assert.equal(measured[5].minorRadius,2);assert.equal(measured[5].majorDiameter,10)
});

test('Length reports Line, Circle, Arc, and open/closed Polyline semantics',async()=>{
  for(const [factory,expected,label] of [[`recordGateway.createLine({x:0,y:0},{x:3,y:4})`,5,'Length'],[`recordGateway.createCircle({x:0,y:0},2)`,4*Math.PI,'Length'],[`recordGateway.createArc({center:{x:0,y:0},start:{x:2,y:0},end:{x:0,y:2},radius:2,sweep:Math.PI/2})`,Math.PI,'Arc Length'],[`recordGateway.createPolyline([{x:0,y:0},{x:3,y:0},{x:3,y:4}],true)`,12,'Polyline Length']]){const b=await browser(),before=state(b);b.run(`window.__record=${factory};recordGateway.createAll([window.__record]);window.caderactSelection.selectOnly(window.__record.id)`);const stable=state(b);b.launch('LEN');const result=b.read('window.caderactCommandRouter.lastResult');near(result.formattedMeasurement.value,expected);assert.equal(result.formattedMeasurement.label,label);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.deepEqual(state(b),stable);assert.equal(before.count,0)}
});

test('Radius and Diameter support Circle/Arc preselection and unsupported picks retry',async()=>{
  for(const [command,field,value] of [['RAD','radius',3],['DIA','diameter',6]])for(const factory of [`recordGateway.createCircle({x:0,y:0},3)`,`recordGateway.createArc({center:{x:0,y:0},start:{x:3,y:0},end:{x:0,y:3},radius:3,sweep:Math.PI/2})`]){const b=await browser();b.run(`window.__record=${factory};recordGateway.createAll([window.__record]);window.caderactSelection.selectOnly(window.__record.id)`);b.launch(command);assert.equal(b.read(`window.caderactCommandRouter.lastResult.measurement.${field}`),value)}
  const retry=await browser();retry.run('recordGateway.createAll([recordGateway.createEllipse({center:{x:0,y:0},majorAxis:{x:5,y:0},minorRadius:2})])');retry.launch('Radius');retry.point(425,300);assert.equal(retry.read('window.caderactCommandRouter.activeCommand'),'Radius');assert.equal(retry.read('window.caderactCommandRouter.lastResult.reason'),'unsupported-object')
});

test('object measurement preselection is deterministic and visible locked picks are allowed',async()=>{
  const multiple=await browser();multiple.run(`window.__records=[recordGateway.createLine({x:0,y:0},{x:3,y:4}),recordGateway.createCircle({x:20,y:0},2)];recordGateway.createAll(window.__records);window.caderactSelection.applyRecordIds(window.__records.map(x=>x.id))`);multiple.launch('Length');assert.equal(multiple.read('window.caderactCommandRouter.activeCommand'),'Length');
  const locked=await browser();locked.run(`layerGateway.create('Locked');window.__layer=modelReader.layers().find(x=>x.name==='Locked');window.__record=recordGateway.createCircle({x:0,y:0},5);recordGateway.createAll([window.__record]);recordGateway.assignLayer([window.__record.id],window.__layer.id);layerGateway.setLocked(window.__layer.id,true)`);const before=state(locked);locked.launch('Radius');locked.point(420,300);assert.equal(locked.read('window.caderactCommandRouter.lastResult.measurement.radius'),5);assert.deepEqual(state(locked),before);
  const hidden=await browser();hidden.run(`layerGateway.create('Hidden');window.__layer=modelReader.layers().find(x=>x.name==='Hidden');window.__record=recordGateway.createCircle({x:0,y:0},5);recordGateway.createAll([window.__record]);recordGateway.assignLayer([window.__record.id],window.__layer.id);layerGateway.setVisibility(window.__layer.id,false)`);hidden.launch('Radius');hidden.point(420,300);assert.equal(hidden.read('window.caderactCommandRouter.activeCommand'),'Radius');assert.equal(hidden.read('window.caderactCommandRouter.lastResult.kind'),'target-miss')
});

test('Properties geometry rows consume shared measurements and refresh after geometry history',async()=>{
  const b=await browser();b.run(`window.__records=[recordGateway.createLine({x:0,y:0},{x:3,y:4}),recordGateway.createCircle({x:10,y:0},2),recordGateway.createArc({center:{x:20,y:0},start:{x:22,y:0},end:{x:20,y:2},radius:2,sweep:Math.PI/2}),recordGateway.createPolyline([{x:30,y:0},{x:33,y:0},{x:33,y:4}],true),recordGateway.createEllipse({center:{x:40,y:0},majorAxis:{x:3,y:4},minorRadius:2})];recordGateway.createAll(window.__records);window.caderactPropertiesPanel.open()`);
  const rows=()=>Object.fromEntries(b.propertiesContent.children.find(x=>x.children?.[0]?.textContent==='Geometry').children.slice(1).map(x=>[x.children[0].textContent,x.children[1].textContent]));
  for(const [index,expected] of [[0,{Length:'5'}],[1,{Radius:'2',Diameter:'4'}],[2,{Radius:'2',Sweep:'90°',Length:String(Number(Math.PI.toFixed(3)))}],[3,{Length:'12',Vertices:'3',Status:'Closed'}],[4,{'Major radius':'5','Minor radius':'2'}]]){b.run(`window.caderactSelection.selectOnly(window.__records[${index}].id)`);assert.deepEqual(rows(),expected)}
  b.run(`window.__line=modelReader.records().find(x=>x.id===window.__records[0].id);window.__tx=documentController.beginTransaction();window.__tx.replaceIn('records',window.__line.id,{...window.__line,end:{...window.__line.end,x:0,y:10}});window.__tx.publish()`);b.run('window.caderactSelection.selectOnly(window.__records[0].id)');assert.equal(rows().Length,'10');b.run('documentController.undo()');assert.equal(rows().Length,'5')
});
