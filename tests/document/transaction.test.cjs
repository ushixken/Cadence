'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

// Helpers construct valid Line-shaped records entirely inside the VM context
// (not passed across the realm boundary), matching the style of existing tests.
async function fixture() {
  const b = await browser();
  const layerId = b.read('modelReader.snapshot().currentLayerId');
  return { b, layerId };
}
function recordExpr(id, layerId, ax, ay, bx, by, fa, fb) {
  return `({ id: ${JSON.stringify(id)}, type: 'line', layerId: ${JSON.stringify(layerId)},
    start: { x: ${ax}, y: ${ay}, featureId: ${JSON.stringify(fa)} },
    end: { x: ${bx}, y: ${by}, featureId: ${JSON.stringify(fb)} } })`;
}

// Test-only fixture: builds a SEPARATE controller instance (its own private
// document/revision closure) with a `testHooks` sink wired up, instead of
// reaching for a bypass on the app's real `documentController`. This is the
// "test fixture that constructs a controller with testing hooks" approach —
// production's controller (built by CaderactDocument.js's createStore(), which
// never passes a testHooks argument) exposes no such thing, so stale-revision
// tests get their own throwaway document rather than a hidden backdoor into
// the shared one. Reuses the real CaderactDocument.validateDocument so
// candidate documents are validated exactly as production does.
function testableController(b, layerId) {
  return b.run(`(() => {
    const layers = { ${JSON.stringify(layerId)}: { id: ${JSON.stringify(layerId)}, name: 'Default', visible: true, locked: false } }
    let state = Object.freeze({ id: 'doc_test', name: 'Test', formatVersion: 1,
      geometry: { objects: {} }, layers, defaultLayerId: ${JSON.stringify(layerId)}, currentLayerId: ${JSON.stringify(layerId)} })
    const testHooks = {}
    const controller = window.DocumentController.createController({
      getDocument: () => state,
      assembleDocument: (base, objects) => ({ ...base, geometry: { objects } }),
      validate: window.CaderactDocument.validateDocument,
      onPublish: doc => { state = doc },
      freeze: v => Object.freeze(v),
    }, testHooks)
    return { controller, testHooks, snapshot: () => state }
  })()`);
}

// ===================== TRANSACTION CORE =====================

test('create stages a record visible only through the staged read, not yet committed', async () => {
  const { b, layerId } = await fixture();
  b.run(`window.__tx = documentController.beginTransaction()`);
  b.run(`window.__tx.create('rec_a', ${recordExpr('rec_a', layerId, 0, 0, 1, 1, 'fa1', 'fa2')})`);
  assert.equal(b.run('modelReader.snapshot().geometry.objects.rec_a'), undefined);
  assert.equal(b.read('window.__tx.read("rec_a")').id, 'rec_a');
  const outcome = b.run('window.__tx.publish()');
  assert.equal(outcome.status, 'committed');
  assert.ok(b.run('modelReader.snapshot().geometry.objects.rec_a'));
});

test('replace updates an existing committed record', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  tx1.create('rec_b', b.run(recordExpr('rec_b', layerId, 0, 0, 1, 1, 'fb1', 'fb2')));
  tx1.publish();
  const tx2 = b.run(`documentController.beginTransaction()`);
  tx2.replace('rec_b', b.run(recordExpr('rec_b', layerId, 5, 5, 9, 9, 'fb1', 'fb2')));
  const outcome = tx2.publish();
  assert.equal(outcome.status, 'committed');
  assert.equal(b.read('modelReader.snapshot().geometry.objects.rec_b.start.x'), 5);
});

test('remove deletes an existing committed record', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  tx1.create('rec_c', b.run(recordExpr('rec_c', layerId, 0, 0, 1, 1, 'fc1', 'fc2')));
  tx1.publish();
  const tx2 = b.run(`documentController.beginTransaction()`);
  tx2.remove('rec_c');
  const outcome = tx2.publish();
  assert.equal(outcome.status, 'committed');
  assert.equal(b.run('modelReader.snapshot().geometry.objects.rec_c'), undefined);
});

test('staged reads see the transaction\'s own staged state: create, replace, then read', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_d', b.run(recordExpr('rec_d', layerId, 0, 0, 1, 1, 'fd1', 'fd2')));
  tx.replace('rec_d', b.run(recordExpr('rec_d', layerId, 7, 7, 8, 8, 'fd1', 'fd2')));
  const staged = tx.read('rec_d');
  assert.equal(staged.start.x, 7);
  tx.rollback();
});

