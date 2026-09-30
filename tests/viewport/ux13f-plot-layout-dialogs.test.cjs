'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')

const html=fs.readFileSync('index.html','utf8')
const command=fs.readFileSync('src/js/editor/command-input.js','utf8')
const files=fs.readFileSync('src/js/editor/file-actions.js','utf8')
const layouts=fs.readFileSync('src/js/editor/layout-tabs.js','utf8')
const plot=fs.readFileSync('src/js/editor/plot-preview.js','utf8')
const pdf=fs.readFileSync('src/js/editor/pdf-export.js','utf8')
const css=fs.readFileSync('src/css/application-shell.css','utf8')

test('UX13-F exposes Plot through File and the canonical command router',()=>{
  assert.match(html,/id="file-plot"[^>]*>Plot…</)
  assert.match(command,/name: "Plot", aliases: \[\], repeatable: false/)
  assert.match(files,/plotButton\?\.addEventListener\("click", \(\) => \{ closeFileMenu\(\); window\.caderactCommandRouter\?\.execute\?\.\("Plot"\) \}\)/)
  assert.match(command,/definition\.name === "Plot"/)
})

test('UX13-F Plot reuses PlotScene and the shared floating dialog system',()=>{
  assert.match(plot,/classList\.add\("plot-preview-dialog","caderact-dialog"\)/)
  assert.match(plot,/classList\.add\("caderact-dialog-header","plot-preview-header"\)/)
  assert.match(plot,/CaderactFloatingDialog\.bind\(dialog,header\)/)
  assert.match(plot,/floating\.center\(\)/)
  assert.match(plot,/CaderactPlotScene\.create/)
  assert.match(plot,/caderactLayouts\?\.openPageSetup/)
  assert.match(plot,/caderactPdfExport\?\.open/)
  assert.match(css,/\.plot-preview-dialog\{[^}]*max-width|\.plot-preview-dialog\{[^}]*width:min\(1100px/s)
})

test('UX13-F Layout rename and delete use shared dialogs and no browser-native prompt authority',()=>{
  assert.doesNotMatch(layouts,/window\.prompt|window\.confirm/)
  assert.match(layouts,/className:"layout-rename-dialog"/)
  assert.match(layouts,/className:"layout-delete-dialog"/)
  assert.match(layouts,/CaderactFloatingDialog\.bind\(dialog,dialogHeader\)/)
  assert.match(layouts,/button\.addEventListener\("dblclick",\(\)=>openRename\(id,button\)\)/)
  assert.match(layouts,/id:"rename"[^\n]*openRename\(id,button\)/)
  assert.match(layouts,/id:"delete"[^\n]*openDelete\(id,button\)/)
  assert.match(layouts,/renameInput\.addEventListener\("keydown"[^\n]*event\.key==="Enter"/)
  assert.match(layouts,/dialog\.addEventListener\("cancel"[^\n]*close\(\)/)
})

test('UX13-F dialog actions keep the existing Layout gateway and responsive shared styling',()=>{
  assert.match(layouts,/session\.layoutGateway\.rename\(actionLayoutId,renameInput\.value\)/)
  assert.match(layouts,/session\.layoutGateway\.remove\(actionLayoutId\)/)
  assert.match(css,/\.layout-action-dialog\{width:min\(390px,calc\(100vw - 24px\)\)/)
  assert.match(css,/\.layout-action-dialog \.caderact-dialog-actions\{[^}]*justify-content:flex-end/s)
  assert.match(css,/\.caderact-dialog button\.is-destructive/)
})

test('UX13-F PDF export adopts shared centered draggable focus-safe dialog behavior',()=>{
  assert.match(pdf,/classList\.add\("caderact-dialog-header","pdf-export-header"\)/)
  assert.match(pdf,/CaderactFloatingDialog\.bind\(dialog,header\)/)
  assert.match(pdf,/dialog\.showModal\?\.\(\);floating\.center\(\);input\.focus\(\);input\.select/)
  assert.match(pdf,/event\.key==="Enter"&&input\.value\.trim\(\)/)
  assert.match(pdf,/dialog\.addEventListener\("cancel"[^\n]*close\(\)/)
  assert.match(pdf,/returnFocus\?\.focus\?\.\(\)/)
  assert.match(css,/\.pdf-export-dialog\{width:min\(420px,calc\(100vw - 24px\)\)/)
})

test('UX13-F shared controls use one themed boundary and focus-visible treatment',()=>{
  assert.match(css,/\.caderact-dialog button\{[^}]*background:var\(--surface-control\)[^}]*border:1px solid var\(--control-border\)/s)
  assert.match(css,/\.caderact-dialog input[^}]*,.caderact-dialog select[^}]*\{border:1px solid var\(--control-border\);box-shadow:none\}/s)
  assert.match(css,/\.caderact-dialog input:focus-visible[^}]*\{outline:0;border-color:var\(--focus-ring\);box-shadow:0 0 0 1px var\(--focus-ring\)/s)
})
