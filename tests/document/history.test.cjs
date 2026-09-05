'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

async function fixture() {
  const b = await browser();
  return { b, layerId: b.read('modelReader.snapshot().currentLayerId') };
}
function recordExpr(id, layerId, ax, ay, bx, by, fa = `${id}_a`, fb = `${id}_b`) {
  return `({ id:${JSON.stringify(id)}, type:'line', layerId:${JSON.stringify(layerId)}, start:{x:${ax},y:${ay},featureId:${JSON.stringify(fa)}}, end:{x:${bx},y:${by},featureId:${JSON.stringify(fb)}} })`;
}
function commitCreate(b, layerId, id, ax = 0, ay = 0, bx = 1, by = 1) {
  const tx = b.run('documentController.beginTransaction()');
  tx.create(id, b.run(recordExpr(id, layerId, ax, ay, bx, by)));
  return tx.publish();
}

test('A4 initial state has an opaque identity, empty history, and no saved state', async () => {
  const { b } = await fixture();
  assert.equal(b.read('documentController.currentRevision'), 0);
  assert.notEqual(b.read('documentController.currentStateId'), '0');
  assert.equal(b.read('documentController.historyInfo.entryCount'), 0);
  assert.equal(b.read('documentController.historyInfo.cursor'), 0);
  assert.equal(b.read('documentController.canUndo'), false);
  assert.equal(b.read('documentController.canRedo'), false);
  assert.equal(b.read('documentController.isDirty'), true);
  assert.equal(b.read('documentController.savedStateId'), null);
});

test('a successful commit records exact immutable changes and a fresh state', async () => {
  const { b, layerId } = await fixture();
  const beforeState = b.read('documentController.currentStateId');
  const outcome = commitCreate(b, layerId, 'history_create', 0.125, -0.25, 10.5, 20.75);
  assert.equal(outcome.status, 'committed');
  assert.equal(outcome.revision, 1);
  assert.notEqual(outcome.stateId, beforeState);
  assert.deepEqual(b.read('documentController.historyInfo'), { entryCount: 1, cursor: 1 });
  assert.equal(b.read('documentController.canUndo'), true);
  assert.equal(Object.isFrozen(outcome.changes[0]), true);
  assert.equal(outcome.changes[0].after.start.x, 0.125);
});

test('no-op, rollback, and validation failure do not add history or change state identity', async () => {
  const { b, layerId } = await fixture();
  commitCreate(b, layerId, 'history_base');
  const before = b.read('({ state:documentController.currentStateId, revision:documentController.currentRevision, info:documentController.historyInfo })');
  const noOp = b.run('documentController.beginTransaction()'); noOp.remove('missing');
  assert.equal(noOp.publish().status, 'no-op');
  const rolledBack = b.run('documentController.beginTransaction()'); rolledBack.rollback();
  const invalid = b.run('documentController.beginTransaction()');
  invalid.create('history_invalid', b.run(recordExpr('history_invalid', layerId, 0, 0, 1, 1)));
  invalid.read('history_invalid').start.x = Infinity;
  assert.equal(invalid.publish().status, 'validation-failed');
  assert.deepEqual(b.read('({ state:documentController.currentStateId, revision:documentController.currentRevision, info:documentController.historyInfo })'), before);
});

test('Undo and Redo exactly restore create, replace, delete, IDs, feature IDs, and coordinates', async () => {
  const { b, layerId } = await fixture();
  const initial = commitCreate(b, layerId, 'history_exact', 0.125, -8.5, 3.75, 99.125);
  const original = b.read('modelReader.snapshot().geometry.objects.history_exact');
  const replace = b.run('documentController.beginTransaction()');
  replace.replace('history_exact', b.run(recordExpr('history_exact', layerId, 100.1, 200.2, 300.3, 400.4, 'same_start_feature', 'same_end_feature')));
  replace.publish();
  const remove = b.run('documentController.beginTransaction()'); remove.remove('history_exact'); remove.publish();
  assert.equal(b.run('modelReader.snapshot().geometry.objects.history_exact'), undefined);
  assert.equal(b.run('documentController.undo()').status, 'undone');
  assert.equal(b.read('modelReader.snapshot().geometry.objects.history_exact.start.featureId'), 'same_start_feature');
  assert.equal(b.run('documentController.undo()').status, 'undone');
  assert.deepEqual(b.read('modelReader.snapshot().geometry.objects.history_exact'), original);
  assert.equal(b.run('documentController.undo()').status, 'undone');
  assert.equal(b.run('modelReader.snapshot().geometry.objects.history_exact'), undefined);
  assert.equal(b.run('documentController.redo()').status, 'redone');
  assert.equal(b.read('modelReader.snapshot().geometry.objects.history_exact.id'), 'history_exact');
  assert.equal(b.run('documentController.redo()').status, 'redone');
  assert.equal(b.read('modelReader.snapshot().geometry.objects.history_exact.end.featureId'), 'same_end_feature');
  assert.equal(b.run('documentController.redo()').status, 'redone');
  assert.equal(b.run('modelReader.snapshot().geometry.objects.history_exact'), undefined);
  assert.ok(initial.stateId);
});

