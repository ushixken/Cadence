const test=require('node:test');
const assert=require('node:assert/strict');
const {browser,settle}=require('../helpers/browser.cjs');

function gridWorldCoordinates(scene,{zoom,panX,panY}){
  const result=[];
  for(const segments of [scene.grid.minorSegments,scene.grid.majorSegments])for(let i=0;i<segments.length;i+=4){
    if(segments[i]===segments[i+2])result.push((segments[i]-panX)/zoom);
    else result.push((panY-segments[i+1])/zoom);
  }
  return result;
}
const close=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);

test('footer exposes exactly supported units from the authoritative document',async()=>{
  const b=await browser();
  assert.deepEqual(b.unitOptions.map(option=>option.dataset.unit),['mm','cm','m','in','ft']);
  assert.equal(b.unitValue.textContent,'mm');
  assert.equal(b.unitOptions.filter(option=>option.classList.contains('is-selected')).length,1);
});

test('footer unit change is one metadata transaction and Undo/Redo refresh UI and grid',async()=>{
  const b=await browser();
  b.launch();b.point(400,300);b.point(500,300);b.key('Enter');b.flush();
  const before=b.read('modelReader.lines()[0]');
  b.run('documentController.markStateSaved(documentController.captureStateToken())');
  b.emit(b.unitOptions[2],'click');b.flush();
  assert.equal(b.unitValue.textContent,'m'); assert.equal(b.read('documentController.historyInfo.entryCount'),2);
  assert.deepEqual(b.read('modelReader.lines()[0]'),before); assert.equal(b.read('documentController.isDirty'),true);
  assert.equal(b.renders.at(-1).grid.unit,'m');
  b.run('window.caderactHistory.undo()');b.flush();
  assert.equal(b.unitValue.textContent,'mm'); assert.equal(b.renders.at(-1).grid.unit,'mm'); assert.equal(b.read('documentController.isDirty'),false);
  b.run('window.caderactHistory.redo()');b.flush();
  assert.equal(b.unitValue.textContent,'m'); assert.equal(b.renders.at(-1).grid.unit,'m'); assert.equal(b.read('documentController.isDirty'),true);
});

test('New and Open rebind footer and grid to the replacement authoritative unit',async()=>{
  const b=await browser();b.emit(b.unitOptions[4],'click');b.flush();
  b.run(`window.__ft=window.CaderactPersistence.serializeDocument(modelReader.snapshot());
    window.__u4Adapters={confirmDiscard:async()=>true,writeFile:async()=>{},pickOpenFile:async()=>({name:'feet.caderact',text:async()=>window.__ft})};
    window.__u4Files=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:window.__u4Adapters})`);
  await b.run('window.__u4Files.newProject()');b.flush();
  assert.equal(b.unitValue.textContent,'mm');assert.equal(b.renders.at(-1).grid.unit,'mm');
  await b.run('window.__u4Files.open()');b.flush();
  assert.equal(b.unitValue.textContent,'ft');assert.equal(b.renders.at(-1).grid.unit,'ft');
});

test('adaptive spacing follows deterministic 1/2/5 thresholds and ignores pan',async()=>{
  const b=await browser();
  for(const [zoom,spacing] of [[28,1],[14,2],[7,5],[2.8,10],[1.4,20],[0.7,50]]){
    b.run(`camera.zoom=${zoom}`);assert.equal(b.run('sceneBuilder.getAdaptiveGridSpacing()'),spacing);
  }
  b.run('camera.zoom=7;camera.panX=-12345;camera.panY=9876');
  assert.equal(b.run('sceneBuilder.getAdaptiveGridSpacing()'),5);
});

test('spacing 1/2/5 levels generate only integer-index world coordinates with stable major classification',async()=>{
  const b=await browser();
  for(const spacing of [1,2,5,10,20,50,100]){
    const zoom=28/spacing,panX=400.25,panY=300.75;b.run(`camera.zoom=${zoom};camera.panX=${panX};camera.panY=${panY}`);
    const scene=b.run('createScene()');assert.equal(scene.grid.minorSpacing,spacing);
    for(const world of gridWorldCoordinates(scene,{zoom,panX,panY}))close(world/spacing,Math.round(world/spacing));
    for(const [group,isMajor] of [[scene.grid.minorSegments,false],[scene.grid.majorSegments,true]])for(let i=0;i<group.length;i+=4){
      const world=group[i]===group[i+2]?(group[i]-panX)/zoom:(panY-group[i+1])/zoom;
      assert.equal(Math.round(world/spacing)%5===0,isMajor);
    }
    assert.equal(scene.lineGroups[2].segments[1],panY);assert.equal(scene.lineGroups[3].segments[0],panX);
  }
});

