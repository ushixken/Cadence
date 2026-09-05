let canvas = document.querySelector("canvas")
const canvasOwner = window.CaderactViewportCanvas.createOwner(canvas)

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
let rendererStatus = "initializing", rendererError = null, recoveryPromise = null
let navigation = null, resizeObserver = null
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
    const activeRenderer = renderer
    if (!activeRenderer) return
    try { activeRenderer.render(createScene()) }
    catch (error) {
      if (rendererStatus === "fallback-active" || activeRenderer.kind === "canvas2d") {
        console.warn("Caderact Canvas2D fallback failed; rendering disabled", error)
        failRenderer(error, activeRenderer)
      } else {
        console.warn("Caderact renderer failed; attempting recovery", error)
        recoverRenderer(activeRenderer)
      }
    }
  })
}

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

function getRendererState() {
  return Object.freeze({ status: rendererStatus, error: rendererError, canvasReplacements: canvasOwner.replacementCount })
}

window.caderactViewport = { startLineCommand, finishActiveCommand, cancelActiveCommand, stepUndoActiveCommand, getRendererState }

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

function onLinePointerDown(event) {
  if (event.button !== 0 || navigation.isActive() || activeCommand !== "line") return
  const point = getCanvasPoint(event)
  const worldPoint = screenToWorld(point.x, point.y)
  const outcome = lineDraft.acceptPoint(worldPoint)
  if (outcome.status === "first-point") updateCommandFeedback("Line: Specify next point")
  requestRender()
}

function onLinePointerMove(event) {
  if (activeCommand !== "line" || !lineDraft.hasFirstPoint || navigation.isActive()) return
  const point = getCanvasPoint(event)
  lineDraft.updatePointer(screenToWorld(point.x, point.y))
  requestRender()
}

function onLinePointerLeave() {
  if (activeCommand === "line" && lineDraft?.preview() !== null) {
    lineDraft.clearPointer()
    requestRender()
  }
}

function bindCanvas(nextCanvas) {
  navigation?.dispose()
  resizeObserver?.disconnect()
  canvas = nextCanvas
  navigation = window.CaderactViewportNavigation.bindViewportNavigation({
    canvas, camera: viewportCamera, viewportSettings, getCanvasPoint, requestRender,
  })
  canvas.addEventListener("pointerdown", onLinePointerDown)
  canvas.addEventListener("pointermove", onLinePointerMove)
  canvas.addEventListener("pointerleave", onLinePointerLeave)
  resizeObserver = new ResizeObserver(resizeCanvas)
  resizeObserver.observe(canvas)
}

function replaceCanvas() {
  const replacement = canvasOwner.replace()
  bindCanvas(replacement)
  return replacement
}

function installRenderer(createdRenderer) {
  renderer = createdRenderer
  rendererStatus = createdRenderer.kind === "canvas2d" ? "fallback-active" : "ready"
  rendererError = null
  createdRenderer.onDeviceLost = () => recoverRenderer(createdRenderer)
  resizeCanvas()
}

function failRenderer(error, failedRenderer = null) {
  if (failedRenderer && renderer === failedRenderer) {
    renderer = null
    failedRenderer.destroy?.()
  } else if (!failedRenderer) renderer = null
  rendererStatus = "failed"
  rendererError = error?.message || String(error)
  console.warn("Caderact renderer unavailable", error)
  return Object.freeze({ status: "failed", error: rendererError })
}

function recoverRenderer(failedRenderer) {
  if (failedRenderer !== renderer) return Promise.resolve(Object.freeze({ status: "stale-recovery" }))
  if (recoveryPromise) return recoveryPromise
  renderer = null
  rendererStatus = "recovering"
  failedRenderer.destroy?.()
  recoveryPromise = (async () => {
    try {
      const recoveryCanvas = replaceCanvas()
      const recoveredRenderer = await window.createCaderactRenderer(recoveryCanvas, { preferCanvas2D: true })
      installRenderer(recoveredRenderer)
      return Object.freeze({ status: "recovered" })
    } catch (error) {
      return failRenderer(error)
    } finally {
      recoveryPromise = null
    }
  })()
  return recoveryPromise
}

bindCanvas(canvas)
window.addEventListener("resize", resizeCanvas)

window.createCaderactRenderer(canvas, { replaceCanvasForFallback: replaceCanvas })
  .then(installRenderer)
  .catch(failRenderer)
