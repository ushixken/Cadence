const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

const minimums={mm:1,cm:.1,m:.001,in:1/16,ft:1/192};

test('minimum grid policy is deterministic for every supported length unit',async()=>{
  const b=await browser();assert.deepEqual(b.read('window.CaderactGridPolicy.minimumByLengthUnit'),minimums);
  for(const [unit,minimum] of Object.entries(minimums))assert.equal(b.run(`window.CaderactGridPolicy.minimumGridSpacing("${unit}")`),minimum);
  assert.throws(()=>b.run('window.CaderactGridPolicy.minimumGridSpacing("unknown")'),/Unsupported grid length unit/);
});

test('normal 1/2/5 density behavior remains, then millimeter spacing clamps at one',async()=>{
  const b=await browser();
  for(const [percent,spacing] of [[500,10],[1000,5],[1400,2],[2000,2],[5000,1],[10000,1],[100000,1]]){
    b.run(`camera.zoom=${percent}/100`);assert.equal(b.run('sceneBuilder.getAdaptiveGridSpacing()'),spacing);
  }
  b.run('camera.zoom=50');const first=b.run('createScene()');
  b.run('camera.zoom=100');const second=b.run('createScene()');
  assert.equal(first.grid.minorSpacing,1);assert.equal(second.grid.minorSpacing,1);
  assert.equal(50*first.grid.minorSpacing,50);assert.equal(100*second.grid.minorSpacing,100);
});

test('effective spacing never crosses the current-unit minimum and remains origin anchored',async()=>{
  const b=await browser();
  for(const [unit,minimum] of Object.entries(minimums)){
    b.run(`unitGateway.setLengthUnit("${unit}");camera.zoom=1e9;camera.panX=400.25;camera.panY=300.75`);
    const scene=b.run('createScene()');assert.equal(scene.grid.minorSpacing,minimum);
    for(const segments of [scene.grid.minorSegments,scene.grid.majorSegments])for(let i=0;i<segments.length;i+=4){
      const world=segments[i]===segments[i+2]?(segments[i]-400.25)/1e9:(300.75-segments[i+1])/1e9;
      assert.ok(Math.abs(world/minimum-Math.round(world/minimum))<1e-4);
    }
  }
});

test('minimum lattice survives pan, cursor zoom, DPR and drives the same Grid Snap target',async()=>{
  const b=await browser();b.run('camera.zoom=100;camera.panX=417.25;camera.panY=281.5');
  for(const dpr of [1,1.25,1.5,2]){
    b.window.devicePixelRatio=dpr;b.run('activeSnapResult=snapResolver.resolve({rawWorldPoint:{x:1.03,y:-1.04},worldToScreen,records:[],gridSpacing:sceneBuilder.getAdaptiveGridSpacing(),enabled:{grid:true}})');
    const scene=b.run('createScene()');assert.equal(scene.grid.minorSpacing,1);assert.deepEqual(b.read('activeSnapResult.point'),{x:1,y:-1});
    assert.equal(scene.snapOverlay.point.x,417.25+100);assert.equal(scene.snapOverlay.point.y,281.5+100);
  }
  b.run('viewportCamera.zoomAtScreenPoint(200,123.5,456.25)');assert.equal(b.run('sceneBuilder.getAdaptiveGridSpacing()'),1);
  assert.deepEqual(b.read('snapResolver.resolve({rawWorldPoint:{x:-1.02,y:2.01},worldToScreen,records:[],gridSpacing:sceneBuilder.getAdaptiveGridSpacing(),enabled:{grid:true}}).point'),{x:-1,y:2});
});

test('the 1400 percent transition remains exact and grid evaluation is derived-only',async()=>{
  const b=await browser();const before=b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})');
  b.run('camera.zoom=14;camera.panX=400;camera.panY=300');const scene=b.run('createScene()');assert.equal(scene.grid.minorSpacing,2);
  const vertical=[...scene.grid.minorSegments,...scene.grid.majorSegments].filter((_,index)=>index%4===0);assert.ok(vertical.includes(428));assert.ok(vertical.includes(372));
  b.run('activeSnapResult=snapResolver.resolve({rawWorldPoint:{x:2.01,y:1.99},worldToScreen,records:[],gridSpacing:sceneBuilder.getAdaptiveGridSpacing(),enabled:{grid:true}})');const marked=b.run('createScene()');
  assert.deepEqual(b.read('activeSnapResult.point'),{x:2,y:2});assert.deepEqual({x:marked.snapOverlay.point.x,y:marked.snapOverlay.point.y},{x:428,y:272});
  assert.deepEqual(b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})'),before);
});