test('10/20/50/100 transitions share the same origin lattice without cumulative drift',async()=>{
  const b=await browser();const panX=400,panY=300;const snapshots=new Map();
  for(const spacing of [10,20,50,100,50,20,10]){
    const zoom=28/spacing;b.run(`camera.zoom=${zoom};camera.panX=${panX};camera.panY=${panY}`);const scene=b.run('createScene()');
    const coordinates=gridWorldCoordinates(scene,{zoom,panX,panY}).map(value=>Math.round(value*1e9)/1e9).sort((a,c)=>a-c);
    assert.ok(coordinates.every(value=>Number.isInteger(value/spacing)));
    if(snapshots.has(spacing))assert.deepEqual(coordinates,snapshots.get(spacing));else snapshots.set(spacing,coordinates);
  }
  for(const [a,c,common] of [[10,20,20],[20,50,100],[50,100,100]]){
    assert.ok(snapshots.get(a).includes(common));assert.ok(snapshots.get(c).includes(common));
  }
});

test('pan and cursor-centered zoom change projection only, including negative bounds across zero',async()=>{
  const b=await browser();b.run('camera.zoom=2.8;camera.panX=417.25;camera.panY=281.5');
  let scene=b.run('createScene()');for(const world of gridWorldCoordinates(scene,{zoom:2.8,panX:417.25,panY:281.5}))close(world/10,Math.round(world/10));
  b.run('viewportCamera.zoomAtScreenPoint(1.4,123.5,456.25)');const camera=b.read('camera');scene=b.run('createScene()');
  assert.equal(scene.grid.minorSpacing,20);const worlds=gridWorldCoordinates(scene,{zoom:camera.zoom,panX:camera.panX,panY:camera.panY});
  assert.ok(worlds.some(value=>value<0));assert.ok(worlds.some(value=>value>0));for(const world of worlds)close(world/20,Math.round(world/20));

});

test('DPR never changes logical grid coordinates or threshold choice',async()=>{
  const b=await browser();b.run('camera.zoom=1.4;camera.panX=400.25;camera.panY=300.75');let expected;
  for(const dpr of [1,1.25,1.5,2]){b.window.devicePixelRatio=dpr;const scene=b.run('createScene()');const current=gridWorldCoordinates(scene,{zoom:1.4,panX:400.25,panY:300.75});assert.equal(scene.grid.minorSpacing,20);if(expected)assert.deepEqual(current,expected);else expected=current;}
});

test('grid remains world-origin anchored across negative coordinates and pan',async()=>{
  const b=await browser();b.run('camera.zoom=28;camera.panX=400;camera.panY=300;requestRender()');b.flush();
  const first=Array.from(b.renders.at(-1).grid.minorSegments);
  assert.ok(first.some((value,index)=>index%4===0&&value===372));
  assert.ok(first.some((value,index)=>index%4===0&&value===428));
  b.run('camera.panX+=7;requestRender()');b.flush();
  const moved=Array.from(b.renders.at(-1).grid.minorSegments);
  assert.ok(moved.some((value,index)=>index%4===0&&value===379));
  assert.ok(moved.some((value,index)=>index%4===0&&value===435));
});

test('major/minor renderer-neutral contract is explicit and axes stay separate',async()=>{
  const b=await browser();b.flush();const scene=b.renders.at(-1);
  assert.equal(scene.grid.majorMultiple,5);assert.equal(scene.grid.majorSpacing,scene.grid.minorSpacing*5);
  assert.deepEqual(Array.from(scene.lineGroups[0].segments),Array.from(scene.grid.minorSegments));
  assert.ok(scene.grid.majorSegments.length>0);assert.ok(scene.lineGroups[2].segments.length>0);assert.ok(scene.lineGroups[3].segments.length>0);
});

test('visible grid generation is bounded and finite at extreme zoom',async()=>{
  const b=await browser();
  for(const zoom of [Number.MIN_VALUE,1e-300,1e300,Number.MAX_VALUE]){
    b.run(`camera.zoom=${zoom};requestRender()`);b.flush();const scene=b.renders.at(-1);
    assert.ok(Number.isFinite(scene.grid.minorSpacing));
    assert.ok(scene.grid.minorSegments.length+scene.grid.majorSegments.length<=2*scene.grid.maxLinesPerAxis*4);
    assert.ok(Array.from(scene.grid.minorSegments).every(Number.isFinite));
    assert.ok(Array.from(scene.grid.majorSegments).every(Number.isFinite));
  }
});
