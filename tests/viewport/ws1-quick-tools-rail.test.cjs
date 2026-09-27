'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('WS1 rail exposes only real common commands and routes every launch through the command router',()=>{
  const html=read('index.html'),source=read('src/js/editor/application-shell.js');
  const rail=html.match(/<aside class="quick-tools-rail"[\s\S]*?<\/aside>/)?.[0]||'';
  for(const command of ['Line','Polyline','Rectangle','Circle','Arc','Text','Linear','Move','Copy','Rotate','Trim','Offset','Fillet'])assert.match(rail,new RegExp(`data-shell-command="${command}"`));
  assert.doesNotMatch(rail,/data-shell-command="(?:Select|Dimension)"/);
  assert.match(source,/function launch\(name\) \{ if \(!registry\.resolve\(name\)\) return false; router\.execute\(name\)/);
  const railBinding=source.slice(source.indexOf('const rail='),source.indexOf('function closeUtility'));
  assert.doesNotMatch(railBinding,/documentController|recordGateway|history|dirty|createRegistry|createRouter/);
});

test('WS1 variants are truthful registered command families with no placeholders',()=>{
  const html=read('index.html'),rail=html.match(/<aside class="quick-tools-rail"[\s\S]*?<\/aside>/)?.[0]||'';
  for(const pair of [['shape','Rectangle','Polygon'],['trim','Trim','Extend'],['corner','Fillet','Chamfer']]){assert.match(rail,new RegExp(`data-rail-flyout="${pair[0]}"`));for(const command of pair.slice(1))assert.match(rail,new RegExp(`data-shell-command="${command}"`))}
  for(const dimension of ['Linear','Aligned','Angular','DimRadius','DimDiameter'])assert.match(rail,new RegExp(`data-shell-command="${dimension}"`));
  assert.doesNotMatch(rail,/disabled[^>]*>\s*(Coming soon|Custom)/i);
});

test('WS1 active state and truthful aliases derive from registry and router authorities',()=>{
  const source=read('src/js/editor/application-shell.js');
  assert.match(source,/definition\?\.aliases\?\.\[0\]/);
  assert.match(source,/button\.dataset\.tooltip=label/);
  assert.match(source,/const active=router\.activeCommand/);
  assert.match(source,/button\.classList\.toggle\("is-active",selected\)/);
  assert.match(source,/router\.subscribe\(syncCommandLaunchers\)/);
  assert.match(source,/aria-pressed/);
});

test('WS1 flyouts clamp to the viewport and own keyboard dismissal before command Escape',()=>{
  const source=read('src/js/editor/application-shell.js');
  assert.match(source,/window\.innerWidth-anchor\.right/);
  assert.match(source,/Math\.min\(anchor\.top,window\.innerHeight-box\.height-margin\)/);
  assert.match(source,/\["ArrowDown","ArrowUp","Home","End"\]/);
  assert.match(source,/event\.key==="Escape"&&railMenus\.some/);
  assert.match(source,/stopPropagation\(\)/);
  assert.match(source,/},true\)/);
});

test('WS1 rail stays narrow and scrolls internally at constrained heights',()=>{
  const css=read('src/css/application-shell.css');
  assert.match(css,/\.quick-tools-rail\{[^}]*width:38px[^}]*min-height:0[^}]*flex:0 0 38px/s);
  assert.match(css,/\.quick-tools-scroll\{[^}]*overflow-y:auto[^}]*overscroll-behavior:contain/s);
  assert.match(css,/\.rail-flyout\{[^}]*position:fixed[^}]*z-index:var\(--z-context-menu\)/s);
  assert.match(css,/\.quick-tools-rail button\.is-active\{[^}]*var\(--surface-selected\)[^}]*var\(--accent\)/s);
  assert.doesNotMatch(css,/linear-gradient|radial-gradient/);
});
