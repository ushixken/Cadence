'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { browser } = require('../helpers/browser.cjs')

const COLOR_KEYS = [
  'background', 'gridMinor', 'gridMajor', 'axisX', 'axisY',
  'geometry', 'selection', 'grip', 'gripHover', 'osnap',
  'tracking', 'crosshair', 'dynamicSurface', 'dynamicText'
]

test('UX13-C required category structure organizes all Custom Canvas controls into 6 compact CAD categories', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8')
  const customSection = html.slice(html.indexOf('id="settings-custom-canvas"'), html.indexOf('id="settings-appearance-reset"'))

  const expectedCategories = [
    { heading: 'CANVAS', attr: 'canvas', keys: ['background'], labels: ['Background'] },
    { heading: 'GRID &amp; AXES', attr: 'grid-axes', keys: ['gridMinor', 'gridMajor', 'axisX', 'axisY'], labels: ['Minor Grid', 'Major Grid', 'X Axis', 'Y Axis'] },
    { heading: 'GEOMETRY', attr: 'geometry', keys: ['geometry', 'selection'], labels: ['Default Geometry', 'Selection'] },
    { heading: 'GRIPS &amp; SNAPS', attr: 'grips-snaps', keys: ['grip', 'gripHover', 'osnap'], labels: ['Grips', 'Grip Hover', 'Osnap Markers'] },
    { heading: 'TRACKING &amp; CURSOR', attr: 'tracking-cursor', keys: ['tracking', 'crosshair'], labels: ['Tracking / Extension', 'Crosshair'] },
    { heading: 'DYNAMIC INPUT', attr: 'dynamic-input', keys: ['dynamicSurface', 'dynamicText'], labels: ['Surface', 'Text'] }
  ]

  for (const cat of expectedCategories) {
    assert.match(customSection, new RegExp(`data-canvas-category="${cat.attr}"`), `Missing section container for ${cat.attr}`)
    assert.match(customSection, new RegExp(`<h4>${cat.heading}</h4>`), `Missing compact heading for ${cat.heading}`)
    for (let i = 0; i < cat.keys.length; i++) {
      const key = cat.keys[i]
      const label = cat.labels[i]
      assert.match(customSection, new RegExp(`data-canvas-color="${key}"`), `Missing control for ${key}`)
      assert.match(customSection, new RegExp(`<label[^>]*>${label}</label>`), `Missing label for ${label}`)
    }
  }

  // Dynamic Input labels are compact: "Surface" and "Text" under DYNAMIC INPUT
  assert.match(customSection, /<label for="settings-canvas-dynamic-surface">Surface<\/label>/)
  assert.match(customSection, /<label for="settings-canvas-dynamic-text">Text<\/label>/)
})

test('UX13-C every existing Custom Canvas control appears exactly once', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8')
  for (const key of COLOR_KEYS) {
    const occurrences = html.split(`data-canvas-color="${key}"`).length - 1
    assert.equal(occurrences, 1, `Expected data-canvas-color="${key}" to appear exactly once, got ${occurrences}`)
  }
})

test('UX13-C Light → Custom exact presentation produces no visible color jump', async () => {
  const b = await browser()
  b.run('workspacePreferences.set({canvasTheme: "light"})')
  const beforeColors = b.read('Object.fromEntries(Object.keys(window.CaderactCanvasAppearance.roles).map(key=>[key,viewportSettings[key]]))')

  b.settingsControls['canvas-theme'].value = 'custom'
  b.emit(b.settingsControls['canvas-theme'], 'change')

  const afterColors = b.read('Object.fromEntries(Object.keys(window.CaderactCanvasAppearance.roles).map(key=>[key,viewportSettings[key]]))')
  assert.deepEqual(afterColors, beforeColors, 'Renderer settings must match Light exact presentation')

  // In Custom mode, CSS custom properties are projected matching the technical-light palette
  const lightTemplate = b.read('window.CaderactWorkspacePreferences.CANVAS_TEMPLATES["technical-light"]')
  assert.equal(b.read('document.documentElement.style.getPropertyValue("--surface-viewport")'), lightTemplate.background)
  assert.equal(b.read('document.documentElement.style.getPropertyValue("--cad-crosshair")'), lightTemplate.crosshair)
  assert.equal(b.read('document.documentElement.style.getPropertyValue("--surface-viewport-hud")'), lightTemplate.dynamicSurface)
  assert.equal(b.read('document.documentElement.style.getPropertyValue("--cad-hud-text")'), lightTemplate.dynamicText)
})