test('Undo and Redo revisit existing state identities while revision continues forward', async () => {
  const { b, layerId } = await fixture();
  const initialState = b.read('documentController.currentStateId');
  const first = commitCreate(b, layerId, 'history_state_a');
  assert.equal(first.revision, 1);
  assert.equal(b.run('documentController.undo()').stateId, initialState);
  assert.equal(b.read('documentController.currentRevision'), 2);
  assert.equal(b.run('documentController.redo()').stateId, first.stateId);
  assert.equal(b.read('documentController.currentRevision'), 3);
  assert.notEqual(first.stateId, initialState);
});

test('empty Undo and Redo are deterministic no-ops with no revision change', async () => {
  const { b, layerId } = await fixture();
  const initialRevision = b.read('documentController.currentRevision');
  assert.equal(b.run('documentController.undo()').status, 'no-undo');
  assert.equal(b.read('documentController.currentRevision'), initialRevision);
  commitCreate(b, layerId, 'history_empty_redo');
  b.run('documentController.undo()');
  const revisionBeforeRedo = b.read('documentController.currentRevision');
  b.run('documentController.redo()');
  const revisionAtEnd = b.read('documentController.currentRevision');
  assert.equal(b.run('documentController.redo()').status, 'no-redo');
  assert.equal(b.read('documentController.currentRevision'), revisionAtEnd);
  assert.equal(revisionBeforeRedo + 1, revisionAtEnd);
});

test('Undo then a successful edit discards Redo and allocates a new branch state', async () => {
  const { b, layerId } = await fixture();
  commitCreate(b, layerId, 'history_branch_a');
  const oldBranch = commitCreate(b, layerId, 'history_branch_b');
  b.run('documentController.undo()');
  assert.equal(b.read('documentController.canRedo'), true);
  const branch = commitCreate(b, layerId, 'history_branch_c');
  assert.notEqual(branch.stateId, oldBranch.stateId);
  assert.equal(b.read('documentController.canRedo'), false);
  assert.equal(b.run('documentController.redo()').status, 'no-redo');
  assert.equal(b.run('modelReader.snapshot().geometry.objects.history_branch_b'), undefined);
});

test('failed, rolled-back, and no-op edits after Undo preserve the Redo branch', async () => {
  const { b, layerId } = await fixture();
  commitCreate(b, layerId, 'history_preserve_a');
  commitCreate(b, layerId, 'history_preserve_b');
  b.run('documentController.undo()');
  const rollback = b.run('documentController.beginTransaction()'); rollback.rollback();
  const noOp = b.run('documentController.beginTransaction()'); noOp.remove('not_here'); noOp.publish();
  const invalid = b.run('documentController.beginTransaction()');
  invalid.create('history_preserve_invalid', b.run(recordExpr('history_preserve_invalid', layerId, 0, 0, 1, 1)));
  invalid.read('history_preserve_invalid').end.y = Infinity; invalid.publish();
  assert.equal(b.read('documentController.canRedo'), true);
  b.run('documentController.redo()');
  assert.ok(b.run('modelReader.snapshot().geometry.objects.history_preserve_b'));
});

test('a stale transaction after Undo preserves its existing Redo branch', async () => {
  const { b, layerId } = await fixture();
  const custom = b.run(`(() => {
    const layers = { ${JSON.stringify(layerId)}: { id:${JSON.stringify(layerId)}, name:'Default', visible:true, locked:false } };
    let state = { id:'history_stale_doc', name:'Test', formatVersion:1, units:{length:'mm'}, geometry:{ objects:{} }, layers, defaultLayerId:${JSON.stringify(layerId)}, currentLayerId:${JSON.stringify(layerId)} };
    const hooks = {};
    const controller = window.DocumentController.createController({
      getDocument: () => state, assembleDocument: (base, objects) => ({ ...base, geometry:{ objects } }),
      validate: window.CaderactDocument.validateDocument, onPublish: document => { state = document; }, freeze: value => Object.freeze(value),
    }, hooks);
    return { controller, hooks };
  })()`);
  for (const id of ['history_stale_a', 'history_stale_b']) {
    const tx = custom.controller.beginTransaction();
    tx.create(id, b.run(recordExpr(id, layerId, 0, 0, 1, 1))); tx.publish();
  }
  custom.controller.undo();
  const stale = custom.controller.beginTransaction();
  stale.create('history_stale_c', b.run(recordExpr('history_stale_c', layerId, 0, 0, 1, 1)));
  const before = { state: custom.controller.currentStateId, info: custom.controller.historyInfo };
  custom.hooks.forceRevision();
  assert.equal(stale.publish().status, 'stale');
  assert.deepEqual({ state: custom.controller.currentStateId, info: custom.controller.historyInfo }, before);
  assert.equal(custom.controller.canRedo, true);
  assert.equal(custom.controller.redo().status, 'redone');
});