test('the authoritative before value cannot be forged by the caller', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  const original = b.run(recordExpr('rec_e', layerId, 1, 1, 2, 2, 'fe1', 'fe2'));
  tx1.create('rec_e', original);
  tx1.publish();
  const tx2 = b.run(`documentController.beginTransaction()`);
  // Caller cannot pass a "before"; the API only accepts the new record.
  // A bogus "before"-looking field on the payload is irrelevant to the real before.
  const spoofed = b.run(recordExpr('rec_e', layerId, 3, 3, 4, 4, 'fe1', 'fe2'));
  spoofed.before = { x: -999 };
  tx2.replace('rec_e', spoofed);
  const outcome = tx2.publish();
  assert.equal(outcome.changes[0].before.start.x, 1);
  assert.equal(outcome.changes[0].before.before, undefined);
});

// ===================== CREATE / REPLACE / REMOVE PRECONDITIONS =====================

test('create rejects an ID already present in committed state', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  tx1.create('rec_dup1', b.run(recordExpr('rec_dup1', layerId, 0, 0, 1, 1, 'fdu1', 'fdu2')));
  tx1.publish();
  const tx2 = b.run(`documentController.beginTransaction()`);
  assert.throws(() => tx2.create('rec_dup1', b.run(recordExpr('rec_dup1', layerId, 5, 5, 5, 5, 'fdu3', 'fdu4'))), /already exists/);
  tx2.rollback();
});

test('create rejects an ID already present in staged state', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_dup2', b.run(recordExpr('rec_dup2', layerId, 0, 0, 1, 1, 'fdu5', 'fdu6')));
  assert.throws(() => tx.create('rec_dup2', b.run(recordExpr('rec_dup2', layerId, 2, 2, 2, 2, 'fdu7', 'fdu8'))), /already exists/);
  tx.rollback();
});

test('replace rejects an ID absent from the staged view', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  assert.throws(() => tx.replace('rec_missing', b.run(recordExpr('rec_missing', layerId, 0, 0, 1, 1, 'fmi1', 'fmi2'))), /does not exist/);
  tx.rollback();
});

test('create then replace within one transaction remains valid and coalesces to null -> final', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_dup3', b.run(recordExpr('rec_dup3', layerId, 0, 0, 1, 1, 'fdu9', 'fdu10')));
  tx.replace('rec_dup3', b.run(recordExpr('rec_dup3', layerId, 4, 4, 4, 4, 'fdu9', 'fdu10')));
  const outcome = tx.publish();
  assert.equal(outcome.status, 'committed');
  assert.equal(outcome.changes[0].before, null);
  assert.equal(outcome.changes[0].after.start.x, 4);
});

test('committed replace then replace again within one transaction remains valid', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  tx1.create('rec_dup4', b.run(recordExpr('rec_dup4', layerId, 0, 0, 1, 1, 'fdu11', 'fdu12')));
  tx1.publish();
  const original = b.read('modelReader.snapshot().geometry.objects.rec_dup4');
  const tx2 = b.run(`documentController.beginTransaction()`);
  tx2.replace('rec_dup4', b.run(recordExpr('rec_dup4', layerId, 2, 2, 2, 2, 'fdu11', 'fdu12')));
  tx2.replace('rec_dup4', b.run(recordExpr('rec_dup4', layerId, 3, 3, 3, 3, 'fdu11', 'fdu12')));
  const outcome = tx2.publish();
  assert.equal(outcome.status, 'committed');
  assert.deepEqual(JSON.parse(JSON.stringify(outcome.changes[0].before)), original);
  assert.equal(outcome.changes[0].after.start.x, 3);
});

test('removing an ID absent from committed and staged state is a deterministic no-op', async () => {
  const { b } = await fixture();
  const revisionBefore = b.read('documentController.currentRevision');
  const tx = b.run(`documentController.beginTransaction()`);
  tx.remove('rec_never_existed');
  const outcome = tx.publish();
  assert.equal(outcome.status, 'no-op');
  assert.equal(outcome.changes.length, 0);
  assert.equal(b.read('documentController.currentRevision'), revisionBefore);
});

// ===================== COALESCING =====================

test('coalescing: create then replace nets to null -> final record', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_f', b.run(recordExpr('rec_f', layerId, 0, 0, 1, 1, 'ff1', 'ff2')));
  tx.replace('rec_f', b.run(recordExpr('rec_f', layerId, 9, 9, 9, 9, 'ff1', 'ff2')));
  const outcome = tx.publish();
  assert.equal(outcome.status, 'committed');
  assert.equal(outcome.changes.length, 1);
  assert.equal(outcome.changes[0].before, null);
  assert.equal(outcome.changes[0].after.start.x, 9);
});

