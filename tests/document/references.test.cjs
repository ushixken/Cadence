'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

async function fixture() {
  const b = await browser();
  b.run(`window.__referenceRecord=recordGateway.createLine({x:1,y:2},{x:3,y:4});
    recordGateway.createAll([window.__referenceRecord]);
    window.__resolver=window.CaderactReferences.createResolver(modelReader);
    window.__objectRef=window.CaderactReferences.createObjectReference(window.__referenceRecord.id);
    window.__startRef=window.CaderactReferences.createEndpointReference(window.__referenceRecord.id,window.__referenceRecord.start.featureId);
    window.__endRef=window.CaderactReferences.createEndpointReference(window.__referenceRecord.id,window.__referenceRecord.end.featureId)`);
  return b;
}

test('canonical immutable object and endpoint references resolve by stable identity', async () => {
  const b = await fixture();
  assert.deepEqual(b.read('window.__objectRef'), { kind: 'object', recordId: b.read('window.__referenceRecord.id') });
  assert.equal(b.run('Object.isFrozen(window.__objectRef)'), true);
  assert.equal(b.run('Object.isFrozen(window.__startRef)'), true);
  assert.equal(b.read('window.__resolver.resolve(window.__objectRef).record.id'), b.read('window.__referenceRecord.id'));
  assert.deepEqual(b.read('({role:window.__resolver.resolve(window.__startRef).role,feature:window.__resolver.resolve(window.__startRef).feature})'),
    { role: 'start', feature: b.read('window.__referenceRecord.start') });
  assert.deepEqual(b.read('({role:window.__resolver.resolve(window.__endRef).role,feature:window.__resolver.resolve(window.__endRef).feature})'),
    { role: 'end', feature: b.read('window.__referenceRecord.end') });
});

test('reference values are deterministic JSON-compatible data without object pointers', async () => {
  const b = await fixture();
  const encoded = b.run('JSON.stringify(window.__startRef)');
  assert.equal(encoded, JSON.stringify({ kind: 'feature', recordId: b.read('window.__referenceRecord.id'), featureId: b.read('window.__referenceRecord.start.featureId') }));
  b.run(`window.__decodedRef=JSON.parse(${JSON.stringify(encoded)})`);
  assert.equal(b.run('window.CaderactReferences.isReference(window.__decodedRef)'), true);
  assert.equal(b.run('window.__resolver.resolve(window.__decodedRef).status'), 'resolved');
  assert.equal(b.run('Object.hasOwn(window.__startRef,"record")'), false);
  assert.equal(b.run('Object.hasOwn(window.__startRef,"feature")'), false);
});

test('malformed references are rejected deterministically', async () => {
  const b = await fixture();
  const malformed = [
    null, [], {}, { kind: 'object' }, { kind: 'object', recordId: '' },
    { kind: 'feature', recordId: 'x' }, { kind: 'feature', recordId: 'x', featureId: '' },
    { kind: 'endpoint', recordId: 'x', featureId: 'y' },
    { kind: 'object', recordId: 'x', featureId: 'extra' },
  ];
  for (const reference of malformed) {
    b.window.__malformed = reference;
    assert.equal(b.run('window.__resolver.resolve(window.__malformed).status'), 'invalid-reference');
  }
  assert.throws(() => b.run('window.CaderactReferences.createObjectReference("")'), /Invalid/);
  assert.throws(() => b.run('window.CaderactReferences.createEndpointReference("record",null)'), /Invalid/);
});

test('missing records and mismatched record/feature pairs remain unresolved', async () => {
  const b = await fixture();
  assert.deepEqual(b.read('window.__resolver.resolve({kind:"object",recordId:"missing"})'), { status: 'unresolved', reason: 'missing-record' });
  assert.deepEqual(b.read('window.__resolver.resolve({kind:"object",recordId:"__proto__"})'), { status: 'unresolved', reason: 'missing-record' });
  assert.deepEqual(b.read('window.__resolver.resolve({kind:"feature",recordId:window.__referenceRecord.id,featureId:"missing"})'),
    { status: 'unresolved', reason: 'feature-not-in-record' });
  b.run(`window.__other=recordGateway.createLine({x:9,y:9},{x:10,y:10}); recordGateway.createAll([window.__other]);
    window.__mismatch=window.CaderactReferences.createEndpointReference(window.__referenceRecord.id,window.__other.start.featureId)`);
  assert.deepEqual(b.read('window.__resolver.resolve(window.__mismatch)'), { status: 'unresolved', reason: 'feature-not-in-record' });
});

test('references follow current replacement geometry and exact Undo/Redo state', async () => {
  const b = await fixture();
  const ids = b.read('({record:window.__referenceRecord.id,start:window.__referenceRecord.start.featureId,end:window.__referenceRecord.end.featureId})');
  b.run(`recordGateway.replace(window.__referenceRecord.id,{
    ...window.__referenceRecord,start:{...window.__referenceRecord.start,x:100,y:200},end:{...window.__referenceRecord.end,x:300,y:400}
  })`);
  assert.deepEqual(b.read('window.__resolver.resolve(window.__startRef).feature'), { x: 100, y: 200, featureId: ids.start });
  assert.deepEqual(b.read('window.__resolver.resolve(window.__endRef).feature'), { x: 300, y: 400, featureId: ids.end });
  assert.equal(b.read('window.__resolver.resolve(window.__objectRef).record.id'), ids.record);
  b.run('documentController.undo()');
  assert.deepEqual(b.read('window.__resolver.resolve(window.__startRef).feature'), { x: 1, y: 2, featureId: ids.start });
  b.run('documentController.redo()');
  assert.deepEqual(b.read('window.__resolver.resolve(window.__startRef).feature'), { x: 100, y: 200, featureId: ids.start });
});

test('deletion makes references unresolved and Undo restores exact topology identity', async () => {
  const b = await fixture();
  b.run('window.__deleteTx=documentController.beginTransaction(); window.__deleteTx.remove(window.__referenceRecord.id); window.__deleteTx.publish()');
  assert.equal(b.run('window.__resolver.resolve(window.__objectRef).reason'), 'missing-record');
  assert.equal(b.run('window.__resolver.resolve(window.__startRef).reason'), 'missing-record');
  b.run('documentController.undo()');
  assert.equal(b.run('window.__resolver.resolve(window.__objectRef).status'), 'resolved');
  assert.equal(b.read('window.__resolver.resolve(window.__startRef).feature.featureId'), b.read('window.__startRef.featureId'));
  assert.deepEqual(b.read('window.__resolver.resolve(window.__startRef).feature'), b.read('window.__referenceRecord.start'));
});

test('existing topology IDs and detached reference values survive A8 round-trip', async () => {
  const b = await fixture();
  b.run(`window.__loadedStore=window.CaderactPersistence.loadStore(window.CaderactPersistence.serializeDocument(modelReader.snapshot()));
    window.__loadedResolver=window.CaderactReferences.createResolver(window.__loadedStore.reader);
    window.__roundTripRef=JSON.parse(JSON.stringify(window.__endRef))`);
  assert.equal(b.run('window.__loadedResolver.resolve(window.__roundTripRef).status'), 'resolved');
  assert.deepEqual(b.read('window.__loadedResolver.resolve(window.__roundTripRef).feature'), b.read('window.__referenceRecord.end'));
  assert.equal(b.run('window.CaderactPersistence.FILE_VERSION'), 1);
});
