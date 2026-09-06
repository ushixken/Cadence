'use strict';const fs=require('node:fs');const {test}=require('node:test');const assert=require('node:assert/strict');const {browser}=require('../helpers/browser.cjs');
function typed(b,value){b.input.value=value;b.emit(b.input,'input');return b.key('Enter',b.input)}
function state(b){return b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty})')}
function tapSpace(b){b.emit(b.canvas,'pointerenter');b.key(' ',b.input,{code:'Space'});b.emit(b.window,'keyup',{key:' ',code:'Space'})}
function promptText(b){const name=b.document.querySelector('#command-name').textContent;const instruction=b.commandPrompt.children[0]?.textContent||b.input.placeholder;return [name,instruction].filter(Boolean).join(' ')}

test('po plus Enter launches deterministic top Polygon suggestion exactly once without invalid feedback',async()=>{
  const b=await browser();b.input.value='po';b.emit(b.input,'input');assert.deepEqual(b.read('window.caderactCommandRegistry.search("po").map(x=>x.command.name).slice(0,2)'),['Polygon','Polyline']);b.key('Enter',b.input);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polygon');assert.equal(b.read('window.caderactCommandRouter.lastResult.status'),'command-started');assert.equal(b.commandHistory.children.filter(child=>child.textContent==='Polygon').length,1);
});

test('prompt and interactive options are composed inside the same command-field shell',async()=>{
  const b=await browser();b.launch('Polygon');assert.equal(b.commandPrompt.parent,b.input.parent);assert.equal(b.commandPrompt.parent.classList.contains('command-input-area'),true);assert.equal(b.input.parent.parent.classList.contains('command-input-wrap'),true);assert.equal(b.commandPrompt.contains(b.commandPrompt.children[0]),true);assert.equal(b.input.value,'');
  typed(b,'5');assert.equal(b.commandPrompt.children[1].tag,'button');assert.equal(b.commandPrompt.children[1].parent,b.commandPrompt);assert.notEqual(promptText(b),b.input.value);
});

