'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

function seed(b, count = 3) {
  b.run(`window.__groupRecords=Array.from({length:${count}},(_,i)=>recordGateway.createLine({x:i,y:0},{x:i,y:1}));recordGateway.createAll(window.__groupRecords)`);
  return b.read('window.__groupRecords');
}

test('GB1 creates document-owned groups without changing member records', async () => {
  const b = await browser(), records = seed(b), before = b.read('window.__groupRecords');
  b.run('window.__createdGroup=window.caderactDocumentSession.groupGateway.createGroup([window.__groupRecords[2].id,window.__groupRecords[0].id])');
  const result = b.read('window.__createdGroup');
  assert.equal(result.status, 'committed');
  assert.equal(result.group.name, 'Group 1');
  assert.deepEqual(result.group.memberIds, [records[0].id, records[2].id].sort());
  assert.deepEqual(b.read('modelReader.records()'), [...before].sort((a, c) => a.id.localeCompare(c.id)));
  assert.deepEqual(b.read('modelReader.groups()'), [result.group]);
  assert.deepEqual(b.read(`modelReader.group(${JSON.stringify(result.group.id)})`), result.group);
  assert.equal(b.read(`modelReader.groupForRecord(${JSON.stringify(records[1].id)})`), null);
  assert.equal(b.read(`modelReader.groupForRecord(${JSON.stringify(records[0].id)}).id`), result.group.id);
  assert.deepEqual(b.read('window.CaderactDocument.validateDocument(modelReader.snapshot())'), []);
});

test('GB1 rejects invalid membership and names without publication', async () => {
  const b = await browser(), records = seed(b, 4);
  b.run('window.__gateway=window.caderactDocumentSession.groupGateway');
  const before = b.read('({revision:documentController.currentRevision,history:documentController.historyInfo})');
  assert.equal(b.read(`window.__gateway.createGroup([${JSON.stringify(records[0].id)}]).status`), 'insufficient-members');
  assert.equal(b.read(`window.__gateway.createGroup([${JSON.stringify(records[0].id)},${JSON.stringify(records[0].id)}]).status`), 'duplicate-member');
  assert.equal(b.read(`window.__gateway.createGroup([${JSON.stringify(records[0].id)},'missing']).status`), 'missing-member');
  assert.equal(b.read(`window.__gateway.createGroup([${JSON.stringify(records[0].id)},${JSON.stringify(records[1].id)}],{name:' bad '}).status`), 'invalid-name');
  assert.equal(b.read(`window.__gateway.createGroup(Array(10001).fill(${JSON.stringify(records[0].id)})).status`), 'member-limit');
  assert.ok(b.read(`(()=>{const document={...modelReader.snapshot(),groups:Object.fromEntries(Array.from({length:10001},(_,i)=>['group-limit-'+i,{id:'group-limit-'+i,name:'Limit '+i,memberIds:[]}]))};return window.CaderactDocument.validateDocument(document).some(error=>error.includes('group limit'))})()`));
  b.run(`window.__gateway.createGroup([${JSON.stringify(records[0].id)},${JSON.stringify(records[1].id)}],{name:'Assembly'})`);
  assert.equal(b.read(`window.__gateway.createGroup([${JSON.stringify(records[2].id)},${JSON.stringify(records[3].id)}],{name:'assembly'}).status`), 'duplicate-name');
  assert.equal(b.read(`window.__gateway.createGroup([${JSON.stringify(records[0].id)},${JSON.stringify(records[2].id)}]).status`), 'already-grouped');
  assert.deepEqual(b.read('({revision:documentController.currentRevision-1,history:{entryCount:documentController.historyInfo.entryCount-1,cursor:documentController.historyInfo.cursor-1}})'), before);
});

test('GB1 create and ungroup are atomic and Undo/Redo restore exact identities', async () => {
  const b = await browser(), records = seed(b);
  b.run(`window.__g=window.caderactDocumentSession.groupGateway.createGroup([${JSON.stringify(records[0].id)},${JSON.stringify(records[1].id)}]).group`);
  const group = b.read('window.__g');
  assert.equal(b.read('documentController.undo().status'), 'undone');
  assert.equal(b.read('modelReader.groups().length'), 0);
  assert.equal(b.read('documentController.redo().status'), 'redone');
  assert.deepEqual(b.read('modelReader.groups()[0]'), group);
  assert.equal(b.read('window.caderactDocumentSession.groupGateway.ungroup(window.__g.id).status'), 'committed');
  assert.equal(b.read('modelReader.groups().length'), 0);
  assert.equal(b.read('documentController.undo().status'), 'undone');
  assert.deepEqual(b.read('modelReader.groups()[0]'), group);
  assert.equal(b.read('documentController.redo().status'), 'redone');
  assert.equal(b.read('modelReader.groups().length'), 0);
});

