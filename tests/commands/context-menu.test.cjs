const test=require('node:test');
const assert=require('node:assert/strict');
const {browser,Element}=require('../helpers/browser.cjs');

function typed(b,value){b.input.value=value;b.emit(b.input,'input');b.key('Enter',b.input)}
function line(b,a,z){b.launch();typed(b,`${a.x},${a.y}`);typed(b,`${z.x},${z.y}`);b.key('Enter',b.input);return b.read('modelReader.lines().at(-1).id')}
function openCanvas(b,x,y){return b.emit(b.canvas,'contextmenu',{clientX:20+x,clientY:40+y})}
function items(b){return b.contextMenu.children.filter(child=>child.getAttribute('role')==='menuitem')}
function labels(b){return items(b).map(item=>item.textContent)}
function item(b,label){return items(b).find(candidate=>candidate.textContent===label)}

test('canvas context selection preserves a selected set, replaces on an editable hit, and preserves on empty or locked hits',async()=>{
  const b=await browser(),first=line(b,{x:-20,y:0},{x:20,y:0}),second=line(b,{x:-20,y:20},{x:20,y:20});
  b.run(`window.caderactSelection.applyRecordIds(${JSON.stringify([first,second])})`);
  let event=openCanvas(b,400,300);assert.equal(event.defaultPrevented,true);assert.deepEqual(b.read('window.caderactSelection.selectedIds()').sort(),[first,second].sort());assert.equal(b.read('window.caderactContextMenu.getState().context.type'),'selection');
  b.window.caderactContextMenu.close();b.run(`window.caderactSelection.selectOnly(${JSON.stringify(first)})`);openCanvas(b,400,200);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[second]);
  b.window.caderactContextMenu.close();openCanvas(b,700,500);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[second]);assert.equal(b.read('window.caderactContextMenu.getState().context.type'),'canvas');
  b.window.caderactContextMenu.close();b.run(`layerGateway.create('Locked');window.__locked=modelReader.layers().find(layer=>layer.name==='Locked');recordGateway.assignLayer([${JSON.stringify(first)}],window.__locked.id);layerGateway.setLocked(window.__locked.id,true);window.caderactSelection.clear()`);openCanvas(b,400,300);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[]);assert.equal(b.read('window.caderactContextMenu.getState().context.type'),'canvas');assert.equal(b.read('window.caderactContextMenu.getState().context.lockedRecordId'),first)
});

test('geometry and empty-canvas menus expose only implemented semantic actions',async()=>{
  const b=await browser();line(b,{x:-20,y:0},{x:20,y:0});openCanvas(b,400,300);
  assert.deepEqual(labels(b),['Move','Copy','Rotate','Scale','Mirror','Assign to Current Layer','Delete']);
  b.window.caderactContextMenu.close();openCanvas(b,700,500);assert.deepEqual(labels(b),['Repeat Line','Select All']);assert.equal(labels(b).includes('Zoom Extents'),false)
});

test('geometry actions route through existing command and layer authorities without menu mutation',async()=>{
  for(const name of ['Move','Copy','Rotate','Scale','Mirror','Delete']){const b=await browser();line(b,{x:-20,y:0},{x:20,y:0});openCanvas(b,400,300);b.emit(item(b,name),'click');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),name);assert.equal(b.contextMenu.hidden,true)}
  const b=await browser(),id=line(b,{x:-20,y:0},{x:20,y:0});b.run(`layerGateway.create('Target');layerGateway.setCurrent(modelReader.layers().find(layer=>layer.name==='Target').id)`);const before=b.read('({revision:documentController.currentRevision,history:documentController.historyInfo})');openCanvas(b,400,300);assert.deepEqual(b.read('({revision:documentController.currentRevision,history:documentController.historyInfo})'),before);b.emit(item(b,'Assign to Current Layer'),'click');assert.equal(b.read(`modelReader.records().find(record=>record.id===${JSON.stringify(id)}).layerId===modelReader.snapshot().currentLayerId`),true)
});

test('empty canvas Select All and Repeat Last use their existing authorities',async()=>{
  const b=await browser(),first=line(b,{x:-20,y:0},{x:20,y:0}),second=line(b,{x:-20,y:20},{x:20,y:20});b.run('window.caderactSelection.clear()');openCanvas(b,700,500);b.emit(item(b,'Select All'),'click');assert.deepEqual(b.read('window.caderactSelection.selectedIds()').sort(),[first,second].sort());
  openCanvas(b,700,500);b.emit(item(b,'Repeat Line'),'click');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Line')
});

