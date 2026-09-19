'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { browser } = require('../helpers/browser.cjs');

function dxf({ units = 4, acad = 'AC1027', entities = [], extraSections = [] } = {}) {
  const lines = ['0','SECTION','2','HEADER','9','$ACADVER','1',acad,'9','$INSUNITS','70',String(units),'0','ENDSEC',
    ...extraSections.flat(), '0','SECTION','2','ENTITIES', ...entities.flat(), '0','ENDSEC','0','EOF'];
  return lines.join('\n') + '\n';
}
function line(values = {}) {
  return ['0','LINE','5',values.handle || 'A1','8',values.layer || '0',
    '10',String(values.x1 ?? 1),'20',String(values.y1 ?? 2),'30',String(values.z1 ?? 0),
    '11',String(values.x2 ?? 3),'21',String(values.y2 ?? 4),'31',String(values.z2 ?? 0),
    ...(values.extrusion || [])];
}
function parse(b, text, options) {
  b.window.__dxf = text; b.window.__dxfOptions = options || {};
  return b.read('window.CaderactDxfParser.parse(window.__dxf,window.__dxfOptions)');
}
function imported(b, text, options) {
  b.window.__dxf = text; b.window.__dxfOptions = options || {};
  b.run('window.__dxfImport=window.CaderactDxfImport.createStore(window.__dxf,window.__dxfOptions)');
  return b.read('({count:window.__dxfImport.importedCount,unit:window.__dxfImport.unit,diagnostics:window.__dxfImport.diagnostics,document:window.__dxfImport.store.reader.snapshot(),dirty:window.__dxfImport.store.controller.isDirty,history:window.__dxfImport.store.controller.historyInfo})');
}

test('DXF1 parses HEADER metadata and imports planar LINE records through a neutral representation', async () => {
  const b = await browser();
  const source = dxf({ units: 1, acad: 'AC1015', entities: [line(), line({ handle:'A2', x1:-5, y1:6, x2:7.5, y2:-8 })] });
  const parsed = parse(b, source);
  assert.equal(parsed.kind, 'ParsedDxf');
  assert.deepEqual(parsed.source, { acadVersion:'AC1015', insertionUnits:1 });
  assert.equal(parsed.entities.length, 2);
  const result = imported(b, source);
  assert.equal(result.count, 2); assert.equal(result.unit, 'in');
  assert.deepEqual(Object.values(result.document.geometry.objects).map(record => [record.start.x,record.start.y,record.end.x,record.end.y]).sort(), [[-5,6,7.5,-8],[1,2,3,4]]);
  assert.ok(Object.values(result.document.geometry.objects).every(record => record.type === 'line'));
});

test('supported INSUNITS preserve coordinates 1:1 and unknown physical scale is never guessed', async () => {
  for (const [code, unit] of [[1,'in'],[2,'ft'],[4,'mm'],[5,'cm'],[6,'m']]) {
    const b=await browser(); const result=imported(b,dxf({units:code,entities:[line({x1:12.5,x2:99})]}));
    assert.equal(result.unit,unit); assert.equal(Object.values(result.document.geometry.objects)[0].start.x,12.5);
  }
  for (const units of [0,3,21]) {
    const b=await browser(); b.window.__dxf=dxf({units,entities:[line()]});
    assert.throws(()=>b.run('window.CaderactDxfImport.createStore(window.__dxf)'),/requires a supported|does not support/);
  }
  const missing=await browser();missing.window.__dxf=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1027','0','ENDSEC','0','SECTION','2','ENTITIES',...line(),'0','ENDSEC','0','EOF'].join('\n');
  assert.throws(()=>missing.run('window.CaderactDxfImport.createStore(window.__dxf)'),/requires a supported/);
});

test('import allocates fresh native record and feature identities with valid Layer 0 and dimension defaults', async () => {
  const b=await browser(); const source=dxf({entities:[line()]});
  b.window.__dxf=source;b.run('window.__a=window.CaderactDxfImport.createStore(window.__dxf);window.__b=window.CaderactDxfImport.createStore(window.__dxf)');
  const state=b.read(`(()=>{const a=window.__a.store.reader.snapshot(),b=window.__b.store.reader.snapshot(),ra=Object.values(a.geometry.objects)[0],rb=Object.values(b.geometry.objects)[0];return{a,b,ids:[ra.id,ra.start.featureId,ra.end.featureId,rb.id,rb.start.featureId,rb.end.featureId],errors:window.CaderactDocument.validateDocument(a)}})()`);
  assert.equal(new Set(state.ids).size,6); assert.deepEqual(state.errors,[]);
  assert.equal(Object.values(state.a.layers).length,1); assert.equal(Object.values(state.a.layers)[0].name,'0');
  assert.equal(state.a.defaultLayerId,state.a.currentLayerId);
  assert.equal(Object.keys(state.a.dimensionStyles).length,1); assert.ok(state.a.dimensionStyles[state.a.currentDimensionStyleId]);
});

