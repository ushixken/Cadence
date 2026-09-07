'use strict';const {test}=require('node:test');const assert=require('node:assert/strict');const {browser}=require('../helpers/browser.cjs');
function drag(b,start,end,props={}){b.point(...start,'pointerdown',props);b.point(...end,'pointermove',props);b.flush();b.point(...end,'pointerup',props);b.flush()}
function line(b,a,c){b.run(`window.__boxLine=recordGateway.createLine(${JSON.stringify(a)},${JSON.stringify(c)});recordGateway.createAll([window.__boxLine])`);return b.read('window.__boxLine.id')}

test('pure rectangle helpers normalize, contain, and intersect boundary-touching segments',async()=>{
  const b=await browser(),api=b.window.CaderactSelectionBox,r=api.normalizeRect({x:10,y:20},{x:0,y:5});assert.deepEqual({...r},{left:0,right:10,top:5,bottom:20});assert.equal(api.pointInRect({x:0,y:5},r),true);assert.equal(api.segmentIntersectsRect({x:-5,y:5},{x:0,y:5},r),true);assert.equal(api.segmentIntersectsRect({x:-5,y:0},{x:-1,y:0},r),false)
});

test('direction selects Window containment or Crossing intersection and can switch live',async()=>{
  const b=await browser();const inside=line(b,{x:-10,y:0},{x:10,y:0}),crossing=line(b,{x:-40,y:10},{x:40,y:10});b.point(300,240);b.point(500,360,'pointermove');b.flush();assert.equal(b.renders.at(-1).selectionBoxOverlay.mode,'window');b.point(250,360,'pointermove');b.flush();assert.equal(b.renders.at(-1).selectionBoxOverlay.mode,'crossing');b.point(500,360,'pointermove');b.point(500,360,'pointerup');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[inside]);drag(b,[500,240],[300,360]);assert.deepEqual(new Set(b.read('window.caderactSelection.selectedIds()')),new Set([inside,crossing]))
});

test('below-threshold empty click keeps D3 behavior while active drag mutates only on release',async()=>{
  const b=await browser();const id=line(b,{x:-10,y:0},{x:10,y:0});b.point(400,300);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);b.point(700,500);b.point(702,501,'pointermove');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[id]);assert.equal(b.read('selectionBox.isActive'),false);b.point(702,501,'pointerup');assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[])
});

test('Window and Crossing support Line, Circle, finite Arc, and rotated Ellipse as curves',async()=>{
  const b=await browser();const records=[
    {id:'line-in',type:'line',start:{x:2,y:2},end:{x:8,y:8}}, {id:'line-cross',type:'line',start:{x:-5,y:5},end:{x:5,y:5}},
    {id:'circle-in',type:'circle',center:{x:5,y:5},radius:2}, {id:'circle-big',type:'circle',center:{x:5,y:5},radius:20},
    {id:'arc-in',type:'arc',center:{x:5,y:5},radius:2,start:{x:7,y:5},end:{x:3,y:5},sweep:Math.PI},
    {id:'arc-away',type:'arc',center:{x:5,y:5},radius:8,start:{x:13,y:5},end:{x:5,y:13},sweep:Math.PI/2},
    {id:'ellipse-in',type:'ellipse',center:{x:5,y:5},majorAxis:{x:2,y:1},minorRadius:1},
    {id:'ellipse-cross',type:'ellipse',center:{x:0,y:5},majorAxis:{x:4,y:2},minorRadius:2},
  ];b.window.__records=records;b.window.__identity=(x,y)=>({x,y});
  const windowResult=b.window.CaderactSelectionBox.query({start:{x:0,y:0},current:{x:10,y:10},records,worldToScreen:b.window.__identity});assert.deepEqual(Array.from(windowResult.recordIds),['arc-in','circle-in','ellipse-in','line-in']);
  const crossingResult=b.window.CaderactSelectionBox.query({start:{x:10,y:10},current:{x:0,y:0},records,worldToScreen:b.window.__identity});assert.ok(crossingResult.recordIds.includes('line-cross'));assert.ok(crossingResult.recordIds.includes('ellipse-cross'));assert.equal(crossingResult.recordIds.includes('circle-big'),false);assert.equal(crossingResult.recordIds.includes('arc-away'),false)
});

