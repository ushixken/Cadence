const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

const parse=(b,text,unit='mm',anchor=null)=>b.read(`window.CaderactPointInput.parseAndResolve(${JSON.stringify(text)},{currentUnit:${JSON.stringify(unit)},anchor:${JSON.stringify(anchor)}})`);
function typed(b,value){b.input.value=value;b.emit(b.input,'input');return b.key('Enter',b.input)}
function near(actual,expected){assert.ok(Math.abs(actual-expected)<1e-10,`${actual} ≈ ${expected}`)}

test('absolute grammar accepts signed finite Cartesian integers, decimals, and whitespace',async()=>{
  const b=await browser();
  for(const [source,x,y] of [['0,0',0,0],['100,50',100,50],['-25,40',-25,40],['10.5,-2.75',10.5,-2.75],['  -10.5 , +20  ',-10.5,20]]){
    const point=parse(b,source);assert.equal(point.status,'point-resolved');assert.equal(point.kind,'point');assert.equal(point.relative,false);assert.equal(point.x,x);assert.equal(point.y,y);
  }
  assert.equal(b.run(`Object.isFrozen(window.CaderactPointInput.parseAndResolve('0,0',{currentUnit:'mm'}))`),true);
});

test('relative resolution supports signed decimals and rejects a missing anchor',async()=>{
  const b=await browser();
  assert.deepEqual(parse(b,'@50,25','mm',{x:100,y:100}),{status:'point-resolved',kind:'point',relative:true,x:150,y:125});
  assert.deepEqual(parse(b,'@-10.5,+2.25','mm',{x:5,y:-4}),{status:'point-resolved',kind:'point',relative:true,x:-5.5,y:-1.75});
  assert.equal(parse(b,'@1,2').reason,'relative-point-without-anchor');
});

test('bare and suffixed components convert independently into every current document unit',async()=>{
  const b=await browser();
  assert.deepEqual(parse(b,'1m,250mm'),{status:'point-resolved',kind:'point',relative:false,x:1000,y:250});
  assert.deepEqual(parse(b,'100CM,250MM','m'),{status:'point-resolved',kind:'point',relative:false,x:1,y:0.25});
  const millimeters={mm:1,cm:10,m:1000,in:25.4,ft:304.8};
  for(const unit of ['mm','cm','m','in','ft']){
    const point=parse(b,'1m,1ft',unit);near(point.x,1000/millimeters[unit]);near(point.y,304.8/millimeters[unit]);
    const bare=parse(b,'12,3',unit);assert.equal(bare.x,12);assert.equal(bare.y,3);
  }
  const imperial=parse(b,'@12in,1ft','in',{x:1,y:2});near(imperial.x,13);near(imperial.y,14);
});

test('malformed, non-finite, extra, and unsupported tokens reject deterministically',async()=>{
  const b=await browser();
  for(const source of ['1,',',2','1,2,3','abc,5','NaN,1','Infinity,2','@','@1','1 2']){
    assert.equal(parse(b,source).status,'invalid-input',source);
  }
  assert.equal(parse(b,'1meters,2').reason,'unsupported-unit');
});

test('fully typed Line shares draft path and publishes once with exact Undo/Redo geometry',async()=>{
  const b=await browser();b.launch();typed(b,'100,100');typed(b,'200,100');typed(b,'200,200');
  assert.equal(b.read('modelReader.lines().length'),0);assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'),2);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.draftSegments().map(x=>[x.start.x,x.start.y,x.end.x,x.end.y])'),[[100,100,200,100],[200,100,200,200]]);
  b.key('Enter',b.input);assert.equal(b.read('documentController.historyInfo.entryCount'),1);const lines=b.read('modelReader.lines()');
  b.run('window.caderactHistory.undo()');assert.equal(b.read('modelReader.lines().length'),0);
  b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.lines()'),lines);
});

test('mixed pointer, absolute, and relative points produce one consistent Line draft',async()=>{
  const b=await browser();b.launch();b.point(400,300);typed(b,'@100,0');b.point(550,250);typed(b,'@0,50');
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.draftSegments().map(x=>[x.start.x,x.start.y,x.end.x,x.end.y])'),[[0,0,100,0],[100,0,30,10],[30,10,30,60]]);
  b.key('Enter',b.input);assert.equal(b.read('modelReader.lines().length'),3);
});

test('invalid typed input preserves Line draft and restores prompt without autocomplete',async()=>{
  const b=await browser();b.launch();typed(b,'@20,10');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.hasFirstPoint'),false);assert.equal(b.commandPrompt.children[0].textContent,'Relative point requires a previous point');
  b.advance(2000);typed(b,'100,100');const before=b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()');
  b.input.value='@20,10';b.emit(b.input,'input');assert.equal(b.suggestions.hidden,true);typed(b,'bad,10');
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Line');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()'),before);
  assert.equal(b.commandPrompt.children[0].textContent,'Coordinate values must be finite numbers');b.advance(2000);assert.equal(b.read('window.caderactFeedback.activePrompt'),'Line: Specify next point');
});

test('typed drafts retain Escape cancellation and Ctrl+Z command-local Step Undo',async()=>{
  const b=await browser();b.launch();typed(b,'0,0');typed(b,'10,0');typed(b,'20,0');
  b.key('z',b.canvas,{ctrlKey:true});assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'),1);
  b.key('Escape');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.equal(b.read('modelReader.lines().length'),0);assert.equal(b.read('documentController.historyInfo.entryCount'),0);
});

test('idle coordinates remain unknown input and existing fuzzy discovery remains safe',async()=>{
  const b=await browser();b.launch('100,50');assert.equal(b.read('window.caderactCommandRouter.lastResult.status'),'unknown-command');assert.equal(b.read('modelReader.lines().length'),0);
  b.input.value='ie';b.emit(b.input,'input');assert.equal(b.suggestions.hidden,false);b.key('Enter',b.input);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.equal(b.read('modelReader.lines().length'),0);
});
