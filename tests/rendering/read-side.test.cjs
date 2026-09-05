'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

test('finished Line rendering follows A4 Undo and Redo through the document read-side', async () => {
  const b = await browser(); b.launch();
  b.point(400, 300); b.point(450, 300); b.point(450, 250); b.key('Enter'); b.flush();
  const committed = Array.from(b.renders.at(-1).lineGroups[4].segments);
  assert.deepEqual(committed, [400, 300, 450, 300, 450, 300, 450, 250]);
  assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);

  b.run('documentController.undo(); requestRender()'); b.flush();
  assert.equal(b.renders.at(-1).lineGroups[4].segments.length, 0);
  b.run('documentController.redo(); requestRender()'); b.flush();
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[4].segments), committed);
});

test('external document create and remove operations drive persistent rendering without viewport writes', async () => {
  const b = await browser();
  b.run(`window.__externalRecord = recordGateway.createLine({x:-10,y:5},{x:20,y:-15});
    recordGateway.createAll([window.__externalRecord]); requestRender()`); b.flush();
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[4].segments), [350, 275, 500, 375]);

  b.run(`window.__externalRemove = documentController.beginTransaction();
    window.__externalRemove.remove(window.__externalRecord.id); window.__externalRemove.publish(); requestRender()`); b.flush();
  assert.equal(b.renders.at(-1).lineGroups[4].segments.length, 0);
});

test('committed record enumeration is immutable and deterministically ordered by stable ID', async () => {
  const b = await browser(); const layerId = b.read('modelReader.snapshot().currentLayerId');
  b.run(`window.__orderedTx = documentController.beginTransaction();
    window.__orderedTx.create('record_z', {id:'record_z',type:'line',layerId:${JSON.stringify(layerId)},start:{x:0,y:0,featureId:'z1'},end:{x:1,y:1,featureId:'z2'}});
    window.__orderedTx.create('record_a', {id:'record_a',type:'line',layerId:${JSON.stringify(layerId)},start:{x:2,y:2,featureId:'a1'},end:{x:3,y:3,featureId:'a2'}});
    window.__orderedTx.publish()`);
  assert.deepEqual(b.read('modelReader.records().map(record => record.id)'), ['record_a', 'record_z']);
  assert.deepEqual(b.read('modelReader.records().map(record => record.id)'), b.read('modelReader.records().map(record => record.id)'));
  assert.deepEqual(b.read('Object.keys(modelReader.snapshot().geometry.objects)'), ['record_z', 'record_a']);
  assert.equal(b.run('Object.isFrozen(modelReader.records())'), true);
  assert.equal(b.run('Object.isFrozen(modelReader.records()[0])'), true);
  const before = b.read('modelReader.snapshot()');
  b.run('const renderRecords = modelReader.records(); try { renderRecords.reverse() } catch {}; try { renderRecords.push({}) } catch {}');
  assert.deepEqual(b.read('modelReader.snapshot()'), before);
});

test('ViewportScene deterministically skips unsupported committed record types', async () => {
  const b = await browser();
  const result = b.run(`(() => {
    const records = Object.freeze([
      Object.freeze({id:'future_1',type:'unsupported-future-type',payload:Object.freeze({untouched:true})}),
      Object.freeze({id:'line_1',type:'line',start:Object.freeze({x:0,y:0}),end:Object.freeze({x:10,y:0})}),
    ]);
    const scene = window.CaderactViewportScene.createSceneBuilder({
    viewportSettings, camera: viewportCamera,
    getViewportSize: () => ({width:800,height:600}),
    getRecords: () => records,
    getDraftLines: () => [], getPreview: () => null,
    }).createScene();
    return {scene, records};
  })()`);
  assert.deepEqual(Array.from(result.scene.lineGroups[4].segments), [400, 300, 450, 300]);
  assert.equal(result.scene.lineGroups[5].segments.length, 0);
  assert.equal(result.records[0].payload.untouched, true);
  assert.equal(Object.hasOwn(result.records[0], 'screenX'), false);
});

test('Canvas2D and WebGPU consume the same ordered line-group scene contract', async () => {
  const b = await browser({ realRenderer: true });
  b.context.GPUBufferUsage = { UNIFORM: 1, COPY_DST: 2, VERTEX: 4 };
  b.load('src/js/rendering/WebGPURenderer.js');
  const scene = b.run(`({width:100,height:50,deviceScale:1,backgroundColor:'#000000',backgroundColorData:[0,0,0,1],lineGroups:[
    {color:'#ffffff',colorData:[1,1,1,1],lineWidth:1,segments:new Float32Array([1,2,3,4])},
    {color:'#ff0000',colorData:[1,0,0,1],lineWidth:1,segments:new Float32Array([5,6,7,8])}
  ]})`);
  const canvas2d = new b.window.CaderactCanvas2DRenderer(b.canvas);
  canvas2d.render(scene);
  assert.deepEqual(b.drawCalls.filter(call => call[0] === 'moveTo' || call[0] === 'lineTo'), [
    ['moveTo', 1, 2], ['lineTo', 3, 4], ['moveTo', 5, 6], ['lineTo', 7, 8],
  ]);

  const vertexWrites = [];
  const pass = { setPipeline() {}, setBindGroup() {}, setVertexBuffer() {}, draw(count) { this.count = count; }, end() {} };
  const device = {
    lost: new Promise(() => {}),
    createBuffer: options => ({ options, destroy() {} }), createShaderModule: () => ({}),
    createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }), createBindGroup: () => ({}),
    createCommandEncoder: () => ({ beginRenderPass: () => pass, finish: () => ({}) }),
    queue: { writeBuffer(buffer, offset, data) { if (data.length === 24) vertexWrites.push(Array.from(data)); }, submit() {} },
  };
  const gpuContext = { configure() {}, getCurrentTexture: () => ({ createView: () => ({}) }) };
  const webgpu = new b.window.CaderactWebGPURenderer({}, {}, device, gpuContext, 'test', () => {});
  webgpu.render(scene);
  assert.equal(pass.count, 4);
  assert.deepEqual(vertexWrites[0], [
    1,2,1,1,1,1, 3,4,1,1,1,1,
    5,6,1,0,0,1, 7,8,1,0,0,1,
  ]);
});