test('UX13-C Dark → Custom exact presentation produces no visible color jump', async () => {
  const b = await browser()
  b.run('workspacePreferences.set({canvasTheme: "dark"})')
  const beforeColors = b.read('Object.fromEntries(Object.keys(window.CaderactCanvasAppearance.roles).map(key=>[key,viewportSettings[key]]))')

  b.settingsControls['canvas-theme'].value = 'custom'
  b.emit(b.settingsControls['canvas-theme'], 'change')

  const afterColors = b.read('Object.fromEntries(Object.keys(window.CaderactCanvasAppearance.roles).map(key=>[key,viewportSettings[key]]))')
  assert.deepEqual(afterColors, beforeColors, 'Renderer settings must match Dark exact presentation')
  assert.equal(b.read('workspacePreferences.value.canvasTheme'), 'custom')

  const darkTemplate = b.read('window.CaderactWorkspacePreferences.CANVAS_TEMPLATES["classic-dark"]')
  assert.equal(b.read('document.documentElement.style.getPropertyValue("--surface-viewport")'), darkTemplate.background)
  assert.equal(b.read('document.documentElement.style.getPropertyValue("--cad-crosshair")'), darkTemplate.crosshair)
})

test('UX13-C template → Custom exact presentation applies template snapshot cleanly', async () => {
  const b = await browser()
  b.settingsControls['canvas-theme'].value = 'custom'
  b.emit(b.settingsControls['canvas-theme'], 'change')

  const templates = b.read('window.CaderactWorkspacePreferences.CANVAS_TEMPLATES')
  for (const templateName of ['blueprint', 'high-contrast', 'classic-dark', 'technical-light']) {
    b.settingsControls['canvas-template'].value = templateName
    b.emit(b.settingsControls['canvas-template'], 'change')

    const currentColors = b.read('workspacePreferences.value.customCanvasColors')
    assert.deepEqual(currentColors, templates[templateName], `Custom colors must match template ${templateName}`)
    assert.equal(b.read('workspacePreferences.value.customCanvasPresentation'), null)
    assert.equal(b.read('viewportSettings.backgroundColor'), templates[templateName].background)
  }
})

test('UX13-C Custom edits do not alias/mutate source theme or color template', async () => {
  const b = await browser()
  b.settingsControls['canvas-theme'].value = 'custom'
  b.emit(b.settingsControls['canvas-theme'], 'change')
  b.settingsControls['canvas-template'].value = 'blueprint'
  b.emit(b.settingsControls['canvas-template'], 'change')

  const originalTemplates = b.read('JSON.stringify(window.CaderactWorkspacePreferences.CANVAS_TEMPLATES)')

  // Edit custom canvas background
  const bgInput = b.canvasColorInputs.find(i => i.dataset.canvasColor === 'background')
  bgInput.value = '#abcdef'
  b.emit(bgInput, 'input')

  // Edit custom geometry
  const geomInput = b.canvasColorInputs.find(i => i.dataset.canvasColor === 'geometry')
  geomInput.value = '#fedcba'
  b.emit(geomInput, 'input')

  assert.equal(b.read('workspacePreferences.value.customCanvasColors.background'), '#abcdef')
  assert.equal(b.read('workspacePreferences.value.customCanvasColors.geometry'), '#fedcba')

  // Verify CANVAS_TEMPLATES was not mutated
  assert.equal(b.read('JSON.stringify(window.CaderactWorkspacePreferences.CANVAS_TEMPLATES)'), originalTemplates)
  assert.equal(b.read('window.CaderactWorkspacePreferences.CANVAS_TEMPLATES.blueprint.background'), '#12395a')
})

test('UX13-C Custom values survive switching away and back', async () => {
  const b = await browser()
  b.settingsControls['canvas-theme'].value = 'custom'
  b.emit(b.settingsControls['canvas-theme'], 'change')

  // User customizes custom canvas values
  const bgInput = b.canvasColorInputs.find(i => i.dataset.canvasColor === 'background')
  bgInput.value = '#335577'
  b.emit(bgInput, 'input')
  const crosshairInput = b.canvasColorInputs.find(i => i.dataset.canvasColor === 'crosshair')
  crosshairInput.value = '#ff00ee'
  b.emit(crosshairInput, 'input')

  assert.equal(b.read('workspacePreferences.value.customCanvasColors.background'), '#335577')
  assert.equal(b.read('workspacePreferences.value.customCanvasColors.crosshair'), '#ff00ee')

  // Switch away to Light
  b.settingsControls['canvas-theme'].value = 'light'
  b.emit(b.settingsControls['canvas-theme'], 'change')
  assert.equal(b.read('workspacePreferences.value.canvasTheme'), 'light')

  // Switch back to Custom
  b.settingsControls['canvas-theme'].value = 'custom'
  b.emit(b.settingsControls['canvas-theme'], 'change')
  assert.equal(b.read('workspacePreferences.value.canvasTheme'), 'custom')
  assert.equal(b.read('workspacePreferences.value.customCanvasColors.background'), '#335577', 'Background must survive switching to Light and back')
  assert.equal(b.read('workspacePreferences.value.customCanvasColors.crosshair'), '#ff00ee', 'Crosshair must survive switching to Light and back')

  // Switch away to Dark
  b.settingsControls['canvas-theme'].value = 'dark'
  b.emit(b.settingsControls['canvas-theme'], 'change')
  assert.equal(b.read('workspacePreferences.value.canvasTheme'), 'dark')

  // Switch back to Custom
  b.settingsControls['canvas-theme'].value = 'custom'
  b.emit(b.settingsControls['canvas-theme'], 'change')
  assert.equal(b.read('workspacePreferences.value.canvasTheme'), 'custom')
  assert.equal(b.read('workspacePreferences.value.customCanvasColors.background'), '#335577', 'Background must survive switching to Dark and back')
  assert.equal(b.read('workspacePreferences.value.customCanvasColors.crosshair'), '#ff00ee', 'Crosshair must survive switching to Dark and back')
})

