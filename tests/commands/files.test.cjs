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
  const b=await fixture(); line(b);
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
  const b=await fixture(); line(b);
  for (const [button,status] of [[b.fileNewButton,'new-failed'],[b.fileOpenButton,'open-failed'],[b.fileSaveButton,'save-failed']]) {
    b.emit(b.fileMenuTrigger,'click'); b.emit(button,'click'); await settle();
    assert.equal(b.fileMenuDropdown.hidden,true); assert.equal(b.read('window.caderactFiles.lastResult.status'),status);
  }
});

test('FS1 browser-download initiation remains dirty and does not claim durable filename metadata',async()=>{const b=await browser();line(b);b.run(`window.__actions=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:{confirmDiscard:async()=>true,pickSaveFile:async()=>({status:'unsupported'}),writeFile:async()=>({status:'initiated'})}});window.__before=window.__actions.fileState.value`);const outcome=await b.run('window.__actions.save()');assert.equal(outcome.status,'save-initiated');assert.equal(outcome.durability,'initiated');assert.equal(b.read('documentController.isDirty'),true);assert.equal(b.read('window.__actions.filename'),'Untitled.caderact');assert.equal(b.read('window.__actions.fileState.value.lastOutputDurability'),'initiated');assert.equal(b.read('window.__actions.fileState.value.lastSuccessfulSave'),null)});

test('FS1 durable Save As updates handle filename fingerprint and only the captured save point',async()=>{const b=await browser();line(b);b.run(`window.__handle={name:'Durable.caderact'};window.__gate={};window.__gate.promise=new Promise(resolve=>window.__gate.resolve=resolve);window.__actions=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:{confirmDiscard:async()=>true,pickSaveFile:async()=>({status:'selected',handle:window.__handle,filename:window.__handle.name}),writeFile:async value=>{window.__written=value;await window.__gate.promise;return{status:'committed'}}}});window.__saving=window.__actions.saveAs()`);await settle();line(b);b.run('window.__gate.resolve()');const outcome=await b.run('window.__saving');assert.equal(outcome.status,'save-as-completed');assert.equal(outcome.durability,'committed');assert.match(outcome.fingerprint,/^[0-9a-f]{64}$/);assert.equal(b.read('window.__actions.filename'),'Durable.caderact');assert.equal(b.run('window.__actions.fileState.value.fileHandle===window.__handle'),true);assert.equal(b.read('window.__actions.fileState.value.lastManualSaveFingerprint'),outcome.fingerprint);assert.equal(b.read('documentController.isDirty'),true);assert.notEqual(b.read('documentController.currentStateId'),outcome.stateId);assert.equal(b.read('window.__written.serialized'),outcome.serialized)});

test('FS1 Save As cancel and write failure preserve destination metadata and dirty state',async()=>{for(const mode of ['cancel','failure']){const b=await browser();line(b);b.run(`window.__old=window.CaderactDocumentFileState.create();window.__actions=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,fileState:window.__old,adapters:{confirmDiscard:async()=>true,pickSaveFile:async()=>${mode==='cancel'?`({status:'cancelled'})`:`({status:'selected',handle:{name:'Failed.caderact'},filename:'Failed.caderact'})`},writeFile:async()=>{throw new Error('disk full')}}})`);const before=b.read('window.__actions.fileState.value'),outcome=await b.run('window.__actions.saveAs()');assert.equal(outcome.status,mode==='cancel'?'save-as-cancelled':'save-as-failed');assert.equal(b.read('window.__actions.filename'),before.filename);assert.equal(b.run('window.__actions.fileState.value.fileHandle===null'),true);assert.equal(b.read('window.__actions.fileState.value.lastManualSaveFingerprint'),null);assert.equal(b.read('documentController.isDirty'),true)}});

test('FS1 fingerprints exact canonical payloads deterministically',async()=>{const b=await browser();assert.equal(await b.run('window.CaderactDocumentFileState.fingerprint("abc")'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');const serialized=b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())');b.window.__serialized=serialized;assert.equal(await b.run('window.CaderactDocumentFileState.fingerprint(window.__serialized)'),await b.run('window.CaderactDocumentFileState.fingerprint(window.CaderactPersistence.serializeDocument(modelReader.snapshot()))'))});

test('FS1 Open changes file metadata only after validated replacement',async()=>{const b=await fixture();line(b);await b.run('window.__files.save()');b.run(`window.__valid=window.__writes[0].serialized;window.__picked={name:'Opened.caderact',text:async()=>window.__valid}`);assert.equal((await b.run('window.__files.open()')).status,'open-completed');const opened=b.read('window.__files.fileState.value');assert.equal(opened.filename,'Opened.caderact');assert.equal(opened.sourceKind,'native');assert.match(opened.lastManualSaveFingerprint,/^[0-9a-f]{64}$/);b.run(`window.__picked={name:'Broken.caderact',text:async()=>'bad'}`);const before=b.read('window.__files.fileState.value');assert.equal((await b.run('window.__files.open()')).status,'open-failed');assert.deepEqual(b.read('window.__files.fileState.value'),before)});

test('FS1 successful DXF replacement is intentionally dirty native state with centralized metadata',async()=>{const b=await browser();b.window.__dxf=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1018','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES','0','LINE','8','0','10','0','20','0','11','1','21','1','0','ENDSEC','0','EOF'].join('\n')+'\n';b.run(`window.__actions=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:{confirmDiscard:async()=>true,pickDxfFile:async()=>({name:'Imported.dxf',text:async()=>window.__dxf}),writeFile:async()=>({status:'committed'})}})`);const outcome=await b.run('window.__actions.openDxf()');assert.equal(outcome.status,'dxf-open-completed');assert.equal(b.read('documentController.isDirty'),true);assert.deepEqual(b.read('documentController.historyInfo'),{entryCount:0,cursor:0});assert.equal(b.read('window.__actions.fileState.value.sourceKind'),'dxf-import');assert.equal(b.read('window.__actions.filename'),'Imported.caderact');assert.equal(b.read('window.__actions.fileState.value.lastManualSaveFingerprint'),null)});
