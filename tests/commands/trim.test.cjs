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
function drag(b,start,end,props={}){b.point(...start,'pointerdown',props);b.point(...end,'pointermove',props);b.point(...end,'pointerup',props)}
// World (0,0) maps to screen (400,300) at initial zoom 5: screenX = 400 + 5*worldX, screenY = 300 - 5*worldY.
const sx=x=>400+5*x, sy=y=>300-5*y;

test('Trim resolves canonical name and TR alias, is repeatable, and activates into cutting-edge phase',async()=>{
  for(const command of ['Trim','TR']){const b=await browser();b.launch(command);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')}
  const b=await browser();b.launch('Trim');assert.equal(b.read('window.caderactCommandRouter.activeSession.isSelectionPhase'),true);assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'cutting-edges')
  b.launch('Trim');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim');b.run('window.caderactCommandRouter.cancelActive()')
  const registered=b.read('window.caderactCommandRegistry.resolve("Trim").repeatable');assert.equal(registered,true)
});

test('Trim activation respects existing preselection, mirroring Move/Copy/Rotate/Scale/Delete convention',async()=>{
  const b=await browser(),line=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[line])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(line.id)})`)
  b.launch('Trim');assert.equal(b.read('window.caderactCommandRouter.activeSession.isSelectionPhase'),false)
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'targets')
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds'),[line.id])
  assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[line.id])
});

test('Preselection fast-path: select one Line, activate Trim, land immediately in targets phase with no Enter',async()=>{
  const b=await browser(),line=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[line])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(line.id)})`)
  b.launch('Trim')
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'targets')
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds'),[line.id])
});

test('Preselection fast-path via TR alias: immediate click on target commits a trim with no Enter',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10})
  const target=createLine(b,{x:-10,y:0},{x:10,y:0})
  add(b,[edge,target])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(edge.id)})`)
  const before=state(b)
  b.launch('TR')
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'targets')
  b.point(sx(-5),sy(0),'pointerdown')
  const after=state(b)
  assert.equal(after.history,before.history+1)
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
  const remaining=plain(b.read('modelReader.records()'))
  assert.ok(remaining.some(record=>record.id===target.id&&record.type==='line'))
});

test('Preselected trim keeps Trim active for further trims',async()=>{
  const b=await browser()
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10})
  const target1=createLine(b,{x:-10,y:0},{x:10,y:0})
  const target2=createLine(b,{x:-10,y:5},{x:10,y:5})
  add(b,[edge,target1,target2])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(edge.id)})`)
  b.launch('Trim')
  b.point(sx(-5),sy(0),'pointerdown')
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
  b.point(sx(-5),sy(5),'pointerdown')
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
});

test('Enter after preselected activation finishes Trim immediately (already in target phase)',async()=>{
  const b=await browser(),line=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[line])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(line.id)})`)
  b.launch('Trim')
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'targets')
  finish(b)
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null)
});

test('Escape after preselected activation cancels cleanly with no mutation',async()=>{
  const b=await browser(),line=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[line])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(line.id)})`)
  const before=state(b)
  b.launch('Trim')
  b.key('Escape',b.document)
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null)
  const after=state(b)
  assert.equal(after.history,before.history)
  assert.equal(after.revision,before.revision)
});

test('Multiple preselected cutting edges are accepted immediately into targets phase',async()=>{
  const b=await browser()
  const a=createLine(b,{x:0,y:-10},{x:0,y:10})
  const c=createLine(b,{x:-10,y:5},{x:10,y:5})
  const target=createLine(b,{x:-10,y:0},{x:10,y:0})
  add(b,[a,c,target])
  b.run(`window.caderactSelection.applyRecordIds(${JSON.stringify([a.id,c.id])})`)
  b.launch('Trim')
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'targets')
  assert.deepEqual(new Set(b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds')),new Set([a.id,c.id]))
});

test('Empty preselection still starts Trim in cutting-edges phase',async()=>{
  const b=await browser()
  b.launch('Trim')
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'cutting-edges')
  assert.equal(b.read('window.caderactCommandRouter.activeSession.isSelectionPhase'),true)
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds'),[])
});