test('coalescing: replace then replace nets to original committed -> final record', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  tx1.create('rec_g', b.run(recordExpr('rec_g', layerId, 0, 0, 1, 1, 'fg1', 'fg2')));
  tx1.publish();
  const original = b.read('modelReader.snapshot().geometry.objects.rec_g');
  const tx2 = b.run(`documentController.beginTransaction()`);
  tx2.replace('rec_g', b.run(recordExpr('rec_g', layerId, 2, 2, 2, 2, 'fg1', 'fg2')));
  tx2.replace('rec_g', b.run(recordExpr('rec_g', layerId, 3, 3, 3, 3, 'fg1', 'fg2')));
  const outcome = tx2.publish();
  assert.deepEqual(JSON.parse(JSON.stringify(outcome.changes[0].before)), original);
  assert.equal(outcome.changes[0].after.start.x, 3);
});

test('coalescing: create then remove is a no-op', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_h', b.run(recordExpr('rec_h', layerId, 0, 0, 1, 1, 'fh1', 'fh2')));
  tx.remove('rec_h');
  const outcome = tx.publish();
  assert.equal(outcome.status, 'no-op');
  assert.equal(b.read('documentController.currentRevision'), 0);
});

test('coalescing: replace then remove nets to original committed -> null', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  tx1.create('rec_i', b.run(recordExpr('rec_i', layerId, 0, 0, 1, 1, 'fi1', 'fi2')));
  tx1.publish();
  const original = b.read('modelReader.snapshot().geometry.objects.rec_i');
  const tx2 = b.run(`documentController.beginTransaction()`);
  tx2.replace('rec_i', b.run(recordExpr('rec_i', layerId, 2, 2, 2, 2, 'fi1', 'fi2')));
  tx2.remove('rec_i');
  const outcome = tx2.publish();
  assert.equal(outcome.status, 'committed');
  assert.deepEqual(JSON.parse(JSON.stringify(outcome.changes[0].before)), original);
  assert.equal(outcome.changes[0].after, null);
});

test('final state equal to original authoritative state becomes a no-op', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  tx1.create('rec_j', b.run(recordExpr('rec_j', layerId, 0, 0, 1, 1, 'fj1', 'fj2')));
  tx1.publish();
  const revisionBefore = b.read('documentController.currentRevision');
  const tx2 = b.run(`documentController.beginTransaction()`);
  tx2.replace('rec_j', b.run(recordExpr('rec_j', layerId, 0, 0, 1, 1, 'fj1', 'fj2')));
  const outcome = tx2.publish();
  assert.equal(outcome.status, 'no-op');
  assert.equal(b.read('documentController.currentRevision'), revisionBefore);
});

// ===================== SERIALIZATION =====================

test('a create change survives JSON stringify/parse with unambiguous absence', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_k', b.run(recordExpr('rec_k', layerId, 0, 0, 1, 1, 'fk1', 'fk2')));
  const outcome = tx.publish();
  const roundTripped = JSON.parse(JSON.stringify(outcome.changes[0]));
  assert.equal(roundTripped.before, null);
  assert.equal(roundTripped.after.id, 'rec_k');
});

test('a remove change survives JSON stringify/parse with unambiguous absence', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  tx1.create('rec_l', b.run(recordExpr('rec_l', layerId, 0, 0, 1, 1, 'fl1', 'fl2')));
  tx1.publish();
  const tx2 = b.run(`documentController.beginTransaction()`);
  tx2.remove('rec_l');
  const outcome = tx2.publish();
  const roundTripped = JSON.parse(JSON.stringify(outcome.changes[0]));
  assert.equal(roundTripped.after, null);
  assert.equal(roundTripped.before.id, 'rec_l');
});

test('a replace change survives JSON stringify/parse', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  tx1.create('rec_m', b.run(recordExpr('rec_m', layerId, 0, 0, 1, 1, 'fm1', 'fm2')));
  tx1.publish();
  const tx2 = b.run(`documentController.beginTransaction()`);
  tx2.replace('rec_m', b.run(recordExpr('rec_m', layerId, 4, 4, 4, 4, 'fm1', 'fm2')));
  const outcome = tx2.publish();
  const roundTripped = JSON.parse(JSON.stringify(outcome.changes[0]));
  assert.equal(roundTripped.before.start.x, 0);
  assert.equal(roundTripped.after.start.x, 4);
});

