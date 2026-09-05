'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

const RECORD_COUNT = 5000;

test('authoritative read, stable ordering, scene projection, and Canvas2D consumption handle 5,000 Lines', async () => {
  const b = await browser({ realRenderer: true });
  const outcome = b.run(`(() => {
    const tx=documentController.beginTransaction(), layerId=modelReader.snapshot().defaultLayerId;
    for (let index=0; index<${RECORD_COUNT}; index++) {
      const suffix=String(index).padStart(5,'0'), id='scale_'+suffix;
      tx.create(id,{id,type:'line',layerId,start:{x:index,y:-index,featureId:'scale_start_'+suffix},end:{x:index+1,y:1-index,featureId:'scale_end_'+suffix}});
    }
    return tx.publish();
  })()`);
  assert.equal(outcome.status, 'committed');
  assert.equal(outcome.changes.length, RECORD_COUNT);
  assert.equal(b.read('documentController.currentRevision'), 1);
  assert.deepEqual(b.read('documentController.historyInfo'), { entryCount: 1, cursor: 1 });

  assert.equal(b.read('modelReader.records().length'), RECORD_COUNT);
  assert.equal(b.read('modelReader.records()[0].id'), 'scale_00000');
  assert.equal(b.read(`modelReader.records()[${RECORD_COUNT - 1}].id`), 'scale_04999');
  const scene = b.run('createScene()');
  assert.equal(scene.lineGroups[4].segments.length, RECORD_COUNT * 4);
  const beforeDraws = b.drawCalls.filter(call => call[0] === 'moveTo').length;
  b.run('renderer.render(createScene())');
  const consumedDraws = b.drawCalls.filter(call => call[0] === 'moveTo').length - beforeDraws;
  assert.ok(consumedDraws >= RECORD_COUNT);
  assert.equal(b.read('modelReader.records().length'), RECORD_COUNT);
});
