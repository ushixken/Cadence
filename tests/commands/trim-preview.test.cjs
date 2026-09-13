'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {browser}=require('../helpers/browser.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
function state(b){return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo.entryCount,dirty:documentController.isDirty})')}
function createLine(b,a,c){return plain(b.run(`recordGateway.createLine(${JSON.stringify(a)},${JSON.stringify(c)})`))}
function createCircle(b,center,radius){return plain(b.run(`recordGateway.createCircle(${JSON.stringify(center)},${radius})`))}
function createArc(b,geometry){return plain(b.run(`recordGateway.createArc(${JSON.stringify(geometry)})`))}
function createEllipse(b,geometry){return plain(b.run(`recordGateway.createEllipse(${JSON.stringify(geometry)})`))}
function createPolyline(b,vertices,closed=false){return plain(b.run(`recordGateway.createPolyline(${JSON.stringify(vertices)},${closed})`))}
function add(b,records){b.run(`recordGateway.createAll(${JSON.stringify(records)})`)}
function finish(b){b.key('Enter',b.document)}
function preview(b){return b.read('window.caderactCommandRouter.activeSession.getTrimPreview()')}
// World (0,0) maps to screen (400,300) at initial zoom 5: screenX = 400 + 5*worldX, screenY = 300 - 5*worldY.
const sx=x=>400+5*x, sy=y=>300-5*y;

test('1/2. Target hover creates a valid Trim preview for a Line one-side removal',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  assert.equal(preview(b),null)
  b.point(sx(5),sy(0),'pointermove')
  const p=preview(b)
  assert.ok(p);assert.equal(p.phase,'targets');assert.equal(p.sourceRecordId,target.id)
  assert.equal(p.records.length,1)
  assert.equal(p.records[0].type,'line')
  assert.ok(p.records[0].id===null||p.records[0].id===undefined)
  assert.ok(Math.abs(p.records[0].start.x)<1e-6||Math.abs(p.records[0].end.x)<1e-6)
});

test('3. Line middle-removal preview shows both survivors',async()=>{
  const b=await browser()
  const edgeA=createLine(b,{x:-3,y:-10},{x:-3,y:10}),edgeB=createLine(b,{x:3,y:-10},{x:3,y:10})
  const target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edgeA,edgeB,target])
  b.launch('Trim');b.point(sx(-3),sy(-10),'pointerdown');b.point(sx(3),sy(-10),'pointerdown',{ctrlKey:true});finish(b)
  b.point(sx(0),sy(0),'pointermove')
  const p=preview(b)
  assert.ok(p);assert.equal(p.records.length,2)
  assert.ok(p.records.every(record=>record.type==='line'))
});

test('4. Circle target preview produces an Arc-shaped survivor',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:-10,y:3},{x:10,y:3}),target=createCircle(b,{x:0,y:0},5);add(b,[edge,target])
  b.launch('Trim');b.point(sx(-9),sy(3));finish(b)
  b.point(sx(0),sy(5),'pointermove')
  const p=preview(b)
  assert.ok(p);assert.equal(p.records.length,1);assert.equal(p.records[0].type,'arc')
});

test('5. Arc target preview',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:0,y:-20},{x:0,y:20})
  const target=createArc(b,{center:{x:0,y:0},start:{x:10,y:0},end:{x:-10,y:0},radius:10,sweep:Math.PI})
  add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-20));finish(b)
  b.point(sx(7.07),sy(7.07),'pointermove')
  const p=preview(b)
  assert.ok(p);assert.equal(p.records[0].type,'arc')
});

test('6. Polyline target preview',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:5,y:-10},{x:5,y:10})
  const target=createPolyline(b,[{x:0,y:0},{x:10,y:0},{x:10,y:10}],false)
  add(b,[edge,target])
  b.launch('Trim');b.point(sx(5),sy(-10));finish(b)
  b.point(sx(2),sy(0),'pointermove')
  const p=preview(b)
  assert.ok(p);assert.equal(p.records[0].type,'polyline')
});

test('7. Ellipse target requiring partial-ellipse persistence gets no preview',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:-10,y:5},{x:10,y:5}),target=createEllipse(b,{center:{x:0,y:0},majorAxis:{x:8,y:0},minorRadius:4});add(b,[edge,target])
  b.launch('Trim');b.point(sx(-7),sy(5));finish(b)
  b.point(sx(0),sy(4),'pointermove')
  assert.equal(preview(b),null)
});

test('8. No intersection produces no preview',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:100,y:100},{x:110,y:110}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(100),sy(100));finish(b)
  b.point(sx(0),sy(0),'pointermove')
  assert.equal(preview(b),null)
});

