'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const {browser}=require('../helpers/browser.cjs')

test('PERF2B pan and zoom reuse immutable world geometry while camera overlays update',async()=>{
  const b=await browser({commands:false})
  const state=b.read(`(()=>{recordGateway.createAll([recordGateway.createLine({x:0,y:0},{x:10,y:0})]);const first=sceneBuilder.createRenderScene();camera.panX+=25;const pan=sceneBuilder.createRenderScene();camera.zoom*=2;const zoom=sceneBuilder.createRenderScene();return{samePan:first.worldGeometry===pan.worldGeometry,sameZoom:pan.worldGeometry===zoom.worldGeometry,pan:first.cameraTransform.panX!==pan.cameraTransform.panX,zoom:pan.cameraTransform.zoom!==zoom.cameraTransform.zoom,gridChanged:first.grid.minorSegments[0]!==pan.grid.minorSegments[0]||first.grid.minorSegments[1]!==pan.grid.minorSegments[1]}})()`)
  assert.deepEqual(state,{samePan:true,sameZoom:true,pan:true,zoom:true,gridChanged:true})
})

test('PERF2B document geometry property and replacement changes invalidate world geometry',async()=>{
  const b=await browser({commands:false})
  const state=b.read(`(()=>{const line=recordGateway.createLine({x:0,y:0},{x:10,y:0});recordGateway.createAll([line]);const first=sceneBuilder.createRenderScene().worldGeometry;recordGateway.replace(line.id,window.CaderactGeometryTransform.translateRecord(line,5,0));const geometry=sceneBuilder.createRenderScene().worldGeometry;recordGateway.setProperties([line.id],{color:'#abcdef'});const property=sceneBuilder.createRenderScene().worldGeometry;window.caderactDocumentSession.replaceStore(window.CaderactDocument.createStore(),{reason:'perf2b-test'});const replacement=sceneBuilder.createRenderScene().worldGeometry;return{geometry:first!==geometry,property:geometry!==property,replacement:property!==replacement,count:replacement.recordCount}})()`)
  assert.deepEqual(state,{geometry:true,property:true,replacement:true,count:0})
})

test('PERF2B renderer contract exposes one shared world layer to Canvas2D and WebGPU',async()=>{
  const b=await browser({commands:false,realRenderer:true});b.load('src/js/rendering/WebGPURenderer.js')
  const result=b.read(`(()=>{recordGateway.createAll([recordGateway.createLine({x:1,y:2},{x:3,y:4})]);const scene=sceneBuilder.createRenderScene(),renderer=new window.CaderactCanvas2DRenderer(document.querySelector('canvas'));renderer.render(scene);return{canvas:renderer.supportsWorldGeometry,webgpu:window.CaderactWebGPURenderer.prototype.constructor===window.CaderactWebGPURenderer,worldGroups:scene.worldGeometry.drawGroups.length,screenGroups:scene.drawGroups.length,transform:scene.cameraTransform}})()`)
  assert.equal(result.canvas,true)
  assert.equal(result.webgpu,true)
  assert.ok(result.worldGroups>0)
  assert.ok(result.screenGroups>0)
  assert.ok(Number.isFinite(result.transform.zoom))
})

test('PERF2B Layout keeps established viewport-specific screen scene path',async()=>{
  const b=await browser({commands:false})
  const result=b.read(`(()=>{window.caderactLayoutContext.switchToLayout(modelReader.layouts()[0].id);const scene=sceneBuilder.createRenderScene();return{world:Boolean(scene.worldGeometry),paper:Boolean(scene.paperSpaceOverlay)}})()`)
  assert.deepEqual(result,{world:false,paper:true})
})

