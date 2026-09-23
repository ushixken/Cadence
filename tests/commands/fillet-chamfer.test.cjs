'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');
function typed(b,value){b.input.value=value;b.emit(b.input,'input');b.key('Enter',b.input)}
function seed(b){b.resize(800,600);b.run(`window.__h=recordGateway.createLine({x:-10,y:0},{x:10,y:0});window.__v=recordGateway.createLine({x:0,y:-10},{x:0,y:10});recordGateway.createAll([window.__h,window.__v])`)}
function pickPositive(b,preview=false){b.point(440,300);b.point(400,260,'pointermove');if(preview)b.flush();else b.point(400,260)}
const geometry=records=>records.map(record=>record.type==='line'?{type:'line',start:{x:record.start.x,y:record.start.y},end:{x:record.end.x,y:record.end.y}}:{type:'arc',center:record.center,radius:record.radius,start:{x:record.start.x,y:record.start.y},end:{x:record.end.x,y:record.end.y},sweep:record.sweep});
const sortedGeometry=records=>geometry(records).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));

test('Fillet and Chamfer register through AF1 and expose UX4 typed/clickable options',async()=>{
  const b=await browser();
  assert.equal(b.read('window.caderactCadCommands.definitions().some(value=>value.name==="Fillet")'),true);assert.equal(b.read('window.caderactCadCommands.definitions().some(value=>value.name==="Chamfer")'),true);
  b.launch('F');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Fillet');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.options'),[{id:'radius',label:'Radius',value:'0',enabled:true}]);
  typed(b,'Radius');assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'value');typed(b,'bad');assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'value');assert.equal(b.input.value,'bad');typed(b,'2');assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'first');
  b.key('Escape');b.launch('Chamfer');b.run('window.caderactCommandRouter.activateOption("distance")');assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'value');typed(b,'2,3');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.options'),[{id:'distance',label:'Distance',value:'2,3',enabled:true}]);
});

test('Fillet radius zero commits two trimmed Lines in one atomic history operation',async()=>{
  const b=await browser();seed(b);const original=b.read('modelReader.records()'),before=b.read('documentController.historyInfo.entryCount');b.launch('Fillet');pickPositive(b);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.equal(b.read('documentController.historyInfo.entryCount'),before+1);
  const result=b.read('modelReader.records()');assert.equal(result.length,2);assert.deepEqual(sortedGeometry(result),sortedGeometry([
    {type:'line',start:{x:0,y:0},end:{x:0,y:10}}, {type:'line',start:{x:0,y:0},end:{x:10,y:0}},
  ]));
  b.run('window.caderactHistory.undo()');assert.deepEqual(b.read('modelReader.records()'),original);b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.records()'),result);
});

test('positive Fillet preview exactly matches committed Line and Arc geometry',async()=>{
  const b=await browser();seed(b);b.launch('Fillet');b.run('window.caderactCommandRouter.activateOption("radius")');typed(b,'2');b.point(440,300);b.point(400,260,'pointermove');b.flush();
  const preview=b.read('window.caderactCommandRouter.activeSession.getMovePreview().records');assert.equal(preview.length,3);assert.equal(b.read('documentController.historyInfo.entryCount'),1);
  b.point(400,260);const committed=b.read('modelReader.records()');assert.deepEqual(sortedGeometry(committed),sortedGeometry(preview));assert.equal(committed.filter(record=>record.type==='arc').length,1);
});

test('Chamfer supports equal and unequal values with preview equal to one atomic commit',async()=>{
  for(const value of ['2','2,3']){const b=await browser();seed(b);const original=b.read('modelReader.records()'),before=b.read('documentController.historyInfo.entryCount');b.launch('CHA');typed(b,'Distance');typed(b,value);b.point(440,300);b.point(400,260,'pointermove');b.flush();const preview=b.read('window.caderactCommandRouter.activeSession.getMovePreview().records');b.point(400,260);const result=b.read('modelReader.records()');assert.equal(result.length,3);assert.deepEqual(sortedGeometry(result),sortedGeometry(preview));assert.equal(b.read('documentController.historyInfo.entryCount'),before+1);assert.equal(result.every(record=>record.type==='line'),true);b.run('window.caderactHistory.undo()');assert.deepEqual(b.read('modelReader.records()'),original);b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.records()'),result)}
});

test('impossible, parallel, locked, cancellation, and hover remain mutation-free and retryable',async()=>{
  const impossible=await browser();seed(impossible);impossible.launch('Fillet');typed(impossible,'Radius');typed(impossible,'20');impossible.point(440,300);impossible.point(400,260);assert.equal(impossible.read('window.caderactCommandRouter.activeCommand'),'Fillet');assert.equal(impossible.read('modelReader.records().length'),2);impossible.key('Escape');assert.equal(impossible.read('modelReader.records().length'),2);
  const parallel=await browser();parallel.resize(800,600);parallel.run('recordGateway.createAll([recordGateway.createLine({x:-10,y:0},{x:10,y:0}),recordGateway.createLine({x:-10,y:4},{x:10,y:4})])');parallel.launch('Chamfer');parallel.point(440,300);parallel.point(440,280);assert.equal(parallel.read('window.caderactCommandRouter.activeCommand'),'Chamfer');assert.equal(parallel.read('modelReader.records().length'),2);
  const locked=await browser();seed(locked);locked.run(`layerGateway.create('Locked');window.__layer=modelReader.layers().find(layer=>layer.name==='Locked');recordGateway.assignLayer([window.__v.id],window.__layer.id);layerGateway.setLocked(window.__layer.id,true)`);const before=locked.read('({records:modelReader.records(),history:documentController.historyInfo.entryCount})');locked.launch('Fillet');locked.point(440,300);locked.point(400,260);assert.deepEqual(locked.read('({records:modelReader.records(),history:documentController.historyInfo.entryCount})'),before);locked.key('Escape');
  const hidden=await browser();seed(hidden);hidden.run(`layerGateway.create('Hidden');window.__layer=modelReader.layers().find(layer=>layer.name==='Hidden');recordGateway.assignLayer([window.__v.id],window.__layer.id);layerGateway.setVisibility(window.__layer.id,false)`);const hiddenBefore=hidden.read('({records:modelReader.records(),history:documentController.historyInfo.entryCount})');hidden.launch('Chamfer');hidden.point(440,300);hidden.point(400,260);assert.deepEqual(hidden.read('({records:modelReader.records(),history:documentController.historyInfo.entryCount})'),hiddenBefore);hidden.key('Escape');
  const hover=await browser();seed(hover);const hoverBefore=hover.read('({records:modelReader.records(),history:documentController.historyInfo.entryCount})');hover.launch('Chamfer');hover.point(440,300);hover.point(400,260,'pointermove');hover.flush();assert.deepEqual(hover.read('({records:modelReader.records(),history:documentController.historyInfo.entryCount})'),hoverBefore);hover.key('Escape');assert.deepEqual(hover.read('modelReader.records()'),hoverBefore.records);
});
