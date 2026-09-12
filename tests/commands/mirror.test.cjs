'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {browser}=require('../helpers/browser.cjs');
function typed(b,value){b.input.value=value;b.emit(b.input,'input');b.key('Enter',b.input)}
test('Mirror/MI reflect native records and reverse arc sweep',async()=>{
  const b=await browser();b.run('window.__line=recordGateway.createLine({x:2,y:3},{x:6,y:3});window.__arc=recordGateway.createArc({center:{x:5,y:2},radius:2,start:{x:7,y:2},end:{x:5,y:4},sweep:Math.PI/2});recordGateway.createAll([window.__line,window.__arc]);selection.applyRecordIds([window.__line.id,window.__arc.id])');
  b.launch('MI');typed(b,'0,0');typed(b,'0,10');const records=b.read('modelReader.records()');const line=records.find(record=>record.type==='line'),arc=records.find(record=>record.type==='arc');assert.deepEqual({x:line.start.x,y:line.start.y},{x:-2,y:3});assert.equal(arc.sweep,-Math.PI/2);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);
});
test('Mirror Copy creates fresh identities and selects only copies; degenerate axis remains retryable',async()=>{
  const b=await browser();b.run('window.__line=recordGateway.createLine({x:2,y:3},{x:6,y:3});recordGateway.createAll([window.__line]);selection.applyRecordIds([window.__line.id])');b.launch('Mirror');b.run('window.caderactCommandRouter.activateOption("copy")');typed(b,'0,0');typed(b,'0,0');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Mirror');typed(b,'0,10');assert.equal(b.read('modelReader.records().length'),2);const records=b.read('modelReader.records()'),copy=records.find(record=>record.id!==records.find(other=>other.id===b.read('window.__line.id'))?.id);assert.notEqual(copy.id,b.read('window.__line.id'));assert.notEqual(copy.start.featureId,b.read('window.__line.start.featureId'));assert.deepEqual(b.read('selection.selectedIds()'),[copy.id]);
});
