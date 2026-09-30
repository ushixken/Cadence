'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')

const html=fs.readFileSync('index.html','utf8')
const css=fs.readFileSync('src/css/application-shell.css','utf8')
const tabs=fs.readFileSync('src/js/editor/layout-tabs.js','utf8')
const preview=fs.readFileSync('src/js/editor/plot-preview.js','utf8')
const pdf=fs.readFileSync('src/js/editor/pdf-export.js','utf8')
const feedback=fs.readFileSync('src/js/editor/ApplicationFeedback.js','utf8')

test('PSR2 Model hides the complete Layout action group and Layout reveals it contextually',()=>{
  assert.match(html,/id="layout-viewport-tools"[^>]*hidden/)
  assert.match(css,/\.layout-viewport-tools\[hidden\]\{display:none\}/)
  assert.match(tabs,/activeLayout=current\.kind==="layout"\?session\.reader\.layout\(current\.layoutId\):null/)
  assert.match(tabs,/viewportTools\.hidden=!activeLayout/)
})

test('PSR2 selected viewport alone enables Scale and Lock while plot actions require a valid Layout',()=>{
  assert.match(tabs,/viewportScale\.disabled=!viewport/)
  assert.match(tabs,/viewportLock\.disabled=!viewport/)
  assert.match(tabs,/plotPreview\.disabled=!activeLayout/)
  assert.match(tabs,/exportPdf\.disabled=!activeLayout/)
})

test('PSR2 Layout actions expose concise truthful tooltips',()=>{
  for(const text of ['Add another Model view to this sheet','Set selected Model View scale','Lock selected Model View','Preview this sheet for output','Export this Layout as vector PDF'])assert.match(html,new RegExp(text))
})

test('PSR2 Plot and PDF errors use anchored application feedback with stable sources',()=>{
  assert.match(preview,/source:"layout-plot-preview"[^}]*anchor:inLayout\?trigger:null[^}]*placementTarget:/)
  assert.match(pdf,/source:"layout-export-pdf"[^}]*anchor:inLayout\?trigger:null[^}]*placementTarget:/)
  assert.match(pdf,/Switch to a Layout to export PDF\./)
})

test('PSR2 feedback authority deduplicates by severity message and source',()=>{
  assert.match(feedback,/identity=`\$\{severity\}\\u0000\$\{message\}\\u0000\$\{source\}`/)
  assert.match(feedback,/if\(existing\).*return existing\.id/s)
  assert.match(css,/\.application-feedback-local\{[^}]*position:fixed[^}]*inset:0[^}]*pointer-events:none/s)
  assert.match(css,/\.application-notice\.is-local\{[^}]*position:absolute/s)
})

test('PSR2 Layout actions remain compact and horizontally reachable at constrained widths',()=>{
  assert.match(css,/\.layout-viewport-tools\{[^}]*min-width:0[^}]*overflow-x:auto[^}]*scrollbar-width:thin/s)
})
