'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('WS2 keeps the eight professional collections as one accessible tablist',()=>{
  const html=read('index.html'),tabs=html.match(/<nav class="cad-tool-tabs"[\s\S]*?<\/nav>/)?.[0]||'';
  assert.match(tabs,/role="tablist"/);
  for(const name of ['Draw','Modify','Annotate','Layers','Blocks','Measure','Drafting','Custom'])assert.match(tabs,new RegExp(`role="tab"[^>]*data-shell-category="${name}"[^>]*aria-controls="category-tools"`));
  assert.equal((tabs.match(/aria-selected="true"/g)||[]).length,1);
});

test('WS2 collection model exposes the registered command breadth without fake commands',()=>{
  const source=read('src/js/editor/application-shell.js');
  for(const command of ['Line','Polyline','Rectangle','Polygon','Circle','Arc','Ellipse','Hatch','Region'])assert.match(source,new RegExp(`Draw: collection\\(\\[[^\\]]*"${command}"`));
  for(const command of ['Move','Copy','Rotate','Scale','Mirror','Trim','Extend','Offset','Fillet','Chamfer','Join','Break','Split','Stretch','Lengthen','Align','RectangularArray','PolarArray','PathArray','Explode'])assert.match(source,new RegExp(`Modify: collection\\(\\[[^\\]]*"${command}"`));
  for(const command of ['Text','Linear','Aligned','Angular','DimRadius','DimDiameter','Leader','MLeader'])assert.match(source,new RegExp(`Annotate: collection\\(\\[[^\\]]*"${command}"`));
  assert.match(source,/Blocks: collection\(\["Block","Insert","BlockEdit","Explode"\]\)/);
  assert.match(source,/Custom: collection\(\)/);
});

test('WS2 Layers and Drafting are focused workspace actions rather than duplicated panels or status controls',()=>{
  const source=read('src/js/editor/application-shell.js');
  assert.match(source,/label:"Open Layers"[^\n]*showLayers/);
  assert.match(source,/label:"Drafting Settings"[^\n]*caderactDraftingSettings/);
  const categories=source.slice(source.indexOf('const categories'),source.indexOf('const icons'));
  assert.doesNotMatch(categories,/setGridSnapEnabled|setObjectSnapMode|layerGateway|createLayer|setCurrentLayer/);
});

test('WS2 command buttons retain registry aliases router launch and live active state',()=>{
  const source=read('src/js/editor/application-shell.js');
  assert.match(source,/category\.commands\.filter\(command=>registry\.resolve\(command\)\)/);
  assert.match(source,/shortcut=definition\?\.aliases\?\.\[0\]/);
  assert.match(source,/button\.addEventListener\("click",\(\)=>launch\(command\)\)/);
  assert.match(source,/router\.execute\(name\)/);
  assert.match(source,/syncCommandLaunchers\(\)/);
  assert.match(source,/router\.subscribe\(syncCommandLaunchers\)/);
});

test('WS2 switching is keyboard accessible and tool overflow remains inside the shell',()=>{
  const source=read('src/js/editor/application-shell.js'),css=read('src/css/application-shell.css');
  assert.match(source,/\["ArrowLeft","ArrowRight","Home","End"\]/);
  assert.match(source,/button\.tabIndex=active\?0:-1/);
  assert.match(source,/target\.focus\(\)/);
  assert.match(css,/\.cad-tool-tabs\{[^}]*overflow-x:auto/s);
  assert.match(css,/\.category-tools\{[^}]*overflow-x:auto[^}]*overflow-y:hidden[^}]*overscroll-behavior-x:contain/s);
  const categoryCode=source.slice(source.indexOf('function showCategory'),source.indexOf('const rail='));
  assert.doesNotMatch(categoryCode,/documentController|recordGateway|history|dirty|requestRender/);
});
