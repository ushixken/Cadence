'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser,Element,settle}=require('../helpers/browser.cjs');

function typed(b,value){b.input.value=value;b.emit(b.input,'input');return b.key('Enter',b.input)}
function complete(b,command){
  b.launch(command)
  if(command==='Line'){typed(b,'0,0');typed(b,'10,0');b.key('Enter')}
  else if(command==='Rectangle'){typed(b,'0,0');typed(b,'10,10')}
  else if(command==='Polyline'){typed(b,'0,0');typed(b,'10,0');b.key('Enter')}
  else if(command==='Circle'){typed(b,'0,0');typed(b,'10,0')}
}
function enterViewport(b){b.emit(b.canvas,'pointerenter')}
function spaceDown(b,props={}){return b.key(' ',b.canvas,{code:'Space',...props})}
function spaceUp(b,target=b.window,props={}){return b.emit(target,'keyup',{key:' ',code:'Space',...props})}
function tapSpace(b,props={}){spaceDown(b,props);spaceUp(b,b.window,props)}

test('quick Space tap repeats each drawing command exactly once through the router',async()=>{
  for(const command of ['Line','Rectangle','Polyline','Circle']){
    const b=await browser();complete(b,command);assert.equal(b.read('window.caderactCommandRouter.lastRepeatableCommand'),command);enterViewport(b);
    const before=b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,history:documentController.historyInfo})');tapSpace(b);
    assert.equal(b.read('window.caderactCommandRouter.activeCommand'),command);assert.deepEqual(b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,history:documentController.historyInfo})'),before);
  }
});

test('aliases and autocomplete store canonical repeat identities',async()=>{
  for(const [input,canonical] of [['Rect','Rectangle'],['PL','Polyline'],['Pline','Polyline'],['C','Circle']]){
    const b=await browser();b.launch(input);assert.equal(b.read('window.caderactCommandRouter.lastRepeatableCommand'),canonical);
  }
  const b=await browser();b.input.value='cir';b.emit(b.input,'input');b.key('Enter',b.input);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Circle');assert.equal(b.read('window.caderactCommandRouter.lastRepeatableCommand'),'Circle');
});

test('Space held through the 220ms threshold becomes navigation intent and does not repeat',async()=>{
  const b=await browser();complete(b,'Rectangle');enterViewport(b);spaceDown(b);assert.deepEqual(b.read('navigation.getSpaceState()'),{isDown:true,consumed:false,held:false});
  b.advance(219);assert.equal(b.read('navigation.getSpaceState().held'),false);b.advance(1);assert.equal(b.read('navigation.getSpaceState().held'),true);
  spaceUp(b);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.deepEqual(b.read('navigation.getSpaceState()'),{isDown:false,consumed:false,held:false});
});

test('Space pan consumes the interaction, preserves navigation, and never repeats on release',async()=>{
  const b=await browser();complete(b,'Circle');enterViewport(b);const before=b.read('camera.panX');spaceDown(b);
  b.point(200,200,'pointerdown');assert.equal(b.read('navigation.getSpaceState().consumed'),true);b.point(235,180,'pointermove');assert.equal(b.read('camera.panX'),before+35);
  b.point(235,180,'pointerup');spaceUp(b);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);
});

test('Ctrl+Space drag zoom is preserved and modified Space never repeats',async()=>{
  const b=await browser();complete(b,'Line');enterViewport(b);const before=b.read('camera.zoom');spaceDown(b,{ctrlKey:true});b.point(200,200,'pointerdown',{ctrlKey:true});
  b.point(230,200,'pointermove',{ctrlKey:true});b.point(230,200,'pointerup',{ctrlKey:true});spaceUp(b,b.window,{ctrlKey:true});
  assert.ok(b.read('camera.zoom')>before);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);
});

test('keyboard repeat events cannot launch duplicates',async()=>{
  const b=await browser();complete(b,'Rectangle');enterViewport(b);spaceDown(b);spaceDown(b,{repeat:true});spaceDown(b,{repeat:true});spaceUp(b);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Rectangle');
  const session=b.window.caderactCommandRouter.activeSession;spaceDown(b,{repeat:true});spaceUp(b);assert.equal(b.window.caderactCommandRouter.activeSession,session);
});