test('unsupported content is structurally skipped with capped and aggregated diagnostics', async () => {
  const b=await browser();
  const source=dxf({entities:[['0','CIRCLE','5','C1','10','0','20','0','40','2'],['0','CIRCLE','5','C2','10','1','20','1','40','3'],line()],extraSections:[['0','SECTION','2','OBJECTS','0','DICTIONARY','5','D1','0','ENDSEC']]});
  const parsed=parse(b,source);
  const entityWarning=parsed.diagnostics.find(value=>value.code==='DXF_UNSUPPORTED_ENTITY');
  assert.equal(entityWarning.count,2); assert.ok(parsed.diagnostics.some(value=>value.code==='DXF_UNSUPPORTED_SECTION'));
  assert.equal(parsed.entities.length,1);
  const capped=parse(b,dxf({entities:[['0','CIRCLE'],['0','ARC'],['0','SPLINE']]}),{limits:{maxDiagnostics:1}});
  assert.ok(capped.diagnostics.some(value=>value.code==='DXF_DIAGNOSTIC_LIMIT'));
});

test('binary, malformed pairs, invalid numbers, malformed LINE, and structural corruption reject', async () => {
  for (const [source, pattern] of [
    ['AutoCAD Binary DXF\r\n\u001a\u0000',/Binary DXF/],
    ['0\nSECTION\n2',/incomplete group-code pair/],
    [dxf({entities:[line({x1:'NaN'})]}),/finite number/],
    [dxf({entities:[['0','LINE','10','1','20','2','11','3']]}),/exactly one end Y/],
    [['0','SECTION','2','ENTITIES',...line(),'0','EOF'].join('\n'),/not terminated/],
  ]) { const b=await browser();b.window.__dxf=source;assert.throws(()=>b.run('window.CaderactDxfParser.parse(window.__dxf)'),pattern); }
});

test('nonzero Z and non-default extrusion LINE are skipped rather than flattened', async () => {
  const b=await browser();
  const result=imported(b,dxf({entities:[line({z1:1}),line({handle:'A2',extrusion:['210','1','220','0','230','1']}),line({handle:'A3'})]}));
  assert.equal(result.count,1);
  assert.equal(result.diagnostics.find(value=>value.code==='DXF_LINE_NON_PLANAR').count,2);
});

test('parser resource limits reject before publication and empty/no-supported ENTITIES remain valid imports', async () => {
  for (const [limits, pattern] of [[{maxTextLength:8},/size limit/],[{maxGroupPairs:2},/group-pair limit/],[{maxStringLength:2},/string limit/],[{maxEntities:1},/entity limit/]]) {
    const b=await browser();b.window.__dxf=dxf({entities:[line(),line({handle:'A2'})]});b.window.__limits=limits;
    assert.throws(()=>b.run('window.CaderactDxfParser.parse(window.__dxf,{limits:window.__limits})'),pattern);
  }
  const empty=await browser();assert.equal(imported(empty,dxf()).count,0);
  const unsupported=await browser();assert.equal(imported(unsupported,dxf({entities:[['0','CIRCLE','10','0','20','0','40','2']]})).count,0);
});

test('Open DXF replaces once through the normal lifecycle, stays dirty, and failed import is atomic', async () => {
  const b=await browser();
  b.run(`recordGateway.createAll([recordGateway.createLine({x:20,y:20},{x:30,y:30})]);window.__before=window.CaderactPersistence.serializeDocument(modelReader.snapshot());
    window.__pickedDxf={name:'plan.dxf',text:async()=>window.__dxf};window.__adapters={confirmDiscard:async()=>true,pickDxfFile:async()=>window.__pickedDxf,writeFile:async()=>{}};
    window.__files=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:window.__adapters})`);
  b.window.__dxf='bad'; const failed=await b.run('window.__files.openDxf()');
  assert.equal(failed.status,'dxf-open-failed'); assert.equal(b.run('window.CaderactPersistence.serializeDocument(modelReader.snapshot())'),b.run('window.__before'));
  b.window.__dxf=dxf({units:5,entities:[line()]});b.run('camera.zoom=12;window.caderactSelection.selectOnly(modelReader.records()[0].id)');
  const opened=await b.run('window.__files.openDxf()');b.flush();
  assert.equal(opened.status,'dxf-open-completed');assert.equal(opened.filename,'plan.caderact');assert.equal(opened.importedCount,1);
  assert.equal(b.read('modelReader.units().length'),'cm');assert.equal(b.read('documentController.isDirty'),true);
  assert.deepEqual(b.read('documentController.historyInfo'),{entryCount:0,cursor:0});assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);
  assert.equal(b.read('camera.zoom'),5);
});

test('Import File UI routes DXF while native persistence and both renderer sources remain DXF-free', async () => {
  const b=await browser();
  assert.equal(b.fileImportDxfButton.listeners.click.length,1);
  const root=path.join(__dirname,'../..');
  for(const file of ['src/js/rendering/Canvas2DRenderer.js','src/js/rendering/WebGPURenderer.js']) assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/dxf/i);
  assert.equal(b.read('window.CaderactPersistence.FILE_VERSION'),3);
});
