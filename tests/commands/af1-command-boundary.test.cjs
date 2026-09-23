const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { browser } = require('../helpers/browser.cjs')

const root = path.join(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('AF1 production and VM core bootstrap keep identical relative script order', () => {
  const html = [...read('index.html').matchAll(/<script src="\.\/(src\/js\/[^\"]+)" defer><\/script>/g)].map(match => match[1])
  const harness = [...read('tests/helpers/browser.cjs').matchAll(/load\('(src\/js\/[^']+)'\)/g)].map(match => match[1])
  const first = 'src/js/geometry/ArcGeometry.js'
  const last = 'src/js/viewport/Viewport.js'
  const productionCore = html.slice(html.indexOf(first), html.indexOf(last) + 1)
    .filter(file => !['src/js/rendering/Renderer.js', 'src/js/rendering/Canvas2DRenderer.js', 'src/js/rendering/WebGPURenderer.js', 'src/js/rendering/createCaderactRenderer.js'].includes(file))
  const testCore = harness.slice(harness.indexOf(first), harness.indexOf(last) + 1)
    .filter(file => file !== 'src/js/rendering/StrokeStyle.js')
  assert.deepEqual(testCore, productionCore)
})

test('AF1 extension sessions enter the existing router and accept the resolved pointer', async () => {
  const b = await browser({ commands: false })
  b.run(`window.caderactCadCommands.register({name:'BoundaryProbe',aliases:['BP'],planner:{plan:point=>({point})},createSession:({reader,recordGateway,selection,planner,activation})=>{
    window.__af1Services={reader,recordGateway,selection,activation};
    return Object.freeze({name:'BoundaryProbe',prompt:'Pick a point',hasPointerPreview:()=>true,
      handlePointerDown:point=>{window.__af1Accepted=planner.plan({x:point.x,y:point.y}).point;return {status:'command-completed',command:'BoundaryProbe'}},
      handlePointerMove:()=>{},finish:()=>({status:'command-cancelled',command:'BoundaryProbe'}),cancel:()=>({status:'command-cancelled',command:'BoundaryProbe'})})
  }})`)
  b.load('src/js/editor/command-input.js')
  assert.equal(b.read('window.caderactCommandRegistry.resolve("BP").name'), 'BoundaryProbe')
  b.resize(800, 600)
  b.launch('BP')
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'BoundaryProbe')
  b.point(450, 250)
  assert.deepEqual(b.read('window.__af1Accepted'), { x: 10, y: 10 })
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null)
  assert.equal(b.read('window.__af1Services.reader === window.caderactDocumentSession.reader'), true)
  assert.equal(b.read('window.__af1Services.recordGateway === window.caderactDocumentSession.recordGateway'), true)
  assert.equal(b.read('window.caderactDocumentSession.controller.historyInfo.entryCount'), 0)
})