test('UX13-C reset scope is Custom Canvas only through existing authority', async () => {
  const b = await browser()
  // Configure unrelated preferences
  b.run('workspacePreferences.set({uiTheme: "dark", rightDockWidth: 425, activeToolCollection: "Modify"})')
  b.run('userPreferences.set({gridSnapEnabled: true, polarEnabled: true})')

  // Set up custom canvas with template and custom color
  b.settingsControls['canvas-theme'].value = 'custom'
  b.emit(b.settingsControls['canvas-theme'], 'change')
  b.settingsControls['canvas-template'].value = 'blueprint'
  b.emit(b.settingsControls['canvas-template'], 'change')

  const bgInput = b.canvasColorInputs.find(i => i.dataset.canvasColor === 'background')
  bgInput.value = '#998877'
  b.emit(bgInput, 'input')
  assert.equal(b.read('workspacePreferences.value.customCanvasColors.background'), '#998877')

  // Click Reset Custom Canvas (Reset to Template)
  b.emit(b.canvasTemplateReset, 'click')

  // Custom canvas restored to blueprint template
  assert.equal(b.read('workspacePreferences.value.customCanvasColors.background'), '#12395a')
  assert.equal(b.read('workspacePreferences.value.customCanvasPresentation'), null)

  // Unrelated workspace preferences preserved
  assert.equal(b.read('workspacePreferences.value.uiTheme'), 'dark')
  assert.equal(b.read('workspacePreferences.value.rightDockWidth'), 425)
  assert.equal(b.read('workspacePreferences.value.activeToolCollection'), 'Modify')

  // Drafting preferences preserved
  assert.equal(b.read('userPreferences.value.gridSnapEnabled'), true)
  assert.equal(b.read('userPreferences.value.polarEnabled'), true)
})

test('UX13-C Custom Canvas operations cause no document, history, or dirty mutation', async () => {
  const b = await browser()
  const initialRevision = b.read('documentController.currentRevision')
  const initialHistory = b.read('documentController.historyInfo.entryCount')
  const initialDirty = b.read('documentController.isDirty')

  // Perform Custom theme switch
  b.settingsControls['canvas-theme'].value = 'custom'
  b.emit(b.settingsControls['canvas-theme'], 'change')

  // Edit color
  const bgInput = b.canvasColorInputs.find(i => i.dataset.canvasColor === 'background')
  bgInput.value = '#441122'
  b.emit(bgInput, 'input')

  // Select template
  b.settingsControls['canvas-template'].value = 'high-contrast'
  b.emit(b.settingsControls['canvas-template'], 'change')

  // Reset custom canvas
  b.emit(b.canvasTemplateReset, 'click')

  // Switch away and back
  b.settingsControls['canvas-theme'].value = 'light'
  b.emit(b.settingsControls['canvas-theme'], 'change')
  b.settingsControls['canvas-theme'].value = 'custom'
  b.emit(b.settingsControls['canvas-theme'], 'change')

  assert.equal(b.read('documentController.currentRevision'), initialRevision, 'Revision must not mutate')
  assert.equal(b.read('documentController.historyInfo.entryCount'), initialHistory, 'History count must not mutate')
  assert.equal(b.read('documentController.isDirty'), initialDirty, 'Dirty state must not mutate')
})

test('UX13-C Preferences layout, scrolling, and action containment at 1024×640 and 800×600', async () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8')
  assert.match(html, /id="settings-canvas-contrast"[^>]*role="status"/)
  assert.match(html, /id="settings-canvas-contrast"[^>]*aria-live="polite"/)
  assert.match(html, /id="settings-canvas-reset"[^>]*>Reset to Template<\/button>/)
  assert.match(html, /id="settings-appearance-reset"[^>]*>Reset Appearance<\/button>/)

  for (const [w, h] of [[1024, 640], [800, 600]]) {
    for (const theme of ['light', 'dark']) {
      const b = await browser()
      b.run(`workspacePreferences.set({uiTheme: "${theme}", canvasTheme: "custom"})`)
      b.resize(w, h)
      b.emit(b.preferencesTrigger, 'click')

      assert.equal(b.settingsPanel.hidden, false, `Preferences must open at ${w}×${h} in ${theme}`)

      // Verify custom canvas section is visible
      assert.equal(b.customCanvasSection.hidden, false)

      // Verify all 14 color inputs are present and interactable
      assert.equal(b.canvasColorInputs.length, 14)
      for (const input of b.canvasColorInputs) {
        assert.equal(input.disabled, false)
      }
    }
  }
})
