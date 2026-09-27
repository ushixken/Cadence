'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {browser}=require('../helpers/browser.cjs');
const root=path.resolve(__dirname,'../..');
const source=()=>fs.readFileSync(path.join(root,'src/js/editor/plot-preview.js'),'utf8');

function plotted(b,{mode='color',orientation='landscape'}={}){b.run(`(()=>{const layout=modelReader.layouts()[0];window.caderactDocumentSession.layoutGateway.setPageSetup(layout.id,{...layout.paper,orientation:'${orientation}',plot:{...layout.paper.plot,colorMode:'${mode}'}});recordGateway.createAll([recordGateway.createLine({x:-100,y:0},{x:100,y:0}),recordGateway.createText({insertionPoint:{x:0,y:5},text:'NOTE',height:2,rotation:0})]);window.caderactDocumentSession.layoutGateway.createViewport(layout.id,{frame:{x:20,y:20,width:120,height:80},viewCenter:{x:0,y:0},scale:10,locked:true});window.__layout=layout.id})()`);return b.read(`window.CaderactPlotScene.create({layout:modelReader.layout(window.__layout),records:modelReader.visibleRecords(),layers:modelReader.layers(),documentUnit:modelReader.units().length,dimensionStyles:Object.fromEntries(modelReader.dimensionStyles().map(s=>[s.id,s]))})`)}

test('PDF1 preview entry and compact technical controls are present',()=>{const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),js=source();assert.match(html,/layout-plot-preview/);for(const label of ['Plot Preview','Page Setup','Fit Page','Zoom out','Zoom in','Close'])assert.match(js,new RegExp(label))});

test('PDF1 consumes CaderactPlotScene as its sole plotted-content authority',()=>{const js=source();assert.match(js,/CaderactPlotScene\.create/);assert.doesNotMatch(js,/ViewportScene|toDataURL|getImageData|drawImage/)});

test('PDF1 plot scene preserves physical page aspect margins scale and annotation',async()=>{const b=await browser(),scene=plotted(b);assert.equal(scene.page.width/scene.page.height,297/210);assert.deepEqual(scene.printable,{x:10,y:10,width:277,height:190});assert.ok(scene.segments.length);assert.equal(scene.texts[0].value,'NOTE');assert.equal(scene.texts[0].height,.2)});

test('PDF1 renders all output color modes from the same plot scene',async()=>{for(const [mode,expected] of [['color','#e8edf4'],['grayscale','#ececec'],['monochrome','#000000']]){const b=await browser(),scene=plotted(b,{mode});assert.equal(scene.plot.colorMode,mode);assert.equal(scene.segments[0].color,expected)}});

test('PDF1 preview source excludes editor overlays and keeps zoom ephemeral',()=>{const js=source();for(const token of ['grid','crosshair','selectionOverlay','snapOverlay','trackingOverlay','dynamicInput'])assert.doesNotMatch(js,new RegExp(`scene\\.${token}`));assert.match(js,/let zoom=1/);assert.match(js,/setZoom/);assert.doesNotMatch(js,/beginTransaction|setPageSetup\([^)]*zoom|recordGateway/)});

test('PDF1 handles invalid context refresh and close/reopen without another scene model',()=>{const js=source();assert.match(js,/no-active-layout/);assert.match(js,/invalid-layout/);assert.match(js,/plot-scene-unavailable/);assert.match(js,/subscribeHistory/);assert.match(js,/dialog\.close/);assert.match(js,/showModal/)});