test('active command has priority and Space submits rather than repeating another session',async()=>{
  const b=await browser();b.launch('Line');enterViewport(b);tapSpace(b);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);assert.equal(b.read('window.caderactCommandRouter.lastResult.status'),'command-completed');
});

test('Escape preserves the last drawing command for repetition',async()=>{
  const b=await browser();b.launch('Line');b.key('Escape');assert.equal(b.read('window.caderactCommandRouter.lastRepeatableCommand'),'Line');enterViewport(b);tapSpace(b);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Line');
});

test('unknown and non-repeatable actions do not replace or erase the last drawing command',async()=>{
  const b=await browser();b.launch('Rect');b.key('Escape');b.launch('NotACommand');assert.equal(b.read('window.caderactCommandRouter.lastRepeatableCommand'),'Rectangle');
  b.run('window.caderactHistory.undo()');assert.equal(b.read('window.caderactCommandRouter.lastRepeatableCommand'),'Rectangle');
  const registry=b.window.CaderactCommandRegistry.createRegistry([{name:'Save',repeatable:false,activate:()=>({name:'Save',finish:()=>({status:'command-completed'}),cancel:()=>({status:'command-cancelled'})})}]);
  const router=b.window.CaderactCommandRouter.createRouter({registry,setPrompt(){}});router.execute('Save');router.finishActive();assert.equal(router.lastRepeatableCommand,null);
  assert.equal(router.repeatLastCommand().reason,'no-repeatable-command');
});

test('editable fields retain Space and never trigger repeat',async()=>{
  for(const [tag,editable] of [['input',false],['textarea',false],['select',false],['div',true]]){
    const b=await browser();complete(b,'Circle');enterViewport(b);const field=new Element(tag);field.owner=b.document;field.parent=b.document;field.isContentEditable=editable;
    const down=b.key(' ',field,{code:'Space'});const up=b.emit(field,'keyup',{key:' ',code:'Space'});
    assert.equal(down.defaultPrevented,false);assert.equal(up.defaultPrevented,false);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);
  }
});

test('renderer recovery preserves last-command identity and does not duplicate Space bindings',async()=>{
  const b=await browser();b.launch('PL');b.key('Escape');const recovered={render:scene=>b.renders.push(scene),resize(){}};b.window.createCaderactRenderer=async()=>recovered;
  b.fakeRenderer.onDeviceLost();await settle();enterViewport(b);tapSpace(b);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polyline');
  assert.equal(b.read('window.caderactCommandRouter.lastRepeatableCommand'),'Polyline');
});

test('repeat identity is transient and survives New, Open, Save, and Undo lifecycle actions',async()=>{
  const b=await browser();b.launch('Rectangle');b.key('Escape');const before=b.read('modelReader.snapshot()');
  b.run(`window.__saved=[];window.__source=window.CaderactPersistence.serializeDocument(modelReader.snapshot());
    window.__repeatFiles=window.CaderactFileActions.createActions({session:window.caderactDocumentSession,
      commandRouter:window.caderactCommandRouter,viewport:window.caderactViewport,adapters:{confirmDiscard:async()=>true,
      writeFile:async value=>{window.__saved.push(value);},pickOpenFile:async()=>({name:'Repeat.caderact',text:async()=>window.__source})}})`);
  assert.equal((await b.run('window.__repeatFiles.save()')).status,'save-completed');
  assert.equal((await b.run('window.__repeatFiles.newProject()')).status,'new-completed');
  assert.equal((await b.run('window.__repeatFiles.open()')).status,'open-completed');
  b.run('window.caderactHistory.undo()');assert.deepEqual(b.read('modelReader.snapshot()'),before);assert.equal(b.read('window.caderactCommandRouter.lastRepeatableCommand'),'Rectangle');
  assert.equal(JSON.stringify(b.read('modelReader.snapshot()')).includes('lastRepeatableCommand'),false);
});
