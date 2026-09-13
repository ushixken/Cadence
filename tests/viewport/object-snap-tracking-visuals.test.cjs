'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {browser}=require('../helpers/browser.cjs');
function seed(b){b.run('window.__line=recordGateway.createLine({x:0,y:0},{x:20,y:0});recordGateway.createAll([window.__line])')}
test('P4A acquired marker and H/V guides project exactly in renderer-neutral scene data',async()=>{
  const b=await browser();seed(b);b.launch('Line');b.point(400,300,'pointermove');b.advance(500);b.flush();let overlay=b.renders.at(-1).objectTrackingOverlay;assert.deepEqual({x:overlay.acquiredPoint.x,y:overlay.acquiredPoint.y},{x:400,y:300});assert.equal(overlay.markerSegments.length,16);
  b.point(475,303,'pointermove');b.flush();overlay=b.renders.at(-1).objectTrackingOverlay;assert.equal(overlay.guideKind,'horizontal');assert.deepEqual(Array.from(overlay.guideSegments),[0,300,800,300]);assert.deepEqual({x:overlay.candidatePoint.x,y:overlay.candidatePoint.y},{x:475,y:300});
  b.point(403,200,'pointermove');b.flush();overlay=b.renders.at(-1).objectTrackingOverlay;assert.equal(overlay.guideKind,'vertical');assert.deepEqual(Array.from(overlay.guideSegments),[400,0,400,600]);assert.deepEqual({x:overlay.candidatePoint.x,y:overlay.candidatePoint.y},{x:400,y:200});
});
test('direct P3 winner suppresses tracking candidate and lifecycle clears overlay',async()=>{
  const b=await browser();seed(b);b.launch('Line');b.point(400,300,'pointermove');b.advance(500);b.point(475,303,'pointermove');b.flush();assert.ok(b.renders.at(-1).objectTrackingOverlay.candidatePoint);b.point(500,300,'pointermove');b.flush();assert.equal(b.renders.at(-1).snapOverlay.kind,'endpoint');assert.equal(b.renders.at(-1).objectTrackingOverlay.candidatePoint,null);b.key('Escape');b.flush();assert.equal(b.renders.at(-1).objectTrackingOverlay,null)
});
test('tracking marker size is CSS stable through zoom and DPR and both renderers share line groups',async()=>{
  const b=await browser();seed(b);b.launch('Line');b.point(400,300,'pointermove');b.advance(500);b.flush();const first=Array.from(b.renders.at(-1).objectTrackingOverlay.markerSegments);b.resize(800,600,2);b.flush();const second=Array.from(b.renders.at(-1).objectTrackingOverlay.markerSegments);assert.equal(Math.max(...first.filter(Number.isFinite))-Math.min(...first.filter(Number.isFinite)),Math.max(...second.filter(Number.isFinite))-Math.min(...second.filter(Number.isFinite)));const scene=b.renders.at(-1);assert.deepEqual(Array.from(scene.lineGroups.at(-2).segments),Array.from(scene.objectTrackingOverlay.guideSegments));assert.deepEqual(Array.from(scene.lineGroups.at(-1).segments),Array.from(scene.objectTrackingOverlay.markerSegments))
});