test('layer-row menu targets the clicked row without implicitly changing current layer',async()=>{
  const b=await browser();b.run(`window.caderactLayers.create('Target')`);const target=b.read(`modelReader.layers().find(layer=>layer.name==='Target').id`),current=b.read('modelReader.snapshot().currentLayerId');
  const row=b.layersList.children.find(child=>child.dataset.layerId===target),event=b.emit(row,'contextmenu',{clientX:100,clientY:100});assert.equal(event.defaultPrevented,true);assert.equal(b.read('modelReader.snapshot().currentLayerId'),current);assert.deepEqual(labels(b),['Set Current','Assign Selection','Rename','Delete','Hide','Lock']);assert.equal(item(b,'Assign Selection').disabled,true);
  b.emit(item(b,'Set Current'),'click');assert.equal(b.read('modelReader.snapshot().currentLayerId'),target);b.emit(row,'contextmenu',{clientX:100,clientY:100});b.emit(item(b,'Rename'),'click');assert.ok(row.parent.children.some(child=>child.dataset.layerId===target))
});

test('layer menu actions reuse assignment, visibility, locking, and delete capability policies',async()=>{
  const b=await browser(),id=line(b,{x:-20,y:0},{x:20,y:0});b.run(`window.caderactLayers.create('Target');window.caderactSelection.selectOnly(${JSON.stringify(id)})`);const target=b.read(`modelReader.layers().find(layer=>layer.name==='Target').id`),row=()=>b.layersList.children.find(child=>child.dataset.layerId===target),open=()=>b.emit(row(),'contextmenu',{clientX:100,clientY:100});
  open();b.emit(item(b,'Assign Selection'),'click');assert.equal(b.read(`modelReader.records().find(record=>record.id===${JSON.stringify(id)}).layerId`),target);open();assert.equal(item(b,'Delete').disabled,true);b.emit(item(b,'Hide'),'click');assert.equal(b.read(`modelReader.layer(${JSON.stringify(target)}).visible`),false);open();b.emit(item(b,'Show'),'click');open();b.emit(item(b,'Lock'),'click');assert.equal(b.read(`modelReader.layer(${JSON.stringify(target)}).locked`),true);open();b.emit(item(b,'Unlock'),'click');assert.equal(b.read(`modelReader.layer(${JSON.stringify(target)}).locked`),false)
});

test('disabled menu items cannot activate by pointer or keyboard',async()=>{
  const b=await browser();openCanvas(b,700,500);const selectAll=item(b,'Select All');assert.equal(selectAll.disabled,true);b.emit(selectAll,'click');assert.equal(b.read('window.caderactContextMenu.getState().open'),true);b.key('Enter',b.contextMenu);assert.equal(b.read('window.caderactContextMenu.getState().open'),true);assert.deepEqual(b.read('window.caderactSelection.selectedIds()'),[])
});

test('menu clamps, supports keyboard navigation, restores focus, and closes on outside pointer or blur',async()=>{
  const b=await browser();line(b,{x:-20,y:0},{x:20,y:0});openCanvas(b,400,300);assert.equal(b.document.activeElement.textContent,'Move');b.key('ArrowDown',b.contextMenu);assert.equal(b.document.activeElement.textContent,'Copy');b.key('End',b.contextMenu);assert.equal(b.document.activeElement.textContent,'Delete');b.key('Escape',b.contextMenu);assert.equal(b.contextMenu.hidden,true);assert.equal(b.document.activeElement,b.canvas);
  openCanvas(b,9999,9999);const state=b.read('window.caderactContextMenu.getState()');assert.ok(state.x>=8&&state.x<=836);assert.ok(state.y>=8&&state.y<=758);b.emit(b.document,'pointerdown',{target:b.canvas});assert.equal(b.contextMenu.hidden,true);openCanvas(b,400,300);b.emit(b.window,'blur');assert.equal(b.contextMenu.hidden,true)
});

test('active commands and editable layer fields retain their native context behavior',async()=>{
  const b=await browser();line(b,{x:-20,y:0},{x:20,y:0});b.launch();let event=openCanvas(b,400,300);assert.equal(event.defaultPrevented,false);assert.equal(b.contextMenu.hidden,true);b.key('Escape');b.point(400,300);b.point(300,300);event=openCanvas(b,300,300);assert.equal(event.defaultPrevented,false);assert.equal(b.contextMenu.hidden,true);b.point(300,300,'pointerup');b.run(`window.caderactLayers.create('Target')`);const row=b.layersList.children.find(child=>child.dataset.layerId);const input=new Element('input');input.owner=b.document;input.parent=row;event=b.emit(input,'contextmenu',{clientX:100,clientY:100});assert.equal(event.defaultPrevented,false);assert.equal(b.contextMenu.hidden,true)
});

test('command and document lifecycle close an open menu without document/history side effects',async()=>{
  const b=await browser();line(b,{x:-20,y:0},{x:20,y:0});const before=b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})');openCanvas(b,400,300);assert.deepEqual(b.read('({revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo,dirty:documentController.isDirty})'),before);b.window.caderactCommandRouter.execute('Line');assert.equal(b.contextMenu.hidden,true);b.window.caderactViewport.cancelActiveCommand();openCanvas(b,400,300);b.run(`window.caderactDocumentSession.replaceStore(window.CaderactDocument.createStore(),{reason:'test'})`);assert.equal(b.contextMenu.hidden,true)
});
