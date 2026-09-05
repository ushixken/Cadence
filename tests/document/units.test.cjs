'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

function runtime(b) {
  return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo})');
}

test('new documents use immutable canonical millimeters and expose the supported unit set', async () => {
  const b = await browser();
  assert.deepEqual(b.read('modelReader.units()'), { length: 'mm' });
  assert.equal(b.run('Object.isFrozen(modelReader.units())'), true);
  assert.deepEqual(b.read('window.CaderactUnits.supportedLengthUnits'), ['mm', 'cm', 'm', 'in', 'ft']);
  for (const unit of ['mm', 'cm', 'm', 'in', 'ft']) assert.equal(b.run(`window.CaderactUnits.isSupportedLengthUnit(${JSON.stringify(unit)})`), true);
  for (const unit of ['MM', 'ft-in', '', null]) assert.equal(b.run(`window.CaderactUnits.isSupportedLengthUnit(${JSON.stringify(unit)})`), false);
});

test('unit conversion handles exact common conversions, signed values, and finite validation', async () => {
  const b = await browser();
  assert.equal(b.run("window.CaderactUnits.convert(25.4,'mm','in')"), 1);
  assert.equal(b.run("window.CaderactUnits.convert(1000,'mm','m')"), 1);
  assert.equal(b.run("window.CaderactUnits.convert(0,'ft','cm')"), 0);
  assert.ok(Math.abs(b.run("window.CaderactUnits.convert(-2,'ft','in')") + 24) < 1e-12);
  assert.ok(Math.abs(b.run("window.CaderactUnits.convert(1,'cm','in')") - (10 / 25.4)) < 1e-12);
  assert.throws(() => b.run("window.CaderactUnits.convert(Infinity,'mm','m')"), /finite/);
  assert.throws(() => b.run("window.CaderactUnits.convert(1,'yard','m')"), /Unsupported/);
  assert.throws(() => b.run("window.CaderactUnits.convert(Number.MAX_VALUE,'m','mm')"), /finite/);
});

test('unit formatting is deterministic and does not change stored precision', async () => {
  const b = await browser();
  assert.equal(b.run("window.CaderactUnits.format(1.23456,'mm',3)"), '1.235 mm');
  assert.equal(b.run("window.CaderactUnits.format(-0.0001,'m',3)"), '0.000 m');
  assert.equal(b.run("window.CaderactUnits.format(-12.5,'ft',2)"), '-12.50 ft');
  assert.throws(() => b.run("window.CaderactUnits.format(1,'mm',16)"), /Precision/);
  assert.throws(() => b.run("window.CaderactUnits.format(NaN,'mm',2)"), /finite/);
});

test('unit changes are single metadata transactions while same and invalid units are no-ops', async () => {
  const b = await browser();
  const initial = runtime(b);
  const changed = b.run("unitGateway.setLengthUnit('in')");
  assert.equal(changed.status, 'committed');
  assert.equal(changed.changes.length, 1);
  assert.equal(changed.changes[0].collection, 'settings');
  assert.equal(b.read('modelReader.units().length'), 'in');
  assert.equal(b.read('documentController.currentRevision'), initial.revision + 1);
  assert.equal(b.read('documentController.historyInfo.entryCount'), initial.history.entryCount + 1);
  const after = runtime(b);
  assert.equal(b.run("unitGateway.setLengthUnit('in').status"), 'no-op');
  assert.equal(b.run("unitGateway.setLengthUnit('yard').status"), 'unsupported-unit');
  assert.deepEqual(runtime(b), after);
});

test('Undo and Redo restore unit metadata without changing geometry values or identities', async () => {
  const b = await browser();
  b.run('window.__record=recordGateway.createLine({x:-2.5,y:0},{x:25.4,y:1000}); recordGateway.createAll([window.__record])');
  const geometry = b.read('modelReader.snapshot().geometry');
  b.run("unitGateway.setLengthUnit('ft')");
  assert.equal(b.read('modelReader.units().length'), 'ft');
  assert.deepEqual(b.read('modelReader.snapshot().geometry'), geometry);
  assert.equal(b.run('documentController.undo().status'), 'undone');
  assert.equal(b.read('modelReader.units().length'), 'mm');
  assert.deepEqual(b.read('modelReader.snapshot().geometry'), geometry);
  assert.equal(b.run('documentController.redo().status'), 'redone');
  assert.equal(b.read('modelReader.units().length'), 'ft');
  assert.deepEqual(b.read('modelReader.snapshot().geometry'), geometry);
});

test('A8 persistence round-trips exact unit state and rejects missing or invalid units', async () => {
  const b = await browser();
  b.run("unitGateway.setLengthUnit('cm'); window.__unitJson=window.CaderactPersistence.serializeDocument(modelReader.snapshot())");
  const payload = JSON.parse(b.run('window.__unitJson'));
  assert.deepEqual(payload.document.units, { length: 'cm' });
  b.run('window.__unitLoaded=window.CaderactPersistence.loadStore(window.__unitJson)');
  assert.equal(b.read('window.__unitLoaded.reader.units().length'), 'cm');
  assert.equal(b.run('window.CaderactPersistence.serializeDocument(window.__unitLoaded.reader.snapshot())'), b.run('window.__unitJson'));

  const before = runtime(b);
  for (const corrupt of [
    value => { delete value.document.units; },
    value => { value.document.units.length = 'yard'; },
  ]) {
    const invalid = structuredClone(payload); corrupt(invalid);
    const serialized = JSON.stringify(invalid);
    assert.throws(() => b.run(`window.CaderactPersistence.loadStore(${JSON.stringify(serialized)})`), /Invalid Caderact file/);
  }
  assert.deepEqual(runtime(b), before);
});
