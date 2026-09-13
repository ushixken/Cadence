'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');
function typed(b, value) { b.input.value = value; b.emit(b.input, 'input'); b.key('Enter', b.input) }

test('P5 parses coordinates, scalars, angles, and exact polar input without document mutation', async () => {
  const b = await browser();
  assert.deepEqual(b.read('window.CaderactPrecisionInput.parse("100,200","mm")'), { status:'precision-parsed',kind:'point',point:{status:'point-parsed',kind:'point',relative:false,x:100,y:200} });
  assert.equal(b.read('window.CaderactPrecisionInput.parse("@25,-10","mm").kind'), 'relativePoint');
  assert.equal(b.read('window.CaderactPrecisionInput.resolvePoint("@100<90",{currentUnit:"mm",anchor:{x:10,y:20}}).y'), 120);
  assert.ok(Math.abs(b.read('window.CaderactPrecisionInput.resolvePoint("@100<90",{currentUnit:"mm",anchor:{x:10,y:20}}).x') - 10) < 1e-12);
  assert.equal(b.read('window.CaderactPrecisionInput.parseAngle("-30").degrees'), -30);
  for (const value of ['abc','@','100<','@<45','NaN','Infinity']) assert.equal(b.read(`window.CaderactPrecisionInput.parse(${JSON.stringify(value)},"mm").status`), 'invalid-input');
});

test('P5 direct distance uses the resolved pointer direction and typed polar bypasses snapping', async () => {
  const b = await browser();
  b.launch('Line'); typed(b, '0,0'); b.point(450, 300, 'pointermove'); typed(b, '100'); b.key('Enter');
  assert.deepEqual(b.read('(({x,y})=>({x,y}))(modelReader.records()[0].end)'), { x:100, y:0 });
  b.launch('Line'); typed(b, '10,20'); typed(b, '@25.5<90'); b.key('Enter');
  assert.equal(b.read('modelReader.records().find(record=>record.start.x===10&&record.start.y===20).end.y'),45.5); assert.ok(Math.abs(b.read('modelReader.records().find(record=>record.start.x===10&&record.start.y===20).end.x')-10)<1e-12);
});

test('P5 exact Rotate angle, Scale factor, and Offset distance reuse command semantics', async () => {
  const b = await browser();
  b.run('window.__line=recordGateway.createLine({x:0,y:0},{x:10,y:0});recordGateway.createAll([window.__line]);window.caderactSelection.selectOnly(window.__line.id)');
  b.launch('Rotate'); typed(b,'0,0'); typed(b,'10,0'); typed(b,'90');
  assert.equal(b.read('modelReader.records()[0].end.y'),10); assert.ok(Math.abs(b.read('modelReader.records()[0].end.x'))<1e-12);
  b.run('window.caderactSelection.selectOnly(window.__line.id)'); b.launch('Scale'); typed(b,'0,0'); typed(b,'10,0'); typed(b,'2');
  assert.equal(b.read('modelReader.records()[0].end.y'),20);
  b.launch('Offset'); b.run('window.caderactCommandRouter.activateOption("distance")'); typed(b,'2.5'); assert.equal(b.read('window.caderactCommandRouter.activeSession.distance'),2.5);
});
