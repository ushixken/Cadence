'use strict'
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const read=file=>fs.readFileSync(file,'utf8')

test('UX13-E applies one shared native context-menu policy to owned workspace surfaces',()=>{
  const source=read('src/js/editor/application-shell.js')
  for(const selector of ['.viewport','.model-strip','.cad-tool-tabs','.category-tool-area','.quick-tools-rail','.editor-sidebar','.editor-footer'])assert.match(source,new RegExp(selector.replace('.','\\.')))
  assert.match(source,/document\.addEventListener\("contextmenu"/)
  assert.match(source,/closest\("input, textarea, select, \[contenteditable=true\]"\)/)
  assert.match(source,/closest\(ownedContextMenuSurfaces\)\)event\.preventDefault\(\)/)
})

test('UX13-E Edit and application-menu entries share Preferences while Drafting Settings stays separate',()=>{
  const html=read('index.html'),source=read('src/js/editor/settings-panel.js')
  assert.match(html,/id="preferences-trigger"[^>]*data-open-drafting-settings="appearance"[^>]*>Preferences…<\/button>/)
  assert.match(html,/id="settings-trigger"[^>]*data-open-drafting-settings="appearance"[^>]*>Preferences…<\/button>/)
  assert.match(html,/id="drafting-settings-trigger"[^>]*data-open-drafting-settings="grid"[^>]*>Drafting Settings…<\/button>/)
  assert.match(source,/triggers=\[\$\("#settings-trigger"\),\$\("#preferences-trigger"\),\$\("#drafting-settings-trigger"\)/)
  assert.match(source,/sectionMode=name=>\["appearance","workspace","command","cursor"\]\.includes\(name\)\?"preferences":"drafting"/)
  assert.match(source,/source\.closest\("\.edit-menu"\)\)return \$\("\.edit-menu-trigger"\)/)
  assert.match(source,/source\.closest\("\.utility-menu"\)\)return \$\("#utility-menu-trigger"\)/)
  assert.match(source,/previousFocus=focusReturnTarget\(source\)/)
})