test('coalesced before/after semantics survive serialization', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_n', b.run(recordExpr('rec_n', layerId, 0, 0, 1, 1, 'fn1', 'fn2')));
  tx.replace('rec_n', b.run(recordExpr('rec_n', layerId, 6, 6, 6, 6, 'fn1', 'fn2')));
  const outcome = tx.publish();
  const roundTripped = JSON.parse(JSON.stringify(outcome.changes[0]));
  assert.equal(roundTripped.before, null);
  assert.equal(roundTripped.after.start.x, 6);
});

// ===================== ATOMICITY =====================

test('multiple records publish atomically in one transaction', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_o1', b.run(recordExpr('rec_o1', layerId, 0, 0, 1, 1, 'fo1', 'fo2')));
  tx.create('rec_o2', b.run(recordExpr('rec_o2', layerId, 1, 1, 2, 2, 'fo3', 'fo4')));
  const outcome = tx.publish();
  assert.equal(outcome.status, 'committed');
  assert.ok(b.read('modelReader.snapshot().geometry.objects.rec_o1'));
  assert.ok(b.read('modelReader.snapshot().geometry.objects.rec_o2'));
});

test('validation failure publishes nothing', async () => {
  const { b, layerId } = await fixture();
  const before = b.read('modelReader.snapshot()');
  const tx = b.run(`documentController.beginTransaction()`);
  const invalid = b.run(recordExpr('rec_p', layerId, 0, 0, 1, 1, 'fp1', 'fp2'));
  invalid.start.x = 'not-a-number';
  tx.create('rec_p', invalid);
  const outcome = tx.publish();
  assert.equal(outcome.status, 'validation-failed');
  assert.ok(outcome.errors.length > 0);
  assert.deepEqual(b.read('modelReader.snapshot()'), before);
});

test('validation failure does not increment revision', async () => {
  const { b, layerId } = await fixture();
  const revisionBefore = b.read('documentController.currentRevision');
  const tx = b.run(`documentController.beginTransaction()`);
  const invalid = b.run(recordExpr('rec_q', layerId, 0, 0, 1, 1, 'fq1', 'fq2'));
  invalid.end.y = Infinity;
  tx.create('rec_q', invalid);
  tx.publish();
  assert.equal(b.read('documentController.currentRevision'), revisionBefore);
});

// ===================== REVISION / STALE =====================

test('a successful non-no-op publish increments revision exactly once', async () => {
  const { b, layerId } = await fixture();
  const before = b.read('documentController.currentRevision');
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_r', b.run(recordExpr('rec_r', layerId, 0, 0, 1, 1, 'fr1', 'fr2')));
  tx.publish();
  assert.equal(b.read('documentController.currentRevision'), before + 1);
});

test('a no-op publish does not increment revision', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  tx1.create('rec_s', b.run(recordExpr('rec_s', layerId, 0, 0, 1, 1, 'fs1', 'fs2')));
  tx1.publish();
  const before = b.read('documentController.currentRevision');
  const tx2 = b.run(`documentController.beginTransaction()`);
  tx2.create('rec_x_noop', b.run(recordExpr('rec_x_noop', layerId, 0, 0, 1, 1, 'fx1', 'fx2')));
  tx2.remove('rec_x_noop');
  tx2.publish();
  assert.equal(b.read('documentController.currentRevision'), before);
});

test('a stale transaction cannot publish', async () => {
  const { b, layerId } = await fixture();
  const { controller, testHooks } = testableController(b, layerId);
  const tx = controller.beginTransaction(); // opens the lease
  const staleBase = tx.baseRevision;
  // Test-only mechanism (own fixture controller): bump the committed
  // state/revision without the lease, since production beginTransaction()
  // would otherwise correctly refuse a second foreground transaction while
  // `tx` is still open.
  testHooks.forcePublish({ rec_t: b.run(recordExpr('rec_t', layerId, 0, 0, 1, 1, 'ft1', 'ft2')) });
  tx.create('rec_u', b.run(recordExpr('rec_u', layerId, 2, 2, 3, 3, 'fu1', 'fu2')));
  const outcome = tx.publish();
  assert.equal(outcome.status, 'stale');
  assert.equal(outcome.baseRevision, staleBase);
  assert.equal(outcome.currentRevision, staleBase + 1);
});

test('a stale failure leaves the newer committed state untouched', async () => {
  const { b, layerId } = await fixture();
  const { controller, testHooks, snapshot } = testableController(b, layerId);
  const tx = controller.beginTransaction();
  testHooks.forcePublish({ rec_v: b.run(recordExpr('rec_v', layerId, 0, 0, 1, 1, 'fv1', 'fv2')) });
  const newerState = snapshot();
  tx.create('rec_w', b.run(recordExpr('rec_w', layerId, 9, 9, 9, 9, 'fw1', 'fw2')));
  tx.publish();
  assert.deepEqual(snapshot(), newerState);
});