test('saved state tokens support an older pinned save and state-based dirty tracking', async () => {
  const { b, layerId } = await fixture();
  b.run('window.__initialSaveToken = documentController.captureStateToken()');
  assert.equal(b.run('documentController.markStateSaved(window.__initialSaveToken)').status, 'saved');
  assert.equal(b.read('documentController.isDirty'), false);
  const savedRevision = b.read('documentController.savedRevision');
  commitCreate(b, layerId, 'history_saved_a');
  b.run('window.__olderSaveToken = documentController.captureStateToken()');
  const olderRevision = b.read('window.__olderSaveToken.revision');
  commitCreate(b, layerId, 'history_saved_b');
  assert.equal(b.run('documentController.markStateSaved(window.__olderSaveToken)').status, 'saved');
  assert.equal(b.read('documentController.isDirty'), true);
  b.run('documentController.undo()');
  assert.equal(b.read('documentController.isDirty'), false);
  assert.equal(b.read('documentController.savedRevision'), olderRevision);
  assert.notEqual(b.read('documentController.currentRevision'), b.read('documentController.savedRevision'));
  b.run('documentController.redo()');
  assert.equal(b.read('documentController.isDirty'), true);
  b.run('documentController.undo()');
  assert.equal(b.read('documentController.isDirty'), false);
  b.run('window.__revisitedSaveToken = documentController.captureStateToken()');
  assert.equal(b.run('documentController.markStateSaved(window.__revisitedSaveToken)').status, 'saved');
  assert.equal(b.read('documentController.savedRevision'), b.read('window.__revisitedSaveToken.revision'));
  assert.equal(savedRevision, 0);
  assert.equal(b.run('documentController.markStateSaved({ stateId:"unknown", revision:0 })').status, 'invalid-save-state-token');
  assert.equal(b.run('documentController.markStateSaved({ stateId:window.__olderSaveToken.stateId, revision:window.__olderSaveToken.revision })').status, 'invalid-save-state-token');
  b.run('window.__foreignStore = window.CaderactDocument.createStore(); window.__foreignSaveToken = window.__foreignStore.controller.captureStateToken()');
  assert.equal(b.run('documentController.markStateSaved(window.__foreignSaveToken)').status, 'invalid-save-state-token');
});

test('history traversal is refused during an active foreground transaction without mutation', async () => {
  const { b, layerId } = await fixture();
  commitCreate(b, layerId, 'history_lease');
  const before = b.read('({ document:modelReader.snapshot(), revision:documentController.currentRevision, state:documentController.currentStateId, info:documentController.historyInfo })');
  const tx = b.run('documentController.beginTransaction()');
  assert.equal(b.run('documentController.undo()').status, 'blocked-by-active-transaction');
  assert.equal(b.run('documentController.redo()').status, 'blocked-by-active-transaction');
  assert.equal(b.read('documentController.hasOpenTransaction'), true);
  assert.deepEqual(b.read('({ document:modelReader.snapshot(), revision:documentController.currentRevision, state:documentController.currentStateId, info:documentController.historyInfo })'), before);
  tx.rollback();
});

test('history integrity failure never partially publishes or advances cursor, state, or revision', async () => {
  const { b, layerId } = await fixture();
  // This private fixture intentionally uses a shallow freeze so it can model
  // a corrupted authoritative table that normal production readers cannot make.
  const custom = b.run(`(() => {
    const layers = { ${JSON.stringify(layerId)}: { id:${JSON.stringify(layerId)}, name:'Default', visible:true, locked:false } };
    let state = { id:'history_integrity_doc', name:'Test', formatVersion:1, units:{length:'mm'}, geometry:{ objects:{} }, layers, defaultLayerId:${JSON.stringify(layerId)}, currentLayerId:${JSON.stringify(layerId)} };
    const controller = window.DocumentController.createController({
      getDocument: () => state,
      assembleDocument: (base, objects) => ({ ...base, geometry:{ objects } }),
      validate: window.CaderactDocument.validateDocument,
      onPublish: document => { state = document; },
      freeze: value => Object.freeze(value),
    });
    return { controller, snapshot: () => state };
  })()`);
  const tx = custom.controller.beginTransaction();
  tx.create('history_integrity', b.run(recordExpr('history_integrity', layerId, 0, 0, 1, 1)));
  tx.publish();
  const before = { revision: custom.controller.currentRevision, state: custom.controller.currentStateId, info: custom.controller.historyInfo };
  custom.snapshot().geometry.objects.history_integrity.start.x = 777;
  const outcome = custom.controller.undo();
  assert.equal(outcome.status, 'integrity-failed');
  assert.equal(custom.snapshot().geometry.objects.history_integrity.start.x, 777);
  assert.deepEqual({ revision: custom.controller.currentRevision, state: custom.controller.currentStateId, info: custom.controller.historyInfo }, before);
  custom.snapshot().geometry.objects.history_integrity.start.x = 0;
  assert.equal(custom.controller.undo().status, 'undone');
});
