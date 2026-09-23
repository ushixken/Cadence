'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGeometry } = require('../helpers/geometry.cjs');
const Planner = loadGeometry().CaderactCornerModificationPlanner;
const line = (start,end,id) => ({id,type:'line',layerId:'layer-1',start:{...start,featureId:`${id}-s`},end:{...end,featureId:`${id}-e`}});
const horizontal=line({x:-10,y:0},{x:10,y:0},'h'),vertical=line({x:0,y:-10},{x:0,y:10},'v');
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

test('Fillet radius zero trims or extends picked Line portions to their corner',()=>{
  const plan=Planner.planFillet({first:horizontal,firstPick:{x:8,y:0},second:vertical,secondPick:{x:0,y:8},radius:0});
  assert.equal(plan.status,'planned');assert.equal(plan.createdGeometry,null);
  assert.deepEqual(plan.replacements.map(value=>value.geometry),[
    {type:'line',start:{x:0,y:0},end:{x:10,y:0}},
    {type:'line',start:{x:0,y:0},end:{x:0,y:10}},
  ]);
});

test('positive Fillet produces tangent replacement endpoints and an exact arc',()=>{
  const plan=Planner.planFillet({first:horizontal,firstPick:{x:8,y:0},second:vertical,secondPick:{x:0,y:8},radius:2});
  assert.equal(plan.status,'planned');near(plan.replacements[0].geometry.start.x,2);near(plan.replacements[1].geometry.start.y,2);
  near(plan.createdGeometry.center.x,2);near(plan.createdGeometry.center.y,2);near(plan.createdGeometry.radius,2);near(plan.createdGeometry.sweep,-Math.PI/2);
});

test('Fillet handles acute and obtuse pick wedges and rejects impossible or parallel input',()=>{
  const diagonal=line({x:-10,y:-5},{x:10,y:5},'d');
  for(const pick of [{x:8,y:4},{x:-8,y:-4}])assert.equal(Planner.planFillet({first:horizontal,firstPick:{x:8,y:0},second:diagonal,secondPick:pick,radius:1}).status,'planned');
  assert.equal(Planner.planFillet({first:horizontal,firstPick:{x:8,y:0},second:vertical,secondPick:{x:0,y:8},radius:20}).reason,'impossible-radius');
  assert.equal(Planner.planFillet({first:horizontal,firstPick:{x:8,y:0},second:line({x:-10,y:2},{x:10,y:2},'p'),secondPick:{x:8,y:2},radius:1}).reason,'parallel-lines');
});

test('pick sides deterministically select the preserved Line portions',()=>{
  const plan=Planner.planFillet({first:horizontal,firstPick:{x:-8,y:0},second:vertical,secondPick:{x:0,y:-8},radius:2});
  near(plan.replacements[0].geometry.start.x,-10);near(plan.replacements[0].geometry.end.x,-2);
  near(plan.replacements[1].geometry.start.y,-10);near(plan.replacements[1].geometry.end.y,-2);
});

test('Chamfer supports equal, unequal, and one-zero distances',()=>{
  const equal=Planner.planChamfer({first:horizontal,firstPick:{x:8,y:0},second:vertical,secondPick:{x:0,y:8},firstDistance:2,secondDistance:2});
  assert.equal(equal.status,'planned');assert.deepEqual(equal.createdGeometry,{type:'line',start:{x:2,y:0},end:{x:0,y:2}});
  const unequal=Planner.planChamfer({first:horizontal,firstPick:{x:8,y:0},second:vertical,secondPick:{x:0,y:8},firstDistance:3,secondDistance:4});
  assert.deepEqual(unequal.createdGeometry,{type:'line',start:{x:3,y:0},end:{x:0,y:4}});
  assert.equal(Planner.planChamfer({first:horizontal,firstPick:{x:8,y:0},second:vertical,secondPick:{x:0,y:8},firstDistance:0,secondDistance:3}).status,'planned');
});

test('Chamfer explicitly rejects two-zero, excessive, and parallel distances',()=>{
  assert.equal(Planner.planChamfer({first:horizontal,firstPick:{x:8,y:0},second:vertical,secondPick:{x:0,y:8},firstDistance:0,secondDistance:0}).reason,'degenerate-result');
  assert.equal(Planner.planChamfer({first:horizontal,firstPick:{x:8,y:0},second:vertical,secondPick:{x:0,y:8},firstDistance:12,secondDistance:2}).reason,'distance-exceeds-line');
  assert.equal(Planner.planChamfer({first:horizontal,firstPick:{x:8,y:0},second:line({x:-10,y:2},{x:10,y:2},'p'),secondPick:{x:8,y:2},firstDistance:1,secondDistance:1}).reason,'parallel-lines');
});