test('the production document controller exposes no testing bypass', async () => {
  const { b } = await fixture();
  assert.equal(b.run('typeof documentController.testing'), 'undefined');
  assert.equal(b.run("'testing' in documentController"), false);
});

// ===================== LEASE =====================

test('the first foreground transaction acquires the lease', async () => {
  const { b } = await fixture();
  assert.equal(b.read('documentController.hasOpenTransaction'), false);
  b.run(`documentController.beginTransaction()`);
  assert.equal(b.read('documentController.hasOpenTransaction'), true);
});

test('a second normal foreground transaction is rejected while one is open', async () => {
  const { b } = await fixture();
  b.run(`documentController.beginTransaction()`);
  assert.throws(() => b.run('documentController.beginTransaction()'), /Finish or cancel the current command/);
});

test('a successful publish releases the lease', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_y', b.run(recordExpr('rec_y', layerId, 0, 0, 1, 1, 'fy1', 'fy2')));
  tx.publish();
  assert.equal(b.read('documentController.hasOpenTransaction'), false);
});

test('a no-op completion releases the lease', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_z', b.run(recordExpr('rec_z', layerId, 0, 0, 1, 1, 'fz1', 'fz2')));
  tx.remove('rec_z');
  tx.publish();
  assert.equal(b.read('documentController.hasOpenTransaction'), false);
});

test('rollback releases the lease', async () => {
  const { b } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.rollback();
  assert.equal(b.read('documentController.hasOpenTransaction'), false);
});

test('a stale terminal outcome releases the lease', async () => {
  const { b, layerId } = await fixture();
  const { controller, testHooks } = testableController(b, layerId);
  const tx = controller.beginTransaction();
  testHooks.forcePublish({ rec_aa: b.run(recordExpr('rec_aa', layerId, 0, 0, 1, 1, 'faa1', 'faa2')) });
  tx.create('rec_ab', b.run(recordExpr('rec_ab', layerId, 1, 1, 1, 1, 'fab1', 'fab2')));
  tx.publish();
  assert.equal(controller.hasOpenTransaction, false);
});

test('a validation terminal outcome releases the lease', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  const invalid = b.run(recordExpr('rec_ac', layerId, 0, 0, 1, 1, 'fac1', 'fac2'));
  invalid.start.x = NaN;
  tx.create('rec_ac', invalid);
  tx.publish();
  assert.equal(b.read('documentController.hasOpenTransaction'), false);
});

test('a closed transaction cannot release another transaction\'s lease', async () => {
  const { b, layerId } = await fixture();
  const tx1 = b.run(`documentController.beginTransaction()`);
  tx1.rollback();
  const tx2 = b.run(`documentController.beginTransaction()`);
  assert.throws(() => tx1.rollback(), /already closed/);
  assert.equal(b.read('documentController.hasOpenTransaction'), true);
  tx2.create('rec_ad', b.run(recordExpr('rec_ad', layerId, 0, 0, 1, 1, 'fad1', 'fad2')));
  const outcome = tx2.publish();
  assert.equal(outcome.status, 'committed');
});

// ===================== LIFECYCLE =====================

test('rollback before publication leaves the committed document unchanged', async () => {
  const { b, layerId } = await fixture();
  const before = b.read('modelReader.snapshot()');
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_ae', b.run(recordExpr('rec_ae', layerId, 0, 0, 1, 1, 'fae1', 'fae2')));
  tx.rollback();
  assert.deepEqual(b.read('modelReader.snapshot()'), before);
});

test('rollback leaves the revision unchanged', async () => {
  const { b, layerId } = await fixture();
  const before = b.read('documentController.currentRevision');
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_af', b.run(recordExpr('rec_af', layerId, 0, 0, 1, 1, 'faf1', 'faf2')));
  tx.rollback();
  assert.equal(b.read('documentController.currentRevision'), before);
});

test('a closed transaction cannot mutate', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.rollback();
  assert.throws(() => tx.create('rec_ag', b.run(recordExpr('rec_ag', layerId, 0, 0, 1, 1, 'fag1', 'fag2'))), /already closed/);
});

test('a closed transaction cannot publish', async () => {
  const { b, layerId } = await fixture();
  const tx = b.run(`documentController.beginTransaction()`);
  tx.create('rec_ah', b.run(recordExpr('rec_ah', layerId, 0, 0, 1, 1, 'fah1', 'fah2')));
  tx.publish();
  assert.throws(() => tx.publish(), /already closed/);
});
