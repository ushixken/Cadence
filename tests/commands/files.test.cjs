const test = require('node:test');
const assert = require('node:assert/strict');
const { browser, settle, Element } = require('../helpers/browser.cjs');

async function fixture() {
  const b = await browser();
  b.run(`window.__writes=[]; window.__picked=null; window.__confirm=true; window.__writeGate=null;
    window.__fileAdapters={confirmDiscard:async()=>window.__confirm,pickOpenFile:async()=>window.__picked,
      writeFile:async value=>{window.__writes.push(value);if(window.__writeGate)await window.__writeGate.promise}};
    window.__files=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,
      commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:window.__fileAdapters})`);
  return b;
}
function line(b) { b.launch(); b.point(10,10); b.point(40,40); b.key('Enter'); b.flush(); }

test('Save captures authoritative state and acknowledges only the captured state', async () => {
  const b=await fixture(); line(b);
  const saved=await b.run('window.__files.save()');
  assert.equal(saved.status,'save-completed'); assert.equal(saved.filename,'Untitled.caderact');
  assert.equal(b.read('JSON.parse(window.__writes[0].serialized).document.records.length'),1);
  assert.equal(b.read('window.caderactDocumentSession.controller.isDirty'),false);
});

test('edit during async Save remains dirty and failed Save is not acknowledged', async () => {
  const b=await fixture(); line(b);
  b.run('window.__writeGate={};window.__writeGate.promise=new Promise(r=>window.__writeGate.resolve=r);window.__saving=window.__files.save()');
  await settle(); line(b); b.run('window.__writeGate.resolve()');
  assert.equal((await b.run('window.__saving')).status,'save-completed');
  assert.equal(b.read('window.caderactDocumentSession.controller.isDirty'),true);
  b.run(`window.__badAdapters={...window.__fileAdapters,writeFile:async()=>{throw new Error('write failed')}};
    window.__badFiles=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,
    commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:window.__badAdapters})`);
  assert.equal((await b.run('window.__badFiles.save()')).status,'save-failed');
  assert.equal(b.read('window.caderactDocumentSession.controller.isDirty'),true);
});

test('Save excludes active Line drafts and previews', async () => {
  const b=await fixture(); b.launch(); b.point(10,10); b.point(30,30); b.point(50,50,'pointermove');
  await b.run('window.__files.save()');
  assert.equal(b.read('JSON.parse(window.__writes[0].serialized).document.records.length'),0);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'),1);
});

test('valid Open atomically replaces with a clean empty-history store and rebinds consumers', async () => {
  const b=await fixture(); line(b); await b.run('window.__files.save()');
  b.run(`window.__source=window.__writes[0].serialized;window.__picked={name:'Loaded.caderact',text:async()=>window.__source}`);
  const sourceId=b.read('window.caderactDocumentSession.reader.snapshot().id');
  await b.run('window.__files.newProject()');
  assert.equal((await b.run('window.__files.open()')).status,'open-completed'); b.flush();
  assert.equal(b.read('window.caderactDocumentSession.reader.snapshot().id'),sourceId);
  assert.equal(b.read('window.caderactDocumentSession.reader.records().length'),1);
  assert.equal(b.read('window.caderactDocumentSession.controller.isDirty'),false);
  assert.deepEqual(b.read('window.caderactDocumentSession.controller.historyInfo'),{entryCount:0,cursor:0});
  assert.equal(b.undoButton.disabled,true); assert.equal(b.redoButton.disabled,true);
  assert.equal(b.renders.at(-1).lineGroups[4].segments.length,4);
});

test('invalid Open and cancelled dirty replacement preserve the current project', async () => {
  const b=await fixture(); line(b);
  const before=b.run('window.CaderactPersistence.serializeDocument(window.caderactDocumentSession.reader.snapshot())');
  b.run('window.__confirm=false');
  assert.equal((await b.run('window.__files.newProject()')).status,'new-cancelled');
  assert.equal((await b.run('window.__files.open()')).status,'open-cancelled');
  b.run(`window.__confirm=true;window.__picked={name:'Bad.caderact',text:async()=>'not json'}`);
  assert.equal((await b.run('window.__files.open()')).status,'open-failed');
  b.run(`window.__picked={name:'Future.caderact',text:async()=>'{"fileVersion":99,"document":{}}'}`);
  assert.equal((await b.run('window.__files.open()')).status,'open-failed');
  assert.equal(b.run('window.CaderactPersistence.serializeDocument(window.caderactDocumentSession.reader.snapshot())'),before);
});

