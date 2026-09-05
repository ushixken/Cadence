const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

function registry(b){
  b.run(`window.__ranked=window.CaderactCommandRegistry.createRegistry([
    {name:'Line',aliases:['L'],activate:()=>({})},{name:'Polyline',aliases:['PL'],activate:()=>({})},
    {name:'Scale',aliases:['S'],activate:()=>({})},{name:'Circle',aliases:['C'],activate:()=>({})},
    {name:'Car',aliases:[],activate:()=>({})},{name:'Cat',aliases:[],activate:()=>({})},
    {name:'Rectangle',aliases:['REC'],activate:()=>({})},{name:'Rotate',aliases:['RO'],activate:()=>({})},
    {name:'Mirror',aliases:['MI'],activate:()=>({})},{name:'Move',aliases:['M'],activate:()=>({})}
  ])`);
}

test('active prompt follows the router and Line session without UI command knowledge',async()=>{
  const b=await browser();b.launch();
  assert.equal(b.input.placeholder,'Line: Specify first point');
  b.point(100,100);assert.equal(b.input.placeholder,'Line: Specify next point');
  b.point(150,150);assert.equal(b.input.placeholder,'Line: Specify next point');
  b.key('Enter');assert.equal(b.input.placeholder,'Type a command...');
});

test('temporary error preserves active Line and restores its current prompt after two seconds',async()=>{
  const b=await browser();b.launch();b.point(100,100);
  b.run(`window.caderactFeedback.presentResult(Object.freeze({status:'unknown-command',input:'foo'}))`);
  assert.equal(b.input.placeholder,'Unknown command: foo');assert.equal(b.input.classList.contains('has-command-error'),true);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Line');
  b.advance(1999);assert.equal(b.input.placeholder,'Unknown command: foo');
  b.advance(1);assert.equal(b.input.placeholder,'Line: Specify next point');
  assert.equal(b.input.classList.contains('has-command-error'),false);
});

test('command HUD is bounded to three transient entries and expires without document state',async()=>{
  const b=await browser();const before=b.read('modelReader.snapshot()');
  for(const message of ['one','two','three','four'])b.run(`window.caderactFeedback.addHistory(${JSON.stringify(message)})`);
  assert.deepEqual(b.read('window.caderactFeedback.history.map(entry=>entry.message)'),['two','three','four']);
  assert.equal(b.commandHistory.children.length,3);
  b.advance(3999);assert.equal(b.commandHistory.children.length,3);
  b.advance(1);assert.equal(b.commandHistory.children.length,0);
  assert.deepEqual(b.read('modelReader.snapshot()'),before);
});

test('ranked matching applies exact, alias, prefix, substring, and fuzzy categories',async()=>{
  const b=await browser();registry(b);
  assert.deepEqual(b.read(`window.__ranked.search('Circle').map(x=>[x.command.name,x.category,x.field])`)[0],['Circle',0,'canonical']);
  assert.deepEqual(b.read(`window.__ranked.search('C').map(x=>[x.command.name,x.category,x.field])`)[0],['Circle',1,'alias']);
  assert.deepEqual(b.read(`window.__ranked.search('Pol').map(x=>[x.command.name,x.category])`)[0],['Polyline',2]);
  assert.deepEqual(b.read(`window.__ranked.search('irc').map(x=>[x.command.name,x.category])`)[0],['Circle',4]);
  assert.deepEqual(b.read(`window.__ranked.search('cil').map(x=>[x.command.name,x.category,x.indices])`)[0],['Circle',6,[0,1,4]]);
  assert.deepEqual(b.read(`window.__ranked.search('zzz').map(x=>x.command.name)`),[]);
});

test('ranking tie-breaks deterministically, limits results, and returns immutable metadata',async()=>{
  const b=await browser();registry(b);
  assert.deepEqual(b.read(`window.__ranked.search('ca').map(x=>x.command.name).slice(0,2)`),['Car','Cat']);
  assert.equal(b.read(`window.__ranked.search('i',{limit:3}).length`),3);
  assert.equal(b.run(`Object.isFrozen(window.__ranked.search('cil'))&&Object.isFrozen(window.__ranked.search('cil')[0])&&Object.isFrozen(window.__ranked.search('cil')[0].indices)`),true);
});

test('raw fuzzy input cannot execute, while explicit keyboard selection launches canonical command once',async()=>{
  const b=await browser();let starts=0;const start=b.window.caderactViewport.createLineCommandSession;
  b.window.caderactViewport.createLineCommandSession=()=>{starts++;return start()};
  b.launch('ie');assert.equal(starts,0);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);
  b.input.value='ie';b.emit(b.input,'input');b.key('ArrowDown',b.input);b.key('Enter',b.input);
  assert.equal(starts,1);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Line');
});

test('autocomplete renders matcher-provided highlighted indices without innerHTML',async()=>{
  const b=await browser();b.input.value='ie';b.emit(b.input,'input');
  const button=b.suggestions.children[0];
  assert.equal(button.dataset.commandIndex,'0');
  assert.deepEqual(button.children.map(child=>[child.tag,child.textContent]),[['span','L'],['strong','i'],['span','n'],['strong','e']]);
});
