'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const {browser}=require('../helpers/browser.cjs')

test('PERF2 renderer-neutral scene preparation handles 100k committed Lines without argument overflow',async()=>{
  const b=await browser({commands:false})
  const result=b.read(`(()=>{const records=Array.from({length:100000},(_,i)=>recordGateway.createLine({x:i%1000,y:Math.floor(i/1000)*2},{x:i%1000+.75,y:Math.floor(i/1000)*2+.5}));recordGateway.createAll(records);const scene=createScene();return{records:modelReader.records().length,visibleSegments:scene.lineGroups[4].segments.length}})()`)
  assert.equal(result.records,100000)
  assert.ok(result.visibleSegments>0)
})

test('PERF2 spatial query is conservative and narrows point and rectangle candidates',async()=>{
  const b=await browser({commands:false})
  const result=b.read(`(()=>{const near=recordGateway.createLine({x:0,y:0},{x:5,y:0}),far=recordGateway.createLine({x:1000,y:1000},{x:1005,y:1000}),unknown=Object.freeze({id:'unknown',type:'future-record'}),screen=window.CaderactSpatialQuery.createScreenIndex([near,far,unknown],(x,y)=>({x,y})),world=window.CaderactSpatialQuery.createWorldIndex([near,far,unknown]);return{point:screen.queryPoint({x:1,y:0},8).map(record=>record.id).sort(),rect:world.queryRect({x1:-1,y1:-1,x2:10,y2:10}).map(record=>record.id).sort()}})()`)
  assert.equal(result.point.length,2)
  assert.equal(result.point.includes('unknown'),true)
  assert.equal(result.rect.includes('far'),false)
  assert.equal(result.rect.includes('unknown'),true)
  assert.equal(result.rect.length,2)
})

test('PERF2 snap index invalidates on immutable record replacement and preserves exact snap semantics',async()=>{
  const b=await browser({commands:false})
  const result=b.read(`(()=>{const resolver=window.CaderactSnapResolver.createResolver(),line=recordGateway.createLine({x:0,y:0},{x:10,y:0}),args={worldToScreen:(x,y)=>({x,y}),enabled:{object:true,endpoint:true,midpoint:true,intersection:true,nearest:false,grid:false}},first=resolver.resolve({...args,rawWorldPoint:{x:0,y:0},records:[line]}),moved=window.CaderactGeometryTransform.translateRecord(line,100,0),stale=resolver.resolve({...args,rawWorldPoint:{x:0,y:0},records:[moved]}),next=resolver.resolve({...args,rawWorldPoint:{x:100,y:0},records:[moved]});return{first:first.point,stale:stale.snapped,next:next.point}})()`)
  assert.deepEqual(result.first,{x:0,y:0})
  assert.equal(result.stale,false)
  assert.deepEqual(result.next,{x:100,y:0})
})

