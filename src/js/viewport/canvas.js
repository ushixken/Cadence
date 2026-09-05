const canvas = document.querySelector("canvas")

const viewportSettings = {
  gridExtent: 1000, baseGridSpacing: 10, minimumGridSpacingPixels: 28,
  initialZoom: 5, wheelZoomSensitivity: 0.0015, dragZoomSensitivity: 0.01,
  backgroundColor: "#182633", gridColor: "rgba(167, 175, 187, 0.28)",
  gridBoundaryColor: "rgba(167, 175, 187, 0.55)", xAxisColor: "#984b51",
  yAxisColor: "#3b7658", geometryColor: "#e8edf4", previewColor: "rgba(232, 237, 244, 0.65)",
}
const camera = { panX: 0, panY: 0, zoom: viewportSettings.initialZoom }
const { reader: modelReader, legacyLineWriter } = window.CaderactDocument.createStore()
window.caderactDocument = modelReader
let viewportWidth = 0, viewportHeight = 0, renderer = null, isInitialized = false, isRenderScheduled = false
let isSpacePressed = false, navigationMode = null, activePointerId = null
let previousPointerX = 0, previousPointerY = 0, zoomAnchorX = 0, zoomAnchorY = 0
let activeCommand = null, pendingLineStart = null, previewLineEnd = null, lineSessionIds = null

function worldToScreen(x, y) { return { x: camera.panX + x * camera.zoom, y: camera.panY - y * camera.zoom } }
function screenToWorld(x, y) { return { x: (x - camera.panX) / camera.zoom, y: (camera.panY - y) / camera.zoom } }
function zoomAtScreenPoint(zoom, x, y) {
  if (!Number.isFinite(zoom) || zoom <= 0) return
  const point = screenToWorld(x, y)
  camera.zoom = zoom; camera.panX = x - point.x * zoom; camera.panY = y + point.y * zoom
}
function getAdaptiveGridSpacing() {
  const required = viewportSettings.minimumGridSpacingPixels / camera.zoom
  const magnitude = 10 ** Math.floor(Math.log10(required))
  for (const step of [1, 2, 5]) if (step * magnitude >= required) return Math.max(viewportSettings.baseGridSpacing, step * magnitude)
  return Math.max(viewportSettings.baseGridSpacing, 10 * magnitude)
}
function alignToPhysicalPixel(value, scale) { return (Math.round(value * scale) + 0.5) / scale }
function addSegment(segments, x1, y1, x2, y2) { segments.push(x1, y1, x2, y2) }
function colorToRgba(color) {
  if (color.startsWith("#")) {
    const value = Number.parseInt(color.slice(1), 16)
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, 1]
  }
  const values = color.match(/[\d.]+/g).map(Number)
  return [values[0] / 255, values[1] / 255, values[2] / 255, values[3] ?? 1]
}
function lineGroup(color, segments) { return { color, colorData: colorToRgba(color), lineWidth: 1, segments: new Float32Array(segments) } }

