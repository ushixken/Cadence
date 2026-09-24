const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const base = read('src/css/base.css')
const editor = read('src/css/editor-page.css')
const menu = read('src/css/menu-bar.css')

test('UX1 exposes one light neutral semantic token foundation', () => {
  for (const token of [
    'surface-app', 'surface-chrome', 'surface-panel', 'surface-control', 'surface-popup', 'surface-viewport',
    'text-primary', 'text-secondary', 'text-muted', 'border-subtle', 'separator', 'accent', 'focus-ring',
    'status-success', 'status-warning', 'status-error', 'status-info', 'shadow-popup', 'z-dialog',
  ]) assert.match(base, new RegExp(`--${token}:`))
  assert.match(base, /color-scheme:\s*light/)
  assert.doesNotMatch(base, /linear-gradient|radial-gradient/)
})

test('UX1 preserves distinct CAD semantic color roles', () => {
  const values = {}
  for (const token of ['cad-selection', 'cad-grip', 'cad-osnap', 'cad-track', 'cad-axis-x', 'cad-axis-y', 'cad-layer-locked', 'cad-layer-hidden']) {
    const match = base.match(new RegExp(`--${token}:\\s*([^;]+)`))
    assert.ok(match, `missing ${token}`)
    values[token] = match[1].trim()
  }
  assert.notEqual(values['cad-osnap'], values['cad-track'])
  assert.notEqual(values['cad-axis-x'], values['cad-axis-y'])
  assert.notEqual(values['cad-selection'], values['cad-layer-hidden'])
})

test('UX1 provides visible focus without a global outline reset', () => {
  assert.match(base, /:where\(button, input, select, textarea, \[tabindex\]\):focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus-ring\)/s)
  assert.doesNotMatch(base, /body\s+:focus-visible\s*\{[^}]*outline:\s*none/s)
  assert.match(editor, /\.command-input-wrap:focus-within\s*\{[^}]*border-color:\s*var\(--focus-ring\)/s)
})

test('UX1 application chrome consumes semantic surfaces while preserving responsive shell breakpoints', () => {
  assert.match(menu, /background-color:\s*var\(--surface-chrome\)/)
  assert.match(editor, /\.layers-panel\s*\{[^}]*background:\s*var\(--surface-panel\)/s)
  assert.match(editor, /\.editor-footer\s*\{[^}]*background-color:\s*var\(--surface-chrome\)/s)
  assert.match(editor, /canvas\s*\{[^}]*background-color:\s*var\(--surface-viewport\)/s)
  for (const breakpoint of ['980px', '720px', '520px']) assert.match(editor, new RegExp(`max-width:\\s*${breakpoint}`))
})
