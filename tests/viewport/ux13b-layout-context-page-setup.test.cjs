'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')

const html=fs.readFileSync('index.html','utf8')
const source=fs.readFileSync('src/js/editor/layout-tabs.js','utf8')
const shellCss=fs.readFileSync('src/css/application-shell.css','utf8')
const editorCss=fs.readFileSync('src/css/editor-page.css','utf8')

test('UX13-B loads the shared context-menu authority before Layout tabs',()=>{
  assert.ok(html.indexOf('ContextMenu.js')<html.indexOf('layout-tabs.js'))
  assert.equal((html.match(/ContextMenu\.js/g)||[]).length,1)
})

test('UX13-B Layout right-click suppresses native UI and opens the shared floating menu',()=>{
  assert.match(source,/addEventListener\("contextmenu",event=>\{event\.preventDefault\(\);layoutMenu\.open\(/)
  assert.doesNotMatch(source,/contextmenu",event=>\{event\.preventDefault\(\);openPageSetup/)
  assert.match(source,/classList\.add\("editor-context-menu","layout-context-menu"\)/)
  assert.match(editorCss,/\.editor-context-menu \{ position: fixed;/)
})

test('UX13-B exposes only supported Layout actions with intentional separators',()=>{
  for(const label of ['Rename Layout','Delete Layout','Page Setup…','Add View','Plot Preview','Export PDF'])assert.match(source,new RegExp(`label:"${label.replace('…','…')}"`))
  assert.match(source,/id:"page-setup",label:"Page Setup…",separatorBefore:true/)
  assert.match(source,/id:"create-viewport",label:"Add View",separatorBefore:true/)
  assert.match(source,/id:"delete",label:"Delete Layout",enabled:session\.reader\.layouts\(\)\.length>1/)
})

test('UX13-B Page Setup uses shared draggable header body and action contracts',()=>{
  assert.match(source,/header\.classList\.add\("caderact-dialog-header","page-setup-header"\)/)
  assert.match(source,/body\.classList\.add\("caderact-dialog-body","page-setup-body"\)/)
  assert.match(source,/actions\.classList\.add\("page-setup-actions","caderact-dialog-actions"\)/)
  assert.match(source,/CaderactFloatingDialog\.bind\(setupDialog,header\)/)
  assert.match(source,/floating\.center\(\)/)
  assert.match(source,/aria-label","Close Page Setup"/)
})

test('UX13-B Page Setup is compact theme-token UI with deliberate disabled controls',()=>{
  assert.match(shellCss,/\.page-setup-dialog\{[^}]*width:min\(1040px[^}]*height:min\(720px,calc\(100vh - 24px\)\)[^}]*overflow:hidden[^}]*background:var\(--surface-dialog\)/s)
  assert.doesNotMatch(shellCss,/\.page-setup-dialog\{[^}]*height:min\(590px/)
  assert.match(shellCss,/\.page-setup-body\{[^}]*grid-template-columns:[^}]*overflow:hidden/s)
  assert.match(shellCss,/\.page-setup-settings\{[^}]*overflow-y:auto/s)
  assert.match(shellCss,/\.page-setup-preview\{[^}]*align-items:center[^}]*justify-content:center/s)
  assert.match(shellCss,/\.page-setup-row\{[^}]*grid-template-columns:/s)
  assert.match(shellCss,/\.page-setup-row input:disabled,\.page-setup-row select:disabled\{[^}]*background:var\(--surface-control-disabled\)[^}]*opacity:1/s)
  assert.match(shellCss,/\.layout-context-menu\{width:188px;min-width:188px\}/)
  assert.match(shellCss,/\.plot-preview-dialog\{[^}]*height:min\(760px,calc\(100vh - 40px\)\)/s)
})

test('UX13-B Page Setup still publishes only through the existing layout gateway',()=>{
  assert.match(source,/session\.layoutGateway\.setPageSetup\(setupLayoutId,/)
  assert.match(source,/if\(outcome\.status==="committed"\|\|outcome\.status==="no-op"\)setupDialog\.close/)
})