test('Invalid/missing preselected IDs fall back safely to cutting-edges phase',async()=>{
  const b=await browser(),line=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[line])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(line.id)})`)
  b.run(`recordGateway.removeAll(${JSON.stringify([line.id])})`)
  b.launch('Trim')
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'cutting-edges')
  assert.equal(b.read('window.caderactCommandRouter.activeSession.isSelectionPhase'),true)
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds'),[])
});

test('Trim cutting-edge phase reuses click, Window, Crossing, and Ctrl/Meta selection semantics',async()=>{
  const b=await browser(),a=createLine(b,{x:-10,y:0},{x:10,y:0}),c=createLine(b,{x:20,y:0},{x:30,y:0}),cross=createLine(b,{x:-40,y:10},{x:40,y:10});add(b,[a,c,cross])
  b.launch('Trim')
  b.point(sx(0),sy(0));assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[a.id])
  b.point(sx(25),sy(0),'pointerdown',{ctrlKey:true});assert.deepEqual(new Set(b.read('window.caderactSelection.selectedIds()')),new Set([a.id,c.id]))
  b.point(sx(25),sy(0),'pointerdown',{metaKey:true});assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[a.id])
  drag(b,[300,240],[500,360]);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[a.id])
  drag(b,[500,240],[300,360],{ctrlKey:true});const selected=b.read('window.caderactSelection.selectedIds()');assert.ok(selected.includes(cross.id))
});

test('Enter and quick Space both confirm cutting edges and enter target phase',async()=>{
  const b=await browser(),line=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[line])
  b.launch('Trim');b.point(sx(0),sy(0));finish(b)
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'targets')
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds'),[line.id])

  const c=await browser(),second=createLine(c,{x:-10,y:0},{x:10,y:0});add(c,[second])
  c.launch('Trim');c.point(sx(0),sy(0));c.emit(c.canvas,'pointerenter');c.key(' ',c.input,{code:'Space'});c.emit(c.window,'keyup',{key:' ',code:'Space'})
  assert.equal(c.read('window.caderactCommandRouter.activeSession.phase'),'targets')
});

test('Confirming with no cutting edges selected stays in cutting-edge phase without mutation',async()=>{
  const b=await browser();b.launch('Trim');finish(b)
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
  assert.equal(b.read('window.caderactCommandRouter.activeSession.phase'),'cutting-edges')
});

test('Trim target Line click plans and publishes a trim, keeping the command active for another trim',async()=>{
  const cutter=await browser();
  const edge=createLine(cutter,{x:0,y:-10},{x:0,y:10})
  const target1=createLine(cutter,{x:-10,y:0},{x:10,y:0})
  const target2=createLine(cutter,{x:-10,y:2},{x:10,y:2})
  add(cutter,[edge,target1,target2])
  const before=state(cutter)
  cutter.launch('Trim');cutter.point(sx(0),sy(-8));finish(cutter)
  assert.equal(cutter.read('window.caderactCommandRouter.activeSession.phase'),'targets')
  cutter.point(sx(-5),sy(0))
  assert.equal(cutter.read('window.caderactCommandRouter.activeCommand'),'Trim')
  const afterFirst=plain(cutter.read('modelReader.records()'))
  assert.equal(afterFirst.length,3)
  assert.equal(cutter.read('documentController.historyInfo.entryCount'),before.history+1)
  const survivor1=afterFirst.find(record=>record.id===target1.id)
  assert.ok(survivor1)
  assert.ok(Math.abs(survivor1.start.x-0)<1e-6||Math.abs(survivor1.end.x-0)<1e-6)

  cutter.point(sx(-5),sy(2))
  assert.equal(cutter.read('window.caderactCommandRouter.activeCommand'),'Trim')
  assert.equal(cutter.read('documentController.historyInfo.entryCount'),before.history+2)
  assert.equal(cutter.read('modelReader.records().length'),3)
});

test('Trim target Circle click plans and publishes Circle to Arc',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:-10,y:3},{x:10,y:3}),target=createCircle(b,{x:0,y:0},5);add(b,[edge,target])
  b.launch('Trim');b.point(sx(-9),sy(3));finish(b)
  b.point(sx(0),sy(5))
  const records=plain(b.read('modelReader.records()'))
  const trimmed=records.find(record=>record.id===target.id)
  assert.equal(trimmed.type,'arc')
});

test('Trim target Arc click plans and publishes a trim',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:0,y:-10},{x:0,y:10})
  const target=createArc(b,{center:{x:0,y:0},start:{x:5,y:0},end:{x:0,y:5},radius:5,sweep:Math.PI/2})
  add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  b.point(sx(4.8),sy(1.3))
  const records=plain(b.read('modelReader.records()'))
  const survivor=records.find(record=>record.id===target.id)
  assert.ok(survivor)
});

test('Trim target Polyline click plans and publishes a trim',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:5,y:-10},{x:5,y:10})
  const target=createPolyline(b,[{x:0,y:0},{x:10,y:0},{x:10,y:10}],false)
  add(b,[edge,target])
  b.launch('Trim');b.point(sx(5),sy(-10));finish(b)
  b.point(sx(2),sy(0))
  const records=plain(b.read('modelReader.records()'))
  const survivor=records.find(record=>record.id===target.id)
  assert.ok(survivor)
  assert.equal(survivor.type,'polyline')
});

test('Ellipse target requiring a partial ellipse safely no-ops and keeps Trim active',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:-10,y:5},{x:10,y:5}),target=createEllipse(b,{center:{x:0,y:0},majorAxis:{x:8,y:0},minorRadius:4});add(b,[edge,target])
  const before=state(b)
  b.launch('Trim');b.point(sx(-7),sy(5));finish(b)
  b.point(sx(0),sy(4))
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
  assert.deepEqual(state(b),before)
});

test('An Ellipse can be used as a cutting edge against a supported Line target',async()=>{
  const b=await browser();
  const edge=createEllipse(b,{center:{x:0,y:0},majorAxis:{x:5,y:0},minorRadius:5})
  const target=createLine(b,{x:-10,y:0},{x:10,y:0})
  add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(5));finish(b)
  b.point(sx(-8,),sy(0))
  const records=plain(b.read('modelReader.records()'))
  const survivor=records.find(record=>record.id===target.id)
  assert.ok(survivor)
  assert.ok(Math.abs(Math.abs(survivor.start.x)-5)<1e-4||Math.abs(Math.abs(survivor.end.x)-5)<1e-4)
});

test('No intersection keeps Trim active and makes no mutation, including no history entry',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:100,y:100},{x:110,y:110}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(100),sy(100));finish(b)
  const before=state(b)
  b.point(sx(0),sy(0))
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
  assert.deepEqual(state(b),before)
});

test('Unsupported target type keeps Trim active without mutation',async()=>{
  const b=await browser();
  const edge=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge]);b.launch('Trim');b.point(sx(0),sy(0));finish(b)
  const before=state(b)
  b.point(sx(500),sy(500))
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
  assert.deepEqual(state(b),before)
});

test('Enter and quick Space in target phase finish Trim with no extra history entry',async()=>{
  const b=await browser(),edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b);b.point(sx(-5),sy(0))
  const before=state(b)
  finish(b)
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null)
  assert.deepEqual(state(b),before)

  const c=await browser(),edge2=createLine(c,{x:0,y:-10},{x:0,y:10}),target2=createLine(c,{x:-10,y:0},{x:10,y:0});add(c,[edge2,target2])
  c.launch('Trim');c.point(sx(0),sy(-10));finish(c);c.point(sx(-5),sy(0))
  c.emit(c.canvas,'pointerenter');c.key(' ',c.input,{code:'Space'});c.emit(c.window,'keyup',{key:' ',code:'Space'})
  assert.equal(c.read('window.caderactCommandRouter.activeCommand'),null)
});

test('Escape in cutting-edge phase and in target phase cleans state without mutation or history',async()=>{
  const b=await browser(),line=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[line])
  const before=state(b)
  b.launch('Trim');b.point(sx(0),sy(0));b.key('Escape',b.document)
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null)
  assert.deepEqual(state(b),before)

  const c=await browser(),edge=createLine(c,{x:0,y:-10},{x:0,y:10}),target=createLine(c,{x:-10,y:0},{x:10,y:0});add(c,[edge,target])
  const before2=state(c)
  c.launch('Trim');c.point(sx(0),sy(-10));finish(c);c.key('Escape',c.document)
  assert.equal(c.read('window.caderactCommandRouter.activeCommand'),null)
  assert.deepEqual(state(c),before2)
});

test('Pointer cancel/leave/lost capture does not publish a trim and leaves the command active',async()=>{
  const b=await browser(),edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-10));finish(b)
  const before=state(b)
  b.emit(b.canvas,'pointerleave')
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
  assert.deepEqual(state(b),before)
});

test('Publication failure keeps Trim active, preserves confirmed cutting edges, and allows retry',async()=>{
  const b=await browser(),edge=createLine(b,{x:0,y:-10},{x:0,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,target])
  b.launch('Trim');b.point(sx(0),sy(-8));finish(b)
  const cuttingEdgesBefore=b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds')
  b.run('window.__blocking=documentController.beginTransaction()')
  const before=state(b)
  b.point(sx(-5),sy(0))
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
  assert.deepEqual(state(b),before)
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.confirmedCuttingEdgeIds'),cuttingEdgesBefore)
  b.run('window.__blocking.rollback()')
  b.point(sx(-5),sy(0))
  assert.equal(b.read('modelReader.records().length'),2)
});

test('A missing/stale confirmed cutting-edge ID is ignored safely rather than crashing',async()=>{
  const b=await browser(),edge=createLine(b,{x:0,y:-10},{x:0,y:10}),other=createLine(b,{x:50,y:-10},{x:50,y:10}),target=createLine(b,{x:-10,y:0},{x:10,y:0});add(b,[edge,other,target])
  b.launch('Trim');b.point(sx(0),sy(-10),'pointerdown');b.point(sx(50),sy(-10),'pointerdown',{ctrlKey:true});finish(b)
  b.run(`recordGateway.removeAll(${JSON.stringify([edge.id])})`)
  assert.doesNotThrow(()=>b.point(sx(-5),sy(0)))
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Trim')
});

test('A prior successful trim is authoritative: a subsequent trim in the same command uses current committed geometry',async()=>{
  const b=await browser()
  const edgeA=createLine(b,{x:0,y:-10},{x:0,y:10})
  const edgeB=createLine(b,{x:5,y:-10},{x:5,y:10})
  const target=createLine(b,{x:-10,y:0},{x:15,y:0})
  add(b,[edgeA,edgeB,target])
  b.launch('Trim');b.point(sx(0),sy(-10),'pointerdown');b.point(sx(5),sy(-10),'pointerdown',{ctrlKey:true});finish(b)
  b.point(sx(2),sy(0))
  const middleGone=plain(b.read('modelReader.records()'))
  assert.equal(middleGone.find(record=>Math.abs(record.start?.x)<1e-6&&Math.abs(record.end?.x-5)<1e-6),undefined)
  b.point(sx(10),sy(0))
  const records=plain(b.read('modelReader.records()'))
  const rightSurvivor=records.find(record=>record.type==='line'&&(Math.abs(record.start.x-5)<1e-6||Math.abs(record.end.x-5)<1e-6))
  assert.ok(rightSurvivor)
});

test('Target selection uses the model-space pick, not screen left/right ordering, to choose the removed interval',async()=>{
  const left=await browser()
  const leftEdge=createLine(left,{x:0,y:-10},{x:0,y:10}),leftTarget=createLine(left,{x:-10,y:0},{x:10,y:0});add(left,[leftEdge,leftTarget])
  left.launch('Trim');left.point(sx(0),sy(-10));finish(left);left.point(sx(-5),sy(0))
  const leftRecords=plain(left.read('modelReader.records()'))
  const leftSurvivor=leftRecords.find(record=>record.id===leftTarget.id)

  const right=await browser()
  const rightEdge=createLine(right,{x:0,y:-10},{x:0,y:10}),rightTarget=createLine(right,{x:-10,y:0},{x:10,y:0});add(right,[rightEdge,rightTarget])
  right.launch('Trim');right.point(sx(0),sy(-10));finish(right);right.point(sx(5),sy(0))
  const rightRecords=plain(right.read('modelReader.records()'))
  const rightSurvivor=rightRecords.find(record=>record.id===rightTarget.id)

  assert.notDeepEqual([leftSurvivor.start,leftSurvivor.end],[rightSurvivor.start,rightSurvivor.end])
});

test('Move regression',async()=>{
  const b=await browser(),record=plain(b.run('recordGateway.createLine({x:-20,y:0},{x:20,y:0})'));add(b,[record])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(record.id)})`)
  b.launch('Move');finish(b);b.point(sx(0),sy(0));b.point(sx(10),sy(0),'pointermove');b.point(sx(10),sy(0))
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null)
});