test('command-field CSS keeps prompt muted, typed input bright, and options interactive',()=>{
  const css=fs.readFileSync('src/css/editor-page.css','utf8');assert.match(css,/\.command-name\s*\{[^}]*color:var\(--mainText\)/);assert.match(css,/\.command-prompt-instruction\s*\{[^}]*color:var\(--secondaryText\)/);assert.match(css,/\.command-input-wrap\.has-typed-input \.command-prompt-instruction,[\s\S]*?\.command-input-wrap\.has-typed-input \.command-option\s*\{\s*display:none/);assert.doesNotMatch(css,/has-typed-input \.command-prompt\s*\{[^}]*visibility:hidden/);assert.match(css,/\.command-input\s*\{[^}]*color:\s*var\(--mainText\)/);assert.match(css,/\.command-input::placeholder\s*\{[^}]*color:var\(--secondaryText\)/);assert.match(css,/\.command-option\s*\{[^}]*color:#9dc8ef/);assert.match(css,/\.command-option:hover:not\(:disabled\)\s*\{[^}]*color:var\(--mainText\)/);assert.match(css,/\.command-option:focus-visible\s*\{[^}]*outline:/);
});

test('quick Space shares Enter autocomplete acceptance for top, exact, and alias matches',async()=>{
  for(const value of ['po','Polygon','Pol']){
    const b=await browser();b.input.value=value;b.emit(b.input,'input');tapSpace(b);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polygon');assert.equal(b.input.value,'');assert.equal(b.suggestions.hidden,true);assert.equal(b.commandHistory.children.filter(child=>child.textContent==='Polygon').length,1);
  }
});

test('non-empty command Space hold and drag remain navigation-only',async()=>{
  const held=await browser();held.input.value='po';held.emit(held.input,'input');held.emit(held.canvas,'pointerenter');held.key(' ',held.input,{code:'Space'});held.advance(220);held.emit(held.window,'keyup',{key:' ',code:'Space'});assert.equal(held.read('window.caderactCommandRouter.activeCommand'),null);assert.equal(held.input.value,'po');
  const dragged=await browser();dragged.input.value='po';dragged.emit(dragged.input,'input');dragged.emit(dragged.canvas,'pointerenter');const pan=dragged.read('camera.panX');dragged.key(' ',dragged.input,{code:'Space'});dragged.point(200,200,'pointerdown');dragged.point(225,200,'pointermove');dragged.point(225,200,'pointerup');dragged.emit(dragged.window,'keyup',{key:' ',code:'Space'});assert.equal(dragged.read('camera.panX'),pan+25);assert.equal(dragged.read('window.caderactCommandRouter.activeCommand'),null);assert.equal(dragged.input.value,'po');
});

test('Arrow selection and mouse suggestion activation retain the one router launch path',async()=>{
  const keyboard=await browser();keyboard.input.value='po';keyboard.emit(keyboard.input,'input');keyboard.key('ArrowDown',keyboard.input);keyboard.key('Enter',keyboard.input);assert.equal(keyboard.read('window.caderactCommandRouter.activeCommand'),'Polyline');
  const mouse=await browser();mouse.input.value='po';mouse.emit(mouse.input,'input');mouse.emit(mouse.suggestions.children[0],'click');assert.equal(mouse.read('window.caderactCommandRouter.activeCommand'),'Polygon');
});

test('editable text, active prompt, and semantic options are separate presentation state',async()=>{
  const b=await browser();b.launch('Polygon');assert.equal(b.input.value,'');assert.equal(b.input.placeholder,'');assert.equal(promptText(b),'Polygon: Enter number of sides <4>');assert.equal(b.document.querySelector('#command-name').classList.contains('command-name'),true);assert.equal(b.commandPrompt.children[0].classList.contains('command-prompt-instruction'),true);typed(b,'5');assert.equal(b.input.value,'');assert.equal(promptText(b),'Polygon: Specify center of polygon');assert.equal(b.commandPrompt.children[1].textContent,'NumSides=5');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.options'),[{id:'numSides',label:'NumSides',value:'5',enabled:true}]);
});

test('typing hides the passive prompt layer and deleting text restores it without changing prompt state',async()=>{
  const b=await browser();b.launch('Polygon');const original='Polygon: Enter number of sides <4>';assert.equal(promptText(b),original);assert.equal(b.input.parent.parent.classList.contains('has-typed-input'),false);
  b.key('1',b.canvas);assert.equal(b.input.value,'1');assert.equal(b.input.parent.parent.classList.contains('has-typed-input'),true);assert.equal(b.document.querySelector('#command-name').textContent,'Polygon:');assert.equal(b.commandPrompt.children[0].classList.contains('command-prompt-instruction'),true);assert.equal(b.read('window.caderactFeedback.activePrompt'),original);assert.equal(promptText(b),original);
  b.input.value='';b.emit(b.input,'input');assert.equal(b.input.parent.parent.classList.contains('has-typed-input'),false);assert.equal(promptText(b),original);b.key('5',b.canvas);assert.equal(b.input.value,'5');assert.equal(b.input.parent.parent.classList.contains('has-typed-input'),true);
  b.input.value='';b.emit(b.input,'input');b.input.value='5';b.emit(b.input,'input',{inputType:'insertFromPaste'});assert.equal(b.input.parent.parent.classList.contains('has-typed-input'),true);b.input.value='';b.emit(b.input,'input',{inputType:'deleteByCut'});assert.equal(b.input.parent.parent.classList.contains('has-typed-input'),false);assert.equal(promptText(b),original);
});

test('invalid Polygon input overlays then restores the exact authoritative prompt and options',async()=>{
  const b=await browser();b.launch('Polygon');const original='Polygon: Enter number of sides <4>';const beforeOptions=b.read('window.caderactFeedback.activeOptions');typed(b,'2');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polygon');assert.equal(promptText(b),'Polygon: side count must be an integer from 3 to 1024');assert.equal(b.commandPrompt.classList.contains('is-error'),true);assert.equal(b.read('window.caderactFeedback.activePrompt'),original);assert.deepEqual(b.read('window.caderactFeedback.activeOptions'),beforeOptions);b.advance(2000);assert.equal(promptText(b),original);assert.equal(promptText(b).includes('integer number'),false);assert.equal(b.commandPrompt.classList.contains('is-error'),false);typed(b,'5');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.sideCount'),5);
  const centerPrompt='Polygon: Specify center of polygon';const centerOptions=[{id:'numSides',label:'NumSides',value:'5',enabled:true}];typed(b,'bad');assert.equal(b.read('window.caderactFeedback.activePrompt'),centerPrompt);assert.deepEqual(b.read('window.caderactFeedback.activeOptions'),centerOptions);assert.equal(promptText(b),'Polygon: Enter a point as x,y');b.advance(2000);assert.equal(promptText(b),centerPrompt);assert.equal(b.commandPrompt.children[1].textContent,'NumSides=5');assert.deepEqual(b.read('window.caderactFeedback.activeOptions'),centerOptions);
});

