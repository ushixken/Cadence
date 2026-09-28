'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {browser}=require('../helpers/browser.cjs')

const html=fs.readFileSync('index.html','utf8')
const shellCss=fs.readFileSync('src/css/application-shell.css','utf8')

test('UX11 Preferences uses the shared compact dialog structure',()=>{
  assert.match(html,/id="settings-panel" class="caderact-dialog"/)
  assert.match(html,/settings-panel-header caderact-dialog-header/)
  assert.match(html,/drafting-settings-tabs caderact-dialog-tabs/)
  assert.match(html,/settings-panel-body drafting-settings-body caderact-dialog-body/)
  assert.match(shellCss,/\.caderact-dialog\{[^}]*background:var\(--surface-popup\)[^}]*border:1px solid var\(--border-strong\)/s)
  assert.match(shellCss,/#settings-panel \.drafting-settings-body\{min-height:0\}/)
  assert.match(shellCss,/#settings-panel \.settings-row\{[^}]*grid-template-columns:/s)
  assert.match(shellCss,/@media\(max-width:520px\)[\s\S]*#settings-panel \.settings-row\{grid-template-columns:1fr/s)
})

test('UX11 shared dialog contract covers existing settings and output surfaces',()=>{
  const layout=fs.readFileSync('src/js/editor/layout-tabs.js','utf8')
  const pdf=fs.readFileSync('src/js/editor/pdf-export.js','utf8')
  const properties=fs.readFileSync('src/js/editor/properties-panel.js','utf8')
  for(const source of [layout,pdf,properties])assert.match(source,/caderact-dialog/)
  assert.match(html,/file-safety-dialog caderact-dialog/g)
  assert.match(shellCss,/dialog\.caderact-dialog\{[^}]*max-height:calc\(100vh - 24px\)/s)
  assert.match(shellCss,/\.page-setup-dialog \.caderact-dialog-actions\{[^}]*position:sticky[^}]*bottom:0/s)
})

test('UX11 Preferences never exposes or invokes the Drafting reset authority',async()=>{
  const b=await browser(),before=b.read('window.caderactUserPreferences.value')
  b.emit(b.preferencesTrigger,'click')
  assert.equal(b.draftingFooter.hidden,true)
  b.emit(b.appearanceReset,'click')
  assert.deepEqual(b.read('window.caderactUserPreferences.value'),before)
  b.emit(b.settingsClose,'click')
  b.emit(b.draftingSettingsTrigger,'click')
  assert.equal(b.draftingFooter.hidden,false)
})

test('UX11 Preferences preserves Escape closure and trigger focus restoration',async()=>{
  const b=await browser();b.emit(b.preferencesTrigger,'click');b.key('Escape',b.document)
  assert.equal(b.settingsPanel.hidden,true)
  assert.equal(b.document.activeElement,b.preferencesTrigger)
})
