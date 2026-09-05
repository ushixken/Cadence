const canvas = document.querySelector("canvas")

const viewportSettings = {
  gridExtent: 1000, baseGridSpacing: 10, minimumGridSpacingPixels: 28,
  initialZoom: 5, wheelZoomSensitivity: 0.0015, dragZoomSensitivity: 0.01,
  backgroundColor: "#182633", gridColor: "rgba(167, 175, 187, 0.28)",
  gridBoundaryColor: "rgba(167, 175, 187, 0.55)", xAxisColor: "#984b51",
  yAxisColor: "#3b7658", geometryColor: "#e8edf4", previewColor: "rgba(232, 237, 244, 0.65)",
}

const viewportCamera = window.CaderactViewportCamera.createCamera(viewportSettings.initialZoom)
const camera = viewportCamera.state
const { reader: modelReader, recordGateway, layerGateway, unitGateway, controller: documentController } = window.CaderactDocument.createStore()
window.caderactDocument = modelReader

let viewportWidth = 0, viewportHeight = 0
let renderer = null, isInitialized = false, isRenderScheduled = false
let activeCommand = null, lineDraft = null

function worldToScreen(x, y) {
  return viewportCamera.worldToScreen(x, y)
}

function screenToWorld(x, y) {
  return viewportCamera.screenToWorld(x, y)
}

function zoomAtScreenPoint(zoom, x, y) {
  viewportCamera.zoomAtScreenPoint(zoom, x, y)
}

function getCanvasPoint(event) {
  const bounds = canvas.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

const sceneBuilder = window.CaderactViewportScene.createSceneBuilder({
  viewportSettings,
  camera: viewportCamera,
  getViewportSize: () => ({ width: viewportWidth, height: viewportHeight }),
  getRecords: () => modelReader.records(),
  getDraftLines: () => activeCommand === "line" && lineDraft ? lineDraft.draftSegments() : [],
  getPreview: () => activeCommand === "line" && lineDraft ? lineDraft.preview() : null,
})

function createScene() {
  return sceneBuilder.createScene()
}

function requestRender() {
  if (!renderer || isRenderScheduled || viewportWidth <= 0 || viewportHeight <= 0) return
  isRenderScheduled = true
  requestAnimationFrame(() => {
    isRenderScheduled = false
    renderer?.render(createScene())
  })
}

const navigation = window.CaderactViewportNavigation.bindViewportNavigation({
  canvas,
  camera: viewportCamera,
  viewportSettings,
  getCanvasPoint,
  requestRender,
})

function updateCommandFeedback(message) {
  document.dispatchEvent(new CustomEvent("caderact:command-feedback", { detail: { message } }))
}

function closeLineCommand() {
  activeCommand = null
  lineDraft = null
  updateCommandFeedback("Type a command...")
  requestRender()
}

function startLineCommand() {
  lineDraft?.cancel()
  activeCommand = "line"
  lineDraft = window.CaderactLineDraftSession.createSession({
    createSegment: recordGateway.createLine,
    commitSegments: recordGateway.createAll,
  })
  updateCommandFeedback("Line: Specify first point")
  requestRender()
}

function finishActiveCommand() {
  if (activeCommand === null) return false
  if (activeCommand === "line") {
    const outcome = lineDraft.finish()
    if (outcome.status !== "committed" && outcome.status !== "no-op") {
      updateCommandFeedback("Line: Unable to commit; draft preserved")
      requestRender()
      return false
    }
  }
  closeLineCommand()
  return true
}

function cancelActiveCommand() {
  if (activeCommand === null) return false
  if (activeCommand === "line") lineDraft.cancel()
  closeLineCommand()
  return true
}

function stepUndoActiveCommand() {
  if (activeCommand !== "line" || !lineDraft) return Object.freeze({ status: "no-active-line" })
  const outcome = lineDraft.stepUndo()
  if (outcome.status === "step-undone") updateCommandFeedback("Line: Specify next point")
  requestRender()
  return outcome
}

window.caderactViewport = { startLineCommand, finishActiveCommand, cancelActiveCommand, stepUndoActiveCommand }

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect()
  const width = bounds.width, height = bounds.height
  if (!isInitialized) {
    camera.panX = width / 2
    camera.panY = height / 2
    isInitialized = true
  } else {
    camera.panX += (width - viewportWidth) / 2
    camera.panY += (height - viewportHeight) / 2
  }
  viewportWidth = width
  viewportHeight = height
  renderer?.resize(width, height, window.devicePixelRatio || 1)
  requestRender()
}

// This listener remains here because it owns the Line command, not generic
// navigation. Navigation registers first and claims its own pointer gestures.
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || navigation.isActive() || activeCommand !== "line") return
  const point = getCanvasPoint(event)
  const worldPoint = screenToWorld(point.x, point.y)
  const outcome = lineDraft.acceptPoint(worldPoint)
  if (outcome.status === "first-point") updateCommandFeedback("Line: Specify next point")
  requestRender()
})

canvas.addEventListener("pointermove", (event) => {
  if (activeCommand !== "line" || !lineDraft.hasFirstPoint || navigation.isActive()) return
  const point = getCanvasPoint(event)
  lineDraft.updatePointer(screenToWorld(point.x, point.y))
  requestRender()
})

canvas.addEventListener("pointerleave", () => {
  if (activeCommand === "line" && lineDraft?.preview() !== null) {
    lineDraft.clearPointer()
    requestRender()
  }
})

new ResizeObserver(resizeCanvas).observe(canvas)
window.addEventListener("resize", resizeCanvas)

window.createCaderactRenderer(canvas).then((createdRenderer) => {
  renderer = createdRenderer
  renderer.onDeviceLost = () => {
    window.createCaderactRenderer(canvas).then((recoveredRenderer) => {
      renderer = recoveredRenderer
      renderer.onDeviceLost = () => {
        console.warn("Caderact renderer recovery was unsuccessful")
      }
      resizeCanvas()
    })
  }
  resizeCanvas()
})