test('GB1 default names are deterministic, non-reused, and custom numbered names advance the sequence', async () => {
  const b = await browser(), records = seed(b, 6);
  b.run(`window.__gw=window.caderactDocumentSession.groupGateway;window.__a=window.__gw.createGroup([window.__groupRecords[0].id,window.__groupRecords[1].id]).group;window.__gw.ungroup(window.__a.id);window.__b=window.__gw.createGroup([window.__groupRecords[2].id,window.__groupRecords[3].id]).group;window.__c=window.__gw.createGroup([window.__groupRecords[4].id,window.__groupRecords[5].id],{name:'Group 20'}).group`);
  assert.deepEqual(b.read('[window.__a.name,window.__b.name,window.__c.name,modelReader.snapshot().nextGroupNumber]'), ['Group 1', 'Group 2', 'Group 20', 21]);
  assert.equal(new Set(b.read('[window.__a.id,window.__b.id,window.__c.id]')).size, 3);
  assert.ok(records.length);
});

test('GB1 deletion cleanup updates or dissolves groups in the same history entry', async () => {
  const b = await browser(), records = seed(b);
  b.run('window.__g=window.caderactDocumentSession.groupGateway.createGroup(window.__groupRecords.map(r=>r.id)).group');
  const group = b.read('window.__g'), before = b.read('documentController.historyInfo.entryCount');
  assert.equal(b.read(`recordGateway.removeAll([${JSON.stringify(records[0].id)}]).status`), 'committed');
  assert.equal(b.read('documentController.historyInfo.entryCount'), before + 1);
  assert.deepEqual(b.read('modelReader.groups()[0].memberIds'), group.memberIds.filter(id => id !== records[0].id));
  assert.equal(b.read(`recordGateway.removeAll([${JSON.stringify(records[1].id)}]).status`), 'committed');
  assert.equal(b.read('modelReader.groups().length'), 0);
  assert.equal(b.read('documentController.undo().status'), 'undone');
  assert.deepEqual(b.read('modelReader.groups()[0].memberIds'), group.memberIds.filter(id => id !== records[0].id));
  assert.ok(b.read(`modelReader.groupForRecord(${JSON.stringify(records[1].id)})`));
});

test('ordinary Copy creates an ungrouped record', async () => {
  const b = await browser(), records = seed(b);
  b.run('window.__g=window.caderactDocumentSession.groupGateway.createGroup([window.__groupRecords[0].id,window.__groupRecords[1].id]).group;window.__copy=recordGateway.copyWithFreshIdentity(window.__groupRecords[0]);recordGateway.createAll([window.__copy])');
  assert.equal(b.read('modelReader.groupForRecord(window.__copy.id)'), null);
  assert.equal(b.read('modelReader.groupForRecord(window.__groupRecords[0].id).id'), b.read('window.__g.id'));
});

test('GB1 persistence round-trips deterministically and old v3 files default to no groups', async () => {
  const b = await browser(), records = seed(b);
  b.run(`window.caderactDocumentSession.groupGateway.createGroup([${JSON.stringify(records[0].id)},${JSON.stringify(records[1].id)}]);window.__serialized=window.CaderactPersistence.serializeDocument(modelReader.snapshot());window.__loaded=window.CaderactPersistence.loadStore(window.__serialized)`);
  assert.deepEqual(b.read('window.__loaded.reader.groups()'), b.read('modelReader.groups()'));
  assert.equal(b.read('window.CaderactPersistence.serializeDocument(window.__loaded.reader.snapshot())'), b.read('window.__serialized'));
  b.run('window.__legacy=JSON.parse(window.__serialized);delete window.__legacy.document.groups;delete window.__legacy.document.nextGroupNumber;window.__old=window.CaderactPersistence.loadStore(JSON.stringify(window.__legacy))');
  assert.deepEqual(b.read('window.__old.reader.groups()'), []);
  assert.equal(b.read('window.__old.reader.snapshot().nextGroupNumber'), 1);
});

test('GB1 malformed persisted group graphs are rejected', async () => {
  const b = await browser(), records = seed(b);
  b.run(`window.caderactDocumentSession.groupGateway.createGroup([${JSON.stringify(records[0].id)},${JSON.stringify(records[1].id)}]);window.__payload=JSON.parse(window.CaderactPersistence.serializeDocument(modelReader.snapshot()))`);
  const mutations = [
    'p.document.groups[0].memberIds=[p.document.records[0].id]',
    'p.document.groups[0].memberIds.push(p.document.groups[0].memberIds[0])',
    "p.document.groups[0].memberIds[0]='missing'",
    'p.document.groups[0].id=p.document.records[0].id',
    "p.document.groups[0].name=' bad '",
    'p.document.groups[0].extra=true',
    'p.document.groups.push({...p.document.groups[0]})',
  ];
  for (const mutation of mutations) {
    b.run(`window.__bad=JSON.parse(JSON.stringify(window.__payload));(()=>{const p=window.__bad;${mutation}})()`);
    assert.throws(() => b.run('window.CaderactPersistence.loadStore(JSON.stringify(window.__bad))'), /Invalid Caderact file/);
  }
});
