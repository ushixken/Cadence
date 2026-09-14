const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

function modes(b,enabled){for(const kind of ['endpoint','vertex','midpoint','center','intersection','quadrant','perpendicular','tangent','nearest'])b.run(`window.caderactViewport.setObjectSnapMode(${JSON.stringify(kind)},${enabled.includes(kind)})`)}
function move(b,x,y){b.point(x,y,'pointermove');return b.read('activeSnapResult')}

test('Nearest is fallback to Endpoint, Midpoint, Center, Intersection, Quadrant, and Vertex inside aperture',async()=>{
  const cases=[
    {k:'endpoint',seed:`recordGateway.createAll([recordGateway.createLine({x:0,y:0},{x:20,y:0})])`,at:[406,299],point:{x:0,y:0}},
    {k:'midpoint',seed:`recordGateway.createAll([recordGateway.createLine({x:-10,y:0},{x:10,y:0})])`,at:[406,299],point:{x:0,y:0}},
    {k:'center',seed:`recordGateway.createAll([recordGateway.createCircle({x:0,y:0},2)])`,at:[409,300],point:{x:0,y:0}},
    {k:'intersection',seed:`recordGateway.createAll([recordGateway.createLine({x:-20,y:0},{x:20,y:0}),recordGateway.createLine({x:0,y:-20},{x:0,y:20})])`,at:[406,299],point:{x:0,y:0}},
    {k:'quadrant',seed:`recordGateway.createAll([recordGateway.createCircle({x:0,y:0},10)])`,at:[449,294],point:{x:10,y:0}},
    {k:'vertex',seed:`recordGateway.createAll([recordGateway.createPolyline([{x:0,y:0},{x:20,y:0}],false)])`,at:[406,299],point:{x:0,y:0}},
  ];
  for(const item of cases){const b=await browser();b.run(item.seed);modes(b,[item.k,'nearest']);b.launch('Line');const result=move(b,...item.at);assert.equal(result.kind,item.k);assert.deepEqual(result.point,item.point)}
});

test('Nearest wins outside semantic aperture and remains useful as the only mode on every supported curve',async()=>{
  const outside=await browser();outside.run(`recordGateway.createAll([recordGateway.createLine({x:0,y:0},{x:40,y:0})])`);modes(outside,['endpoint','nearest']);outside.launch('Line');assert.equal(move(outside,420,302).kind,'nearest');
  for(const [seed,at] of [[`recordGateway.createLine({x:-20,y:0},{x:20,y:0})`,[425,302]],[`recordGateway.createCircle({x:0,y:0},10)`,[451,302]],[`recordGateway.createArc({center:{x:0,y:0},radius:10,start:{x:10,y:0},end:{x:0,y:10},sweep:Math.PI/2})`,[445,278]],[`recordGateway.createPolyline([{x:-20,y:0},{x:20,y:0}],false)`,[425,302]]]){const b=await browser();b.run(`recordGateway.createAll([${seed}])`);modes(b,['nearest']);b.launch('Line');assert.equal(move(b,...at).kind,'nearest')}
});

test('Nearest cannot steal a shallow Line intersection and compound metadata is preserved',async()=>{const shallow=await browser();shallow.run(`recordGateway.createAll([recordGateway.createLine({x:-40,y:-2},{x:40,y:2}),recordGateway.createLine({x:-40,y:2},{x:40,y:-2})])`);modes(shallow,['intersection','nearest']);shallow.launch('Line');assert.equal(move(shallow,406,300).kind,'intersection');const compound=await browser();compound.run(`recordGateway.createAll([recordGateway.createLine({x:-20,y:0},{x:0,y:0}),recordGateway.createLine({x:0,y:-20},{x:0,y:10})])`);modes(compound,['endpoint','intersection','nearest']);compound.launch('Line');const result=move(compound,405,299);assert.equal(result.kind,'endpoint');assert.deepEqual(result.kinds,['endpoint','intersection']);assert.equal(result.references.length,2)});

test('semantic aperture remains 10 CSS px across zoom and directions with Nearest enabled',async()=>{for(const zoom of [2,5,20])for(const offset of [[8,0],[-8,0],[0,8],[0,-8],[6,6]]){const b=await browser();b.run(`camera.zoom=${zoom};recordGateway.createAll([recordGateway.createCircle({x:0,y:0},10)])`);modes(b,['center','nearest']);b.launch('Line');assert.equal(move(b,400+offset[0],300+offset[1]).kind,'center')}});

test('marker, CAD crosshair, preview, HUD, and accepted point share the final semantic coordinate',async()=>{const b=await browser();b.run(`recordGateway.createAll([recordGateway.createLine({x:0,y:0},{x:20,y:0})])`);modes(b,['endpoint','nearest']);b.launch('Line');b.run(`window.caderactCommandRouter.submitActiveInput('-10,10')`);const result=move(b,406,299);b.flush();assert.deepEqual(result.point,{x:0,y:0});assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'),{x:0,y:0});assert.deepEqual(b.read('window.caderactViewport.getDynamicInputState().fields.map(x=>x.value)'),['14.142','-45.00°']);assert.deepEqual({x:b.renders.at(-1).snapOverlay.point.x,y:b.renders.at(-1).snapOverlay.point.y},{x:400,y:300});assert.deepEqual(b.read('window.caderactViewport.getInteractionVisualState()'),{visible:true,x:410,y:310,mode:'point',snapAcquired:true,available:true,navigating:false});b.point(406,299);assert.deepEqual(b.read('modelReader.lines().at(-1).end'),{x:0,y:0,featureId:b.read('modelReader.lines().at(-1).end.featureId')})});

test('Osnap master disables Nearest and semantics while Grid remains independent',async()=>{const b=await browser();b.run(`recordGateway.createAll([recordGateway.createLine({x:0,y:0},{x:20,y:0})]);window.caderactUserPreferences.set({objectSnapEnabled:false,gridSnapEnabled:true})`);b.launch('Line');const result=move(b,406,299);assert.equal(result.kind,'grid');assert.equal(result.objectSnap,null)});