test('9. Tangent-only intersection produces no preview',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:-10,y:5},{x:10,y:5}),target=createCircle(b,{x:0,y:0},5);add(b,[edge,target])
  b.launch('Trim');b.point(sx(-9),sy(5));finish(b)
  b.point(sx(0),sy(5),'pointermove')
  assert.equal(preview(b),null)
});

test('10/11/12/13/14/15. Preview mirrors TrimPlanner output but never publishes, mutates, or allocates persistent identity',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  const before=state(b)
  b.point(sx(-5),sy(0),'pointermove')
  const p=preview(b)
  assert.ok(p)
  const planned=plain(b.run(`window.CaderactTrimPlanner.planTrim({target:modelReader.records().find(r=>r.id===${JSON.stringify(target.id)}),cuttingEdges:[modelReader.records().find(r=>r.id===${JSON.stringify(edge.id)})],pickPoint:{x:-5,y:0}})`))
  assert.equal(p.records[0].start.x,planned.replacement.geometry.start.x)
  assert.equal(p.records[0].start.y,planned.replacement.geometry.start.y)
  assert.equal(p.records[0].end.x,planned.replacement.geometry.end.x)
  assert.deepEqual(state(b),before)
});

test('16. Preview does not alter modelReader committed records',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  const before=plain(b.read('modelReader.records()'))
  b.point(sx(-5),sy(0),'pointermove')
  assert.deepEqual(plain(b.read('modelReader.records()')),before)
});

test('17. Preview does not alter selection',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  const before=b.read('window.caderactSelection.selectedIds()')
  b.point(sx(-5),sy(0),'pointermove')
  assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),before)
});

test('18. Preview never enters SnapResolver candidate geometry',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:3,y:-3},{x:3,y:9}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(3),sy(-3));finish(b)
  b.point(sx(-5),sy(0),'pointermove')
  const p=preview(b)
  assert.ok(p)
  // The preview survivor's new (allocated) endpoint sits at the trim cut
  // (3,0) -- not at any committed record endpoint or midpoint (the cutting
  // edge here is offset both in x and asymmetrically in y so neither its
  // own midpoint nor the target's original midpoint/endpoints coincide with
  // it). Hovering exactly at that cut point must not report a snap, proving
  // SnapResolver only sees modelReader's committed records -- never the
  // transient preview geometry.
  const cutPoint=p.records[0].start.x===3&&p.records[0].start.y===0?p.records[0].start:p.records[0].end
  assert.equal(cutPoint.x,3);assert.equal(cutPoint.y,0)
  // P3 adds legitimate committed-geometry Intersection snaps at this point;
  // turn only that mode off so this remains a test of preview isolation.
  b.run('window.caderactViewport.setObjectSnapMode("intersection",false)')
  b.point(sx(cutPoint.x),sy(cutPoint.y),'pointermove')
  const acquired=b.read('window.caderactViewport.getInteractionVisualState().snapAcquired')
  assert.equal(acquired,false)
});

test('19/20. Raw screen pointer identifies the target; snapped model-space point drives TrimPlanner pick semantics',async()=>{
  const left=await browser()
  const leftEdge=createLine(left,{x:0,y:-10},{x:0,y:10}),leftTarget=createLine(left,{x:-10,y:0},{x:10,y:0});add(left,[leftEdge,leftTarget])
  left.launch('Trim');left.point(sx(0),sy(-10));finish(left)
  left.point(sx(-5),sy(0),'pointermove')
  const leftPreview=preview(left)

  const right=await browser()
  const rightEdge=createLine(right,{x:0,y:-10},{x:0,y:10}),rightTarget=createLine(right,{x:-10,y:0},{x:10,y:0});add(right,[rightEdge,rightTarget])
  right.launch('Trim');right.point(sx(0),sy(-10));finish(right)
  right.point(sx(5),sy(0),'pointermove')
  const rightPreview=preview(right)

  assert.ok(leftPreview);assert.ok(rightPreview)
  assert.notDeepEqual([leftPreview.records[0].start,leftPreview.records[0].end],[rightPreview.records[0].start,rightPreview.records[0].end])
});

test('21. Pointer move updates preview when the clicked interval changes',async()=>{
  const b=await browser()
  const edgeA=createLine(b,{x:-3,y:-10},{x:-3,y:10}),edgeB=createLine(b,{x:3,y:-10},{x:3,y:10})
  const target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edgeA,edgeB,target])
  b.launch('Trim');b.point(sx(-3),sy(-10),'pointerdown');b.point(sx(3),sy(-10),'pointerdown',{ctrlKey:true});finish(b)
  b.point(sx(0),sy(0),'pointermove')
  const middle=preview(b)
  b.point(sx(-8),sy(0),'pointermove')
  const side=preview(b)
  assert.ok(middle);assert.ok(side)
  assert.notDeepEqual(middle.records,side.records)
});

