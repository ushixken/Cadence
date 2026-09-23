const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('UX2 production shell exposes frozen ASTRA-1G regions without fake layouts', () => {
  const html = read('index.html')
  for (const contract of ['menu-bar','shell-brand-symbol','shell-document-title','cad-tool-tabs','category-tool-area','quick-tools-rail','editor-workspace','layers-panel','command-history-region','model-strip','command-area','editor-footer']) assert.match(html, new RegExp(contract))
  assert.doesNotMatch(html, /id="command-search"/)
  assert.equal((html.match(/id="document-save-state"/g) || []).length, 1)
  assert.doesNotMatch(html, /Layout\s*[12]/)
})

test('UX2R2 separates application menus from CAD collection tabs', () => {
  const html = read('index.html')
  const menu = html.match(/<ul class="menu-items">([\s\S]*?)<\/ul>/)?.[1] || ''
  const tabs = html.match(/<nav class="cad-tool-tabs"[\s\S]*?<\/nav>/)?.[0] || ''
  assert.doesNotMatch(menu, /data-shell-category="(?:Draw|Modify|Annotate)"/)
  for (const name of ['Draw','Modify','Annotate','Layers','Blocks','Measure','Drafting','Custom']) assert.match(tabs, new RegExp(`data-shell-category="${name}"`))
  assert.match(menu, /class="edit-menu"/)
  assert.doesNotMatch(tabs, /data-shell-category="Edit"/)
})

test('UX3 application menus expose only supported anchored actions', () => {
  const html=read('index.html'),source=read('src/js/editor/application-shell.js'),fileSource=read('src/js/editor/file-actions.js'),css=read('src/css/application-shell.css')
  for(const menu of ['view-menu-actions','window-menu-actions','help-menu-actions'])assert.match(html,new RegExp(`id="${menu}"`))
  assert.match(html,/data-view-action="grid"/);assert.match(html,/data-window-panel="layers"/);assert.match(html,/href="\.\/help\/index\.html"/)
  assert.doesNotMatch(html,/>Cut<|>Paste<|Zoom Previous|Zoom Selected/)
  assert.match(css,/\.application-menu-dropdown\{[^}]*position:absolute/s)
  assert.match(source,/\["ArrowDown","ArrowUp","Home","End"\]/)
  assert.match(source,/event\.key===\"Escape\"/)
  assert.match(fileSource,/\["ArrowDown","ArrowUp","Home","End"\]/)
  assert.match(fileSource,/fileMenuTrigger\.focus\(\)/)
})

test('UX3 collection navigation is presentation-only and command launches stay router-owned',()=>{
  const source=read('src/js/editor/application-shell.js')
  const show=source.slice(source.indexOf('function showCategory'),source.indexOf('root.querySelectorAll(".cad-tool-tabs'))
  assert.doesNotMatch(show,/router\.execute|cancel|documentController|selection/)
  assert.match(source,/router\.execute\(name\)/)
  assert.match(source,/definition\?\.aliases\?\.\[0\]/)
})

test('UX2R2 relocates authoritative Undo and Redo into anchored Edit menu', () => {
  const html = read('index.html'), source = read('src/js/editor/history-actions.js')
  assert.match(html, /class="edit-menu-dropdown"[^>]*id="edit-menu-actions"/)
  assert.equal((html.match(/id="undo-button"/g)||[]).length, 1)
  assert.equal((html.match(/id="redo-button"/g)||[]).length, 1)
  assert.doesNotMatch(html, /class="history-actions"/)
  assert.match(source, /window\.caderactHistory = historyActions/)
})

test('UX2R3 keeps command history inside workspace as a non-layout overlay', () => {
  const html = read('index.html'), css = read('src/css/application-shell.css')
  const workspaceStart = html.indexOf('class="editor-workspace"'), history = html.indexOf('class="command-history-region"'), workspaceEnd = html.indexOf('class="model-strip"')
  assert.ok(workspaceStart > 0 && workspaceStart < history && history < workspaceEnd)
  assert.equal((html.match(/id="command-history"/g)||[]).length, 1)
  assert.match(css, /\.editor-workspace\{position:relative\}/)
  assert.match(css, /\.command-history-region\{[^}]*position:absolute/s)
  assert.match(css, /\.command-history-region\{[^}]*left:48px/s)
  assert.match(css, /\.command-history-region\{[^}]*width:max-content/s)
  assert.match(css, /\.command-history-region\{[^}]*max-width:calc\(100% - 278px\)/s)
  assert.match(css, /\.command-history-region\{[^}]*pointer-events:none/s)
  assert.match(css, /\.command-history-region\{[^}]*overflow:hidden/s)
  assert.match(css, /\.command-history-entry\{[^}]*overflow-wrap:anywhere/s)
})

test('UX2 shell commands share the established registry and router authorities', () => {
  const html = read('index.html')
  const source = read('src/js/editor/application-shell.js')
  assert.ok(html.indexOf('command-input.js') < html.indexOf('application-shell.js'))
  assert.match(source, /window\.caderactCommandRegistry/)
  assert.match(source, /window\.caderactCommandRouter/)
  assert.match(source, /router\.execute\(name\)/)
  assert.doesNotMatch(source, /createRegistry|createRouter|new DocumentController/)
})

test('UX2 shell keeps units and CAD viewport authorities out of presentation code', () => {
  const source = read('src/js/editor/application-shell.js')
  assert.doesNotMatch(source, /setLengthUnit|replaceDocument|worldToScreen|screenToWorld|pointermove/)
  assert.match(read('index.html'), /class="units-control"/)
})

test('UX2 shell has anchored compact responsive presentation', () => {
  const css = read('src/css/application-shell.css')
  assert.match(css, /\.utility-menu\{[^}]*position:relative/s)
  assert.match(css, /\.utility-menu-dropdown\{[^}]*position:absolute/s)
  assert.match(css, /@media\(max-width:1024px\)/)
  assert.match(css, /@media\(max-width:800px\)/)
})

test('UX2R retains Ctrl/Cmd+K through the existing command input and provides an accessible utility menu', () => {
  const html = read('index.html'), source = read('src/js/editor/application-shell.js')
  assert.match(source, /event\.key\.toLowerCase\(\)===\"k\"/)
  assert.match(source, /querySelector\(\"#command-input\"\)/)
  assert.match(html, /id="utility-menu-trigger"[^>]*aria-label="Application menu"[^>]*aria-expanded="false"/)
  assert.match(source, /event\.key===\"Escape\"/)
})

test('UX2R categories and quick rail share one local SVG symbol family', () => {
  const html = read('index.html'), source = read('src/js/editor/application-shell.js')
  for (const icon of ['cad-line','cad-polyline','cad-circle','cad-move','cad-copy','cad-text','cad-dimension']) assert.match(html, new RegExp(`id="${icon}"`))
  assert.match(html, /<use href="#cad-line"/)
  assert.match(source, /use\.setAttribute\(\"href\",`#cad-/)
  assert.match(source, /button\.append\(icon\(command\),label\)/)
})