function createScene() {
  const scale = window.devicePixelRatio || 1, extent = viewportSettings.gridExtent
  const grid = [], boundary = [], xAxis = [], yAxis = [], geometry = [], preview = []
  const topLeft = screenToWorld(0, 0), bottomRight = screenToWorld(viewportWidth, viewportHeight)
  const minX = Math.max(-extent, topLeft.x), maxX = Math.min(extent, bottomRight.x)
  const minY = Math.max(-extent, bottomRight.y), maxY = Math.min(extent, topLeft.y)
  const top = worldToScreen(0, extent).y, bottom = worldToScreen(0, -extent).y
  const left = worldToScreen(-extent, 0).x, right = worldToScreen(extent, 0).x
  if (minX <= maxX && minY <= maxY) {
    const spacing = getAdaptiveGridSpacing()
    for (let x = Math.ceil(minX / spacing) * spacing; x <= maxX; x += spacing) if (Math.abs(x) >= spacing * 0.001) {
      const sx = alignToPhysicalPixel(worldToScreen(x, 0).x, scale); addSegment(grid, sx, Math.max(0, top), sx, Math.min(viewportHeight, bottom))
    }
    for (let y = Math.ceil(minY / spacing) * spacing; y <= maxY; y += spacing) if (Math.abs(y) >= spacing * 0.001) {
      const sy = alignToPhysicalPixel(worldToScreen(0, y).y, scale); addSegment(grid, Math.max(0, left), sy, Math.min(viewportWidth, right), sy)
    }
  }
  const visibleLeft = Math.max(0, left), visibleTop = Math.max(0, top), visibleRight = Math.min(viewportWidth, right), visibleBottom = Math.min(viewportHeight, bottom)
  if (visibleLeft <= visibleRight && visibleTop <= visibleBottom) {
    if (top >= 0 && top <= viewportHeight) addSegment(boundary, visibleLeft, alignToPhysicalPixel(top, scale), visibleRight, alignToPhysicalPixel(top, scale))
    if (bottom >= 0 && bottom <= viewportHeight) addSegment(boundary, visibleLeft, alignToPhysicalPixel(bottom, scale), visibleRight, alignToPhysicalPixel(bottom, scale))
    if (left >= 0 && left <= viewportWidth) addSegment(boundary, alignToPhysicalPixel(left, scale), visibleTop, alignToPhysicalPixel(left, scale), visibleBottom)
    if (right >= 0 && right <= viewportWidth) addSegment(boundary, alignToPhysicalPixel(right, scale), visibleTop, alignToPhysicalPixel(right, scale), visibleBottom)
  }
  const origin = worldToScreen(0, 0)
  if (origin.y >= 0 && origin.y <= viewportHeight && right >= 0 && left <= viewportWidth) addSegment(xAxis, Math.max(0, left), alignToPhysicalPixel(origin.y, scale), Math.min(viewportWidth, right), alignToPhysicalPixel(origin.y, scale))
  if (origin.x >= 0 && origin.x <= viewportWidth && bottom >= 0 && top <= viewportHeight) addSegment(yAxis, alignToPhysicalPixel(origin.x, scale), Math.max(0, top), alignToPhysicalPixel(origin.x, scale), Math.min(viewportHeight, bottom))
  for (const line of modelReader.lines()) { const a = worldToScreen(line.start.x, line.start.y), b = worldToScreen(line.end.x, line.end.y); addSegment(geometry, a.x, a.y, b.x, b.y) }
  if (activeCommand === "line" && pendingLineStart && previewLineEnd) {
    const a = worldToScreen(pendingLineStart.x, pendingLineStart.y), b = worldToScreen(previewLineEnd.x, previewLineEnd.y); addSegment(preview, a.x, a.y, b.x, b.y)
  }
  return {
    width: viewportWidth, height: viewportHeight, deviceScale: scale, backgroundColor: viewportSettings.backgroundColor,
    backgroundColorData: colorToRgba(viewportSettings.backgroundColor),
    lineGroups: [lineGroup(viewportSettings.gridColor, grid), lineGroup(viewportSettings.gridBoundaryColor, boundary), lineGroup(viewportSettings.xAxisColor, xAxis), lineGroup(viewportSettings.yAxisColor, yAxis), lineGroup(viewportSettings.geometryColor, geometry), lineGroup(viewportSettings.previewColor, preview)],
  }
}
function requestRender() {
  if (!renderer || isRenderScheduled || viewportWidth <= 0 || viewportHeight <= 0) return
  isRenderScheduled = true
  requestAnimationFrame(() => { isRenderScheduled = false; renderer?.render(createScene()) })
}
function updateCommandFeedback(message) { document.dispatchEvent(new CustomEvent("caderact:command-feedback", { detail: { message } })) }
function startLineCommand() {
  activeCommand = "line"; pendingLineStart = null; previewLineEnd = null; lineSessionIds = []
  updateCommandFeedback("Line: Specify first point"); requestRender()
}
function finishActiveCommand() {
  if (activeCommand === null) return false
  activeCommand = null; pendingLineStart = null; previewLineEnd = null; lineSessionIds = null
  updateCommandFeedback("Type a command..."); requestRender(); return true
}
function cancelActiveCommand() {
  if (activeCommand === null) return false
  if (activeCommand === "line" && lineSessionIds !== null) legacyLineWriter.remove(lineSessionIds)
  return finishActiveCommand()
}
window.caderactViewport = { startLineCommand, finishActiveCommand, cancelActiveCommand }
function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect(), width = bounds.width, height = bounds.height
  if (!isInitialized) { camera.panX = width / 2; camera.panY = height / 2; isInitialized = true }
  else { camera.panX += (width - viewportWidth) / 2; camera.panY += (height - viewportHeight) / 2 }
  viewportWidth = width; viewportHeight = height
  renderer?.resize(width, height, window.devicePixelRatio || 1); requestRender()
}
function getCanvasPoint(event) { const bounds = canvas.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top } }
canvas.addEventListener("pointerdown", (event) => {
  const isSpaceDrag = event.button === 0 && isSpacePressed, isMiddleMouseDrag = event.button === 1
  if (!isSpaceDrag && !isMiddleMouseDrag) return
  const point = getCanvasPoint(event)
  navigationMode = event.ctrlKey ? "zoom" : "pan"; activePointerId = event.pointerId
  previousPointerX = point.x; previousPointerY = point.y; zoomAnchorX = point.x; zoomAnchorY = point.y
  canvas.setPointerCapture(event.pointerId); canvas.classList.add("is-navigating"); event.preventDefault()
})
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || navigationMode !== null || activeCommand !== "line") return
  const point = getCanvasPoint(event), worldPoint = screenToWorld(point.x, point.y)
  if (pendingLineStart === null) { pendingLineStart = worldPoint; previewLineEnd = worldPoint; updateCommandFeedback("Line: Specify next point") }
  else { lineSessionIds.push(legacyLineWriter.add(pendingLineStart, worldPoint)); pendingLineStart = worldPoint; previewLineEnd = worldPoint }
  requestRender()
})
canvas.addEventListener("pointermove", (event) => {
  let changed = false
  if (activeCommand === "line" && pendingLineStart !== null && navigationMode === null) {
    const point = getCanvasPoint(event); previewLineEnd = screenToWorld(point.x, point.y); changed = true
  }
  if (event.pointerId === activePointerId && navigationMode !== null) {
    const point = getCanvasPoint(event)
    if (navigationMode === "pan") { camera.panX += point.x - previousPointerX; camera.panY += point.y - previousPointerY }
    else zoomAtScreenPoint(camera.zoom * Math.exp((point.x - previousPointerX) * viewportSettings.dragZoomSensitivity), zoomAnchorX, zoomAnchorY)
    previousPointerX = point.x; previousPointerY = point.y; changed = true; event.preventDefault()
  }
  if (changed) requestRender()
})
function stopNavigation(event) {
  if (event && activePointerId !== null && event.pointerId !== activePointerId) return
  navigationMode = null; activePointerId = null; canvas.classList.remove("is-navigating")
}
canvas.addEventListener("pointerup", stopNavigation); canvas.addEventListener("pointercancel", stopNavigation); canvas.addEventListener("lostpointercapture", stopNavigation)
canvas.addEventListener("wheel", (event) => {
  const point = getCanvasPoint(event)
  zoomAtScreenPoint(camera.zoom * Math.exp(-event.deltaY * viewportSettings.wheelZoomSensitivity), point.x, point.y)
  requestRender(); event.preventDefault()
}, { passive: false })
canvas.addEventListener("pointerenter", () => canvas.classList.add("is-hovered"))
canvas.addEventListener("pointerleave", () => {
  canvas.classList.remove("is-hovered")
  if (activeCommand === "line" && previewLineEnd !== null) { previewLineEnd = null; requestRender() }
})
window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || !canvas.classList.contains("is-hovered")) return
  isSpacePressed = true; canvas.classList.add("is-navigation-ready"); event.preventDefault()
})
window.addEventListener("keyup", (event) => {
  if (event.code !== "Space") return
  isSpacePressed = false; canvas.classList.remove("is-navigation-ready"); stopNavigation()
})
window.addEventListener("blur", () => { isSpacePressed = false; canvas.classList.remove("is-navigation-ready"); stopNavigation() })
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