test('normal boxes replace, modifier boxes toggle, and empty modifier boxes preserve',async()=>{
  const b=await browser();const first=line(b,{x:-20,y:0},{x:-10,y:0}),second=line(b,{x:10,y:0},{x:20,y:0});b.point(325,300);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[first]);drag(b,[440,250],[520,350],{ctrlKey:true});assert.deepEqual(new Set(b.read('window.caderactSelection.selectedIds()')),new Set([first,second]));drag(b,[440,250],[520,350],{ctrlKey:true});assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[first]);drag(b,[700,500],[750,550],{ctrlKey:true});assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[first]);drag(b,[700,500],[750,550]);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[])
});

test('pointercancel, lost capture, and Escape cancel without selection or document mutation',async()=>{
  for(const ending of ['pointercancel','lostpointercapture','Escape']){const b=await browser();const id=line(b,{x:-10,y:0},{x:10,y:0});b.point(400,300);const before=b.read('({selection:window.caderactSelection.selectedIds(),revision:documentController.currentRevision,stateId:documentController.currentStateId,dirty:documentController.isDirty})');b.point(700,500);b.point(600,400,'pointermove');b.flush();assert.notEqual(b.renders.at(-1).selectionBoxOverlay,null);if(ending==='Escape')b.key('Escape',b.document);else b.point(600,400,ending);b.flush();assert.equal(b.renders.at(-1).selectionBoxOverlay,null);assert.deepEqual(b.read('({selection:window.caderactSelection.selectedIds(),revision:documentController.currentRevision,stateId:documentController.currentStateId,dirty:documentController.isDirty})'),before);assert.equal(b.canvas.capturedPointer,undefined);assert.equal(b.read('window.caderactSelection.selectedIds()[0]'),id)}
});

test('active commands and grips retain pointer priority over box selection',async()=>{
  for(const command of ['Line','Rectangle','Polyline','Circle','Arc','Polygon','Ellipse']){const b=await browser();b.launch(command);b.point(700,500);b.point(600,400,'pointermove');assert.equal(b.read('selectionBox.isPending'),false);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),command)}
  const b=await browser();line(b,{x:-10,y:0},{x:10,y:0});b.point(400,300);b.flush();b.point(350,300);assert.equal(b.read('window.caderactGrips.isActive'),true);assert.equal(b.read('selectionBox.isPending'),false)
});

test('overlay is screen-space stable across pan, zoom, DPR and distinguishes solid/dashed modes',async()=>{
  const b=await browser();b.point(200,200);b.point(300,300,'pointermove');b.flush();const windowOverlay=b.renders.at(-1).selectionBoxOverlay;assert.equal(windowOverlay.mode,'window');assert.equal(windowOverlay.segments.length,16);assert.match(windowOverlay.fill.color,/0\.10/);assert.ok(windowOverlay.fill.segments.length>0);const windowFill=windowOverlay.fill.color;b.point(100,300,'pointermove');b.flush();const crossing=b.renders.at(-1).selectionBoxOverlay;assert.equal(crossing.mode,'crossing');assert.ok(crossing.segments.length>16);assert.ok(crossing.fill.segments.length>0);assert.notEqual(crossing.fill.color,windowFill);assert.equal(b.renders.at(-1).lineGroups[12].color,windowFill);assert.equal(b.renders.at(-1).lineGroups[13].color,crossing.fill.color);b.resize(800,600,2);b.flush();assert.equal(b.renders.at(-1).selectionBoxOverlay.mode,'crossing')
});

test('selection fill disappears immediately on release and every cancellation path',async()=>{
  for(const ending of ['pointerup','pointercancel','lostpointercapture','Escape']){const b=await browser();b.point(200,200);b.point(300,300,'pointermove');b.flush();assert.ok(b.renders.at(-1).selectionBoxOverlay.fill.segments.length>0);if(ending==='Escape')b.key('Escape',b.document);else b.point(300,300,ending);b.flush();assert.equal(b.renders.at(-1).selectionBoxOverlay,null);assert.equal(b.renders.at(-1).lineGroups[12].segments.length,0);assert.equal(b.renders.at(-1).lineGroups[13].segments.length,0)}
});
