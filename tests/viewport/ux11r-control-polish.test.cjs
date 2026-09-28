'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')

const base=fs.readFileSync('src/css/base.css','utf8')
const shell=fs.readFileSync('src/css/application-shell.css','utf8')
const editor=fs.readFileSync('src/css/editor-page.css','utf8')
const html=fs.readFileSync('index.html','utf8')
const applicationShell=fs.readFileSync('src/js/editor/application-shell.js','utf8')

test('UX11R defines theme-specific dialog and complete control-border tokens',()=>{
  for(const token of ['surface-dialog','surface-dialog-header','surface-dialog-footer','control-border','control-border-hover','control-arrow'])assert.match(base,new RegExp(`--${token}:`))
  assert.match(base,/:root\[data-ui-theme="dark"\][\s\S]*--surface-dialog:/)
  assert.match(base,/select\s*\{[\s\S]*appearance:\s*none;[\s\S]*background-image:/)
  assert.match(base,/border:\s*1px solid var\(--control-border\)/)
})

test('UX11R pointer focus clears while keyboard focus remains explicit',()=>{
  assert.match(base,/:where\(button, input, select, textarea, \[tabindex\]\):focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus-ring\)/s)
  assert.match(base,/:where\(button, input, select, textarea, \[tabindex\]\):focus:not\(:focus-visible\)\s*\{[^}]*outline:\s*none/s)
  assert.match(base,/:root\[data-input-modality="pointer"\][^{]*:focus-visible\s*\{[^}]*outline:\s*none/s)
  assert.match(applicationShell,/dataset\.inputModality="pointer"/)
  assert.match(applicationShell,/dataset\.inputModality="keyboard"/)
})

test('UX11R shared dialog surfaces separate header body and footer',()=>{
  assert.match(shell,/\.caderact-dialog-header,\.caderact-dialog-title\{[^}]*var\(--surface-dialog-header\)/s)
  assert.match(shell,/\.caderact-dialog-body\{[^}]*var\(--surface-dialog\)/s)
  assert.match(shell,/\.caderact-dialog-actions\{[^}]*var\(--surface-dialog-footer\)/s)
})

test('UX11R layer group and block menus end on theme-token surfaces',()=>{
  assert.match(editor,/\.layer-actions-menu,\.group-actions-menu,\.block-actions-menu\{background:var\(--surface-popup\)\}/)
})

test('UX11R Preferences retains its authority boundary',()=>{
  const start=html.indexOf('id="settings-panel"')
  const end=html.indexOf('</section>',start)
  const panel=html.slice(start,end)
  assert.match(panel,/Application and workspace/)
  assert.doesNotMatch(panel,/Reset Drafting Defaults/)
  assert.match(shell,/#drafting-settings-footer\[hidden\]\{display:none\}/)
})