test('New creates a fresh canonical clean document', async () => {
  const b=await fixture(); const oldId=b.read('window.caderactDocumentSession.reader.snapshot().id');
  b.run('camera.zoom=12;camera.panX=123;camera.panY=456');
  const outcome=await b.run('window.__files.newProject()'); b.flush();
  assert.equal(outcome.status,'new-completed'); assert.notEqual(b.read('window.caderactDocumentSession.reader.snapshot().id'),oldId);
  assert.equal(b.read('window.caderactDocumentSession.reader.snapshot().name'),'Untitled');
  assert.equal(b.read('window.caderactDocumentSession.reader.records().length'),0);
  assert.equal(b.read('window.caderactDocumentSession.reader.layers().length'),1);
  assert.equal(b.read('window.caderactDocumentSession.reader.units().length'),'mm');
  assert.equal(b.read('window.caderactDocumentSession.controller.isDirty'),false);
  assert.deepEqual(b.read('({zoom:camera.zoom,panX:camera.panX,panY:camera.panY})'),{zoom:5,panX:400,panY:300});
});

test('New/Open are blocked during active commands', async () => {
  const b=await fixture(); b.launch();
  assert.equal((await b.run('window.__files.newProject()')).status,'new-blocked-active-command');
  assert.equal((await b.run('window.__files.open()')).status,'open-blocked-active-command');
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Line');
});

test('file shortcuts route once and ignore editable controls', async () => {
  const b=await fixture();
  for(const [key,status] of [['s','save-failed'],['o','open-failed'],['n','new-failed']]) {
    assert.equal(b.key(key,b.canvas,{ctrlKey:true}).defaultPrevented,true); await settle();
    assert.equal(b.read('window.caderactFiles.lastResult.status'),status);
  }
  const textarea=new Element('textarea'); textarea.parent=b.document; textarea.owner=b.document;
  assert.equal(b.key('s',textarea,{ctrlKey:true}).defaultPrevented,false);
});

test('File menu opens only by click and closes deterministically', async () => {
  const b=await fixture();
  assert.equal(b.fileMenuDropdown.hidden,true);
  b.emit(b.fileMenu,'pointerenter'); assert.equal(b.fileMenuDropdown.hidden,true);
  b.emit(b.fileMenuTrigger,'click');
  assert.equal(b.fileMenuDropdown.hidden,false); assert.equal(b.fileMenuTrigger.getAttribute('aria-expanded'),'true');
  b.emit(b.fileMenu,'pointerleave'); assert.equal(b.fileMenuDropdown.hidden,false);
  b.emit(b.fileMenuTrigger,'click'); assert.equal(b.fileMenuDropdown.hidden,true);
  b.emit(b.fileMenuTrigger,'click'); b.emit(b.canvas,'click'); assert.equal(b.fileMenuDropdown.hidden,true);
  b.emit(b.fileMenuTrigger,'click'); const escape=b.key('Escape');
  assert.equal(escape.defaultPrevented,true); assert.equal(b.fileMenuDropdown.hidden,true);
  b.emit(b.fileMenuTrigger,'click'); b.emit(b.editMenuTrigger,'click'); assert.equal(b.fileMenuDropdown.hidden,true);
});

test('File action clicks close the menu and retain U3 routing', async () => {
  const b=await fixture();
  for (const [button,status] of [[b.fileNewButton,'new-failed'],[b.fileOpenButton,'open-failed'],[b.fileSaveButton,'save-failed']]) {
    b.emit(b.fileMenuTrigger,'click'); b.emit(button,'click'); await settle();
    assert.equal(b.fileMenuDropdown.hidden,true); assert.equal(b.read('window.caderactFiles.lastResult.status'),status);
  }
});
