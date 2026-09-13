'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {browser}=require('../helpers/browser.cjs');
const disableOsnap=b=>{b.snapEnabled.checked=false;b.emit(b.snapEnabled,'change')};

test('Osnap master removes static and contextual semantic candidates from first and later points',async()=>{
  for(const mode of ['endpoint','midpoint','intersection','nearest']){
    const b=await browser();
    b.run('recordGateway.createAll([recordGateway.createLine({x:-20,y:0},{x:20,y:0}),recordGateway.createLine({x:0,y:-20},{x:0,y:20})])');
    if(mode==='nearest')b.run('window.caderactViewport.setObjectSnapMode("nearest",true)');
    disableOsnap(b);b.launch('Line');
    const screen=mode==='endpoint'?[503,298]:mode==='nearest'?[425,302]:[400,302];
    b.point(...screen,'pointermove');
    assert.notEqual(b.read('activeSnapResult?.kind||null'),mode);
    assert.equal(b.read('activeSnapResult.objectSnap||null'),null);
    b.point(...screen);assert.notDeepEqual(b.read('window.caderactCommandRouter.activeSession.draft.firstPoint'),mode==='endpoint'?{x:20,y:0}:{x:0,y:0});
    b.point(503,298,'pointermove');assert.notEqual(b.read('activeSnapResult?.kind||null'),'endpoint');
  }
});

test('Grid remains authoritative and independent of Osnap master and Show Grid',async()=>{
  const grid=await browser();grid.run('window.caderactUserPreferences.set({objectSnapEnabled:false,gridSnapEnabled:true,gridVisible:false})');grid.launch('Line');grid.point(463,238,'pointermove');
  assert.equal(grid.read('activeSnapResult.kind'),'grid');assert.deepEqual(grid.read('activeSnapResult.point'),{x:10,y:10});assert.deepEqual(grid.read('window.caderactViewport.getDynamicInputState().tags'),['Grid']);
  const free=await browser();disableOsnap(free);free.launch('Line');free.point(403,298,'pointermove');assert.equal(free.read('activeSnapResult.snapped'),false);assert.deepEqual(free.read('window.caderactViewport.getDynamicInputState().tags'),[]);
});

test('turning Osnap off clears tracking and stationary semantic feedback, then re-enable starts fresh',async()=>{
  const b=await browser();b.run('recordGateway.createAll([recordGateway.createLine({x:0,y:0},{x:20,y:0})])');b.launch('Line');b.point(400,300,'pointermove');b.advance(500);b.flush();
  assert.ok(b.read('window.caderactViewport.getObjectSnapTrackingState().acquired'));assert.ok(b.read('window.caderactViewport.getDynamicInputState().tags').includes('End'));
  disableOsnap(b);b.flush();assert.equal(b.read('window.caderactViewport.getObjectSnapTrackingState().acquired'),null);assert.notEqual(b.read('activeSnapResult?.kind||null'),'endpoint');assert.equal(b.renders.at(-1).snapOverlay,null);assert.equal(b.read('window.caderactViewport.getDynamicInputState().tags').includes('End'),false);
  b.snapEnabled.checked=true;b.emit(b.snapEnabled,'change');assert.equal(b.read('activeSnapResult.kind'),'endpoint');assert.equal(b.read('window.caderactViewport.getObjectSnapTrackingState().acquired'),null);b.advance(500);assert.ok(b.read('window.caderactViewport.getObjectSnapTrackingState().acquired'));
});

test('HUD snap acquisition labels come from the final marker result',async()=>{
  const midpoint=await browser();midpoint.run('recordGateway.createAll([recordGateway.createLine({x:-20,y:0},{x:20,y:0})])');midpoint.launch('Line');midpoint.point(400,300,'pointermove');midpoint.flush();assert.equal(midpoint.renders.at(-1).snapOverlay.label,'Mid');assert.ok(midpoint.read('window.caderactViewport.getDynamicInputState().tags').includes('Mid'));
  const compound=await browser();compound.run('recordGateway.createAll([recordGateway.createLine({x:-20,y:0},{x:0,y:0}),recordGateway.createLine({x:0,y:-20},{x:0,y:10})])');compound.launch('Line');compound.point(400,300,'pointermove');compound.flush();const label=compound.renders.at(-1).snapOverlay.label;assert.equal(label,'End, Int');assert.ok(compound.read('window.caderactViewport.getDynamicInputState().tags').includes(label));
});
