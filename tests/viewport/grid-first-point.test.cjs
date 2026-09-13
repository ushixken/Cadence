'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

function enableGrid(b) { b.emit(b.gridSnapButton, 'click') }
function moveToGrid(b) { b.point(451, 249, 'pointermove'); assert.equal(b.read('activeSnapResult.kind'), 'grid'); assert.deepEqual(b.read('activeSnapResult.point'), { x: 10, y: 10 }) }
function seedSelection(b) { b.run('window.__firstPointRecord=recordGateway.createLine({x:30,y:0},{x:40,y:0});recordGateway.createAll([window.__firstPointRecord]);window.caderactSelection.selectOnly(window.__firstPointRecord.id)') }

test('Grid Snap resolves and accepts Line P1 before a drafting reference exists', async () => {
  const b = await browser(); enableGrid(b); b.launch('Line'); moveToGrid(b);
  assert.equal(b.read('modelReader.records().length'), 0); b.point(451, 249);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.firstPoint'), { x: 10, y: 10 });
});

test('Grid Snap is available at initial point acquisition across primitive commands', async () => {
  for (const command of ['Polyline', 'Rectangle', 'Circle', 'Arc', 'Ellipse']) {
    const b = await browser(); enableGrid(b); b.launch(command); moveToGrid(b);
  }
  const polygon = await browser(); enableGrid(polygon); polygon.launch('Polygon'); polygon.input.value='4'; polygon.emit(polygon.input,'input'); polygon.key('Enter',polygon.input); moveToGrid(polygon);
});

test('Grid Snap is available at initial base/center/axis acquisition for transforms', async () => {
  for (const command of ['Move', 'Copy', 'Rotate', 'Scale', 'Mirror']) {
    const b = await browser(); seedSelection(b); enableGrid(b); b.launch(command); moveToGrid(b);
  }
});

test('Grid Snap remains available before P1 when Ortho or Polar is enabled', async () => {
  for (const toggle of ['orthoButton', 'polarButton']) {
    const b = await browser(); enableGrid(b); b.emit(b[toggle], 'click'); b.launch('Line'); moveToGrid(b);
  }
});

test('Grid Snap off leaves first acquisition raw', async () => {
  const b = await browser(); b.launch('Line'); b.point(451,249,'pointermove'); assert.equal(b.read('activeSnapResult.snapped'), false);
});
