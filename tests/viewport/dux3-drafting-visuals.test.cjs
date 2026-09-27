'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {browser}=require('../helpers/browser.cjs');

test('DUX3 crosshair presentation stays tokenized while its authority remains the raw pointer',async()=>{
  const css=fs.readFileSync('src/css/editor-page.css','utf8'),tokens=fs.readFileSync('src/css/base.css','utf8');
  assert.match(css,/\.cad-cursor-overlay[\s\S]*?color:\s*var\(--cad-crosshair\)/);
  assert.match(css,/filter:\s*drop-shadow\(0 0 1px var\(--cad-feedback-edge\)\)/);
  assert.match(tokens,/--cad-feedback-edge:/);
  const b=await browser();b.launch('Line');b.point(400,300);b.point(403,303,'pointermove');b.flush();
  const cursor=b.read('window.caderactViewport.getInteractionVisualState()');
  assert.deepEqual({x:cursor.x,y:cursor.y},{x:413,y:313});
  assert.deepEqual({x:b.renders.at(-1).snapOverlay.point.x,y:b.renders.at(-1).snapOverlay.point.y},{x:400,y:300});
});

test('DUX3 snap glyphs expose one fixed CSS-pixel stroke contract without changing semantic identity',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createLine({x:0,y:0},{x:20,y:0})])');b.launch('Line');
  b.point(400,300,'pointermove');b.flush();let overlay=b.renders.at(-1).snapOverlay;
  assert.deepEqual({kind:overlay.kind,glyph:overlay.glyph,size:overlay.sizePx,width:overlay.strokeWidthPx},{kind:'endpoint',glyph:'endpoint',size:5,width:1.25});
  const endpointSegments=Array.from(overlay.segments);
  b.point(450,300,'pointermove');b.flush();overlay=b.renders.at(-1).snapOverlay;
  assert.deepEqual({kind:overlay.kind,glyph:overlay.glyph,size:overlay.sizePx,width:overlay.strokeWidthPx},{kind:'midpoint',glyph:'midpoint',size:5,width:1.25});
  assert.notDeepEqual(Array.from(overlay.segments),endpointSegments);
});

test('DUX3 tracking and Extension share restrained dashed renderer-neutral guides and clear normally',async()=>{
  const b=await browser();b.resize(800,600);b.run('recordGateway.createAll([recordGateway.createLine({x:0,y:0},{x:20,y:0})])');b.launch('Line');b.point(400,300,'pointermove');b.advance(500);b.point(475,303,'pointermove');b.flush();
  let scene=b.renders.at(-1),guide=scene.lineGroups.at(-2),marker=scene.lineGroups.at(-1);
  assert.ok(scene.objectTrackingOverlay);assert.equal(guide.linetype,'dashed');assert.deepEqual(Array.from(guide.dashPattern),[8,4]);assert.equal(guide.lineWidth,1);assert.equal(marker.lineWidth,1.25);
  b.key('Escape');b.flush();scene=b.renders.at(-1);assert.equal(scene.objectTrackingOverlay,null);assert.equal(scene.lineGroups.at(-2).segments.length,0);
});

test('DUX3 Dynamic Input uses semantic canvas-safe states and preserves invalid lifecycle',async()=>{
  const css=fs.readFileSync('src/css/editor-page.css','utf8'),tokens=fs.readFileSync('src/css/base.css','utf8');
  for(const token of ['cad-hud-border','cad-hud-field-border','cad-hud-active','cad-hud-tag'])assert.match(tokens,new RegExp(`--${token}:`));
  assert.match(css,/\.dynamic-input-field\.is-active[^}]*var\(--cad-hud-active\)/);
  assert.match(css,/\.dynamic-input-hud\.is-invalid \.dynamic-input-field\.is-active[^}]*var\(--status-error\)/);
  const b=await browser();b.launch('Line');b.point(400,300);b.point(450,300,'pointermove');b.key('-');b.key('Enter');
  assert.equal(b.read('window.caderactViewport.getDynamicInputState().invalid'),true);
  const hud=b.viewportHost.children.find(child=>child.classList.contains('dynamic-input-hud'));
  assert.equal(hud.classList.contains('is-invalid'),true);b.key('Escape');assert.equal(hud.classList.contains('is-invalid'),false);
});