test('Copy regression',async()=>{
  const b=await browser(),record=plain(b.run('recordGateway.createLine({x:-20,y:0},{x:20,y:0})'));add(b,[record])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(record.id)})`)
  b.launch('Copy');finish(b);b.point(sx(0),sy(0));b.point(sx(10),sy(0),'pointermove');b.point(sx(10),sy(0))
  assert.equal(b.read('modelReader.records().length'),2)
});

test('Rotate regression',async()=>{
  const b=await browser(),record=plain(b.run('recordGateway.createLine({x:10,y:0},{x:20,y:0})'));add(b,[record])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(record.id)})`)
  b.launch('Rotate');finish(b);b.point(sx(0),sy(0));b.point(sx(5),sy(0));b.point(sx(0),sy(5))
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null)
});

test('Scale regression',async()=>{
  const b=await browser(),record=plain(b.run('recordGateway.createLine({x:10,y:0},{x:20,y:0})'));add(b,[record])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(record.id)})`)
  b.launch('Scale');finish(b);b.point(sx(0),sy(0));b.point(sx(5),sy(0));b.point(sx(10),sy(0))
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null)
});

test('Delete regression',async()=>{
  const b=await browser(),record=plain(b.run('recordGateway.createLine({x:-20,y:0},{x:20,y:0})'));add(b,[record])
  b.run(`window.caderactSelection.selectOnly(${JSON.stringify(record.id)})`)
  b.launch('Delete');finish(b)
  assert.equal(b.read('modelReader.records().length'),0)
});
