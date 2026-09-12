'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');
function typed(b, value) { b.input.value = value; b.emit(b.input, 'input'); b.key('Enter', b.input) }

test('Offset and O are repeatable and require a positive finite distance', async () => {
  for (const name of ['Offset', 'O', 'o']) { const b = await browser(); b.launch(name); assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Offset') }
  const b = await browser(); b.launch('Offset');
  for (const value of ['0', '-1', 'NaN', 'Infinity', 'wat']) { typed(b, value); assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'distance') }
  typed(b, '5'); assert.equal(b.read('window.caderactCommandRouter.activeSession.distance'), 5); assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'select');
});

test('Offset creates each Line side as a fresh record and stays in its persistent loop', async () => {
  const b = await browser(); b.run('recordGateway.createAll([recordGateway.createLine({x:0,y:0},{x:20,y:0})])');
  const original = b.read('modelReader.records()[0]'); b.launch('O'); typed(b, '4');
  b.point(450,300); b.point(450,280,'pointermove'); b.flush();
  assert.equal(b.renders.at(-1).nextSegmentPreviewOverlay.segments.length, 4);
  b.point(450,280); assert.equal(b.read('modelReader.records().length'), 2);
  const offset = b.read('modelReader.records().find(record=>record.type==="line"&&record.start.y===4)'); assert.deepEqual({start:{x:offset.start.x,y:offset.start.y},end:{x:offset.end.x,y:offset.end.y}}, {start:{x:0,y:4},end:{x:20,y:4}});
  assert.notEqual(offset.id, original.id); assert.notEqual(offset.start.featureId, original.start.featureId);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'), 'select');
  b.key('Enter'); assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
});

test('Offset consumes exactly one valid preselected source after its distance phase', async () => {
  const b=await browser();b.run('window.__source=recordGateway.createLine({x:0,y:0},{x:20,y:0});recordGateway.createAll([window.__source]);selection.applyRecordIds([window.__source.id])');
  b.launch('Offset');assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'distance');typed(b,'3');assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'side');
  b.point(450,280,'pointermove');b.point(450,280);assert.equal(b.read('modelReader.records().length'),2);
  const fallback=await browser();fallback.run('window.__a=recordGateway.createLine({x:0,y:0},{x:10,y:0});window.__b=recordGateway.createLine({x:0,y:10},{x:10,y:10});recordGateway.createAll([window.__a,window.__b]);selection.applyRecordIds([window.__a.id,window.__b.id])');fallback.launch('Offset');typed(fallback,'3');assert.equal(fallback.read('window.caderactCommandRouter.activeSession.phase'),'select');
});

test('Offset circle, arc, and native Polyline preserve native topology while Ellipse remains retryable', async () => {
  const b = await browser();
  b.run('window.__c=recordGateway.createCircle({x:0,y:0},10);window.__a=recordGateway.createArc({center:{x:30,y:0},radius:10,start:{x:40,y:0},end:{x:30,y:10},sweep:Math.PI/2});window.__p=recordGateway.createPolyline([{x:0,y:20},{x:20,y:20},{x:20,y:40}],false);window.__e=recordGateway.createEllipse({center:{x:50,y:30},majorAxis:{x:10,y:0},minorRadius:5});recordGateway.createAll([window.__c,window.__a,window.__p,window.__e])');
  assert.deepEqual(b.read('window.CaderactOffsetGeometry.offset(window.__c,2,{x:20,y:0}).geometry'), {type:'circle',center:{x:0,y:0},radius:12});
  const arc = b.read('window.CaderactOffsetGeometry.offset(window.__a,2,{x:45,y:0}).geometry'); assert.equal(arc.type,'arc'); assert.equal(arc.radius,12); assert.equal(arc.sweep,Math.PI/2);
  const polyline = b.read('window.CaderactOffsetGeometry.offset(window.__p,2,{x:5,y:15}).geometry'); assert.equal(polyline.type,'polyline'); assert.equal(polyline.closed,false); assert.equal(polyline.vertices.length,3);
  b.launch('Offset'); typed(b,'2'); b.point(650,150); assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'select'); assert.equal(b.read('modelReader.records().length'), 4);
});