test('clicking NumSides before center edits transient count, retains default on empty Enter, and restores focus',async()=>{
  const b=await browser(),before=state(b);b.launch('Polygon');typed(b,'5');const option=b.commandPrompt.children[1];assert.equal(option.tag,'button');assert.equal(option.getAttribute('aria-label'),'NumSides, current value 5');b.emit(option,'click');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polygon');assert.equal(b.read('window.caderactCommandRouter.activeSession.acceptsEmptyInput'),true);assert.equal(b.read('window.caderactFeedback.activePrompt'),'Polygon: Enter number of sides <5>');assert.equal(b.document.activeElement,b.input);b.key('Enter',b.input);assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.sideCount'),5);assert.equal(b.read('window.caderactFeedback.activePrompt'),'Polygon: Specify center of polygon');assert.deepEqual(state(b),before);
});

test('valid and invalid option edits route to Polygon without generic invalid-command feedback',async()=>{
  const b=await browser(),before=state(b);b.launch('Polygon');typed(b,'5');b.emit(b.commandPrompt.children[1],'click');typed(b,'2.5');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Polygon');assert.equal(b.read('window.caderactCommandRouter.lastResult.reason'),'integer-required');assert.equal(b.read('window.caderactCommandRouter.lastResult.message'),'Polygon side count must be an integer from 3 to 1024');assert.equal(b.read('window.caderactCommandRouter.lastResult.status'),'invalid-input');assert.deepEqual(state(b),before);typed(b,'8');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.sideCount'),8);assert.equal(b.read('window.caderactFeedback.activePrompt'),'Polygon: Specify center of polygon');
});

test('NumSides remains editable after center and recomputes preview without moving center or document state',async()=>{
  const b=await browser(),before=state(b);b.launch('Polygon');typed(b,'5');typed(b,'2,3');b.point(450,285,'pointermove');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.previewEdges().length'),5);const center=b.read('window.caderactCommandRouter.activeSession.draft.center');const option=b.commandPrompt.children[1];assert.equal(option.textContent,'NumSides=5');b.emit(option,'click');typed(b,'8');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.center'),center);assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.previewEdges().length'),8);assert.equal(b.read('window.caderactFeedback.activePrompt'),'Polygon: Specify radius point');assert.equal(b.commandPrompt.children[1].textContent,'NumSides=8');assert.deepEqual(state(b),before);
});

test('command name persists while coordinate input replaces instruction and temporarily suppresses options',async()=>{
  const b=await browser();b.launch('Polygon');typed(b,'5');assert.equal(b.document.querySelector('#command-name').textContent,'Polygon:');assert.equal(b.commandPrompt.children[0].textContent,'Specify center of polygon');assert.equal(b.commandPrompt.children[1].textContent,'NumSides=5');b.input.value='100,200';b.emit(b.input,'input');assert.equal(b.input.value,'100,200');assert.equal(b.input.parent.parent.classList.contains('has-typed-input'),true);assert.equal(b.document.querySelector('#command-name').textContent,'Polygon:');assert.equal(b.read('window.caderactFeedback.activePrompt'),'Polygon: Specify center of polygon');assert.deepEqual(b.read('window.caderactFeedback.activeOptions'),[{id:'numSides',label:'NumSides',value:'5',enabled:true}]);b.input.value='';b.emit(b.input,'input');assert.equal(promptText(b),'Polygon: Specify center of polygon');assert.equal(b.commandPrompt.children[1].textContent,'NumSides=5');
});

test('all command prompts stay outside input while ordinary active numeric input remains session-owned',async()=>{
  const b=await browser();b.launch('Polygon');b.input.value='6';b.emit(b.input,'input');assert.equal(b.input.value,'6');assert.equal(promptText(b),'Polygon: Enter number of sides <4>');assert.equal(b.suggestions.hidden,true);b.key('Enter',b.input);assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.sideCount'),6);b.key('Escape');b.launch('Line');assert.equal(b.input.value,'');assert.equal(b.input.placeholder,'');assert.equal(promptText(b),'Line: Specify first point');
});