test('22. Pointer move to another target updates preview',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10})
  const target1=createLine(b,{x:-10,y:0},{x:10,y:0}),target2=createLine(b,{x:-10,y:2},{x:10,y:2})
  add(b,[edge,target1,target2])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  b.point(sx(-5),sy(0),'pointermove')
  assert.equal(preview(b).sourceRecordId,target1.id)
  b.point(sx(-5),sy(2),'pointermove')
  assert.equal(preview(b).sourceRecordId,target2.id)
});

test('23. Pointer move to invalid/empty space clears preview',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  b.point(sx(-5),sy(0),'pointermove')
  assert.ok(preview(b))
  b.point(sx(200),sy(200),'pointermove')
  assert.equal(preview(b),null)
});

test('24. Pointer leave clears preview',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  b.point(sx(-5),sy(0),'pointermove')
  assert.ok(preview(b))
  b.emit(b.canvas,'pointerleave')
  assert.equal(preview(b),null)
});

test('25/26. Pointer cancel and lost capture clear preview',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  b.point(sx(-5),sy(0),'pointermove')
  assert.ok(preview(b))
  b.run('window.caderactCommandRouter.cancelActive()')
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null)
});

test('27. Escape clears preview',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  b.point(sx(-5),sy(0),'pointermove')
  assert.ok(preview(b))
  b.key('Escape',b.document)
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null)
});

test('28/29. Enter and quick Space finish clear preview',async()=>{
  const b=await browser(),edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  b.point(sx(-5),sy(0),'pointermove')
  assert.ok(preview(b))
  finish(b)
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null)
});

test('30/31. Successful commit clears stale preview; next hover after commit uses current committed geometry',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10})
  const target1=createLine(b,{x:-10,y:0},{x:10,y:0})
  const target2=createLine(b,{x:-10,y:2},{x:10,y:2})
  add(b,[edge,target1,target2])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  b.point(sx(-5),sy(0),'pointermove')
  assert.ok(preview(b))
  b.point(sx(-5),sy(0),'pointerdown')
  assert.equal(preview(b),null)
  b.point(sx(-5),sy(2),'pointermove')
  const p=preview(b)
  assert.ok(p)
  assert.equal(p.sourceRecordId,target2.id)
});

test('32. A missing confirmed cutting edge is handled safely during hover, never crashing',async()=>{
  const b=await browser(),edge=createLine(b,{x:0,y:-10},{x:0,y:10}),other=createLine(b,{x:50,y:-10},{x:50,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,other,target])
  b.launch('Trim');b.point(sx(0),sy(-10),'pointerdown');b.point(sx(50),sy(-10),'pointerdown',{ctrlKey:true});finish(b)
  b.run(`recordGateway.removeAll(${JSON.stringify([edge.id])})`)
  assert.doesNotThrow(()=>b.point(sx(-5),sy(0),'pointermove'))
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
});

test('33. Publication failure leaves preview/session retryable',async()=>{
  const b=await browser(),edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-8));finish(b)
  b.run('window.__blocking=documentController.beginTransaction()')
  b.point(sx(-5),sy(0),'pointerdown')
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
  b.run('window.__blocking.rollback()')
  b.point(sx(-5),sy(0),'pointermove')
  assert.ok(preview(b))
});

test('34. Multiple-survivor preview order matches TrimPlanner (replacement first, then creates)',async()=>{
  const b=await browser()
  const edgeA=createLine(b,{x:-3,y:-10},{x:-3,y:10}),edgeB=createLine(b,{x:3,y:-10},{x:3,y:10})
  const target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edgeA,edgeB,target])
  b.launch('Trim');b.point(sx(-3),sy(-10),'pointerdown');b.point(sx(3),sy(-10),'pointerdown',{ctrlKey:true});finish(b)
  b.point(sx(0),sy(0),'pointermove')
  const p=preview(b)
  const planned=plain(b.run(`window.CaderactTrimPlanner.planTrim({target:modelReader.records().find(r=>r.id===${JSON.stringify(target.id)}),cuttingEdges:[modelReader.records().find(r=>r.id===${JSON.stringify(edgeA.id)}),modelReader.records().find(r=>r.id===${JSON.stringify(edgeB.id)})],pickPoint:{x:0,y:0}})`))
  assert.equal(p.records[0].start.x,planned.replacement.geometry.start.x)
  assert.equal(p.records[1].start.x,planned.creates[0].geometry.start.x)
});
