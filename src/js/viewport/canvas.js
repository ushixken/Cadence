const canvas = document.querySelector("canvas")
const context = canvas.getContext("2d")

const viewportSettings = {
  gridExtent: 1000,
  baseGridSpacing: 10,
  minimumGridSpacingPixels: 28,
  initialZoom: 5,
  wheelZoomSensitivity: 0.0015,
  dragZoomSensitivity: 0.01,
  backgroundColor: "#182633",
  gridColor: "rgba(167, 175, 187, 0.28)",
  gridBoundaryColor: "rgba(167, 175, 187, 0.55)",
  xAxisColor: "#984b51",
  yAxisColor: "#3b7658",
  geometryColor: "#e8edf4",
  previewColor: "rgba(232, 237, 244, 0.65)",
}

// panX and panY are the screen position of the world origin, in CSS pixels.
const camera = {
  panX: 0,
  panY: 0,
  zoom: viewportSettings.initialZoom,
}

let viewportWidth = 0
let viewportHeight = 0
let isInitialized = false
let isSpacePressed = false
let navigationMode = null
let activePointerId = null
let previousPointerX = 0
let previousPointerY = 0
let zoomAnchorX = 0
let zoomAnchorY = 0
const completedLines = []
let activeCommand = null
let pendingLineStart = null
let previewLineEnd = null
let lineSessionStartIndex = null

function worldToScreen(worldX, worldY) {
  return {
    x: camera.panX + worldX * camera.zoom,
    y: camera.panY - worldY * camera.zoom,
  }
}

function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - camera.panX) / camera.zoom,
    y: (camera.panY - screenY) / camera.zoom,
  }
}

function zoomAtScreenPoint(targetZoom, screenX, screenY) {
  if (!Number.isFinite(targetZoom) || targetZoom <= 0) return

  const anchoredWorldPoint = screenToWorld(screenX, screenY)
  camera.zoom = targetZoom
  camera.panX = screenX - anchoredWorldPoint.x * camera.zoom
  camera.panY = screenY + anchoredWorldPoint.y * camera.zoom
}

function getAdaptiveGridSpacing() {
  const requiredWorldSpacing = viewportSettings.minimumGridSpacingPixels / camera.zoom
  const spacingSteps = [1, 2, 5]
  const magnitude = 10 ** Math.floor(Math.log10(requiredWorldSpacing))

  for (const step of spacingSteps) {
    const candidate = step * magnitude
    if (candidate >= requiredWorldSpacing) {
      return Math.max(viewportSettings.baseGridSpacing, candidate)
    }
  }

  return Math.max(viewportSettings.baseGridSpacing, 10 * magnitude)
}

function alignToPhysicalPixel(value, deviceScale, physicalLineWidth = 1) {
  const pixelOffset = physicalLineWidth % 2 === 0 ? 0 : 0.5
  return (Math.round(value * deviceScale) + pixelOffset) / deviceScale
}

function drawGridLines(deviceScale) {
  const extent = viewportSettings.gridExtent
  const spacing = getAdaptiveGridSpacing()
  const topLeft = screenToWorld(0, 0)
  const bottomRight = screenToWorld(viewportWidth, viewportHeight)
  const visibleMinX = Math.max(-extent, topLeft.x)
  const visibleMaxX = Math.min(extent, bottomRight.x)
  const visibleMinY = Math.max(-extent, bottomRight.y)
  const visibleMaxY = Math.min(extent, topLeft.y)

  if (visibleMinX > visibleMaxX || visibleMinY > visibleMaxY) return

  const firstX = Math.ceil(visibleMinX / spacing) * spacing
  const firstY = Math.ceil(visibleMinY / spacing) * spacing
  const gridTop = worldToScreen(0, extent).y
  const gridBottom = worldToScreen(0, -extent).y
  const gridLeft = worldToScreen(-extent, 0).x
  const gridRight = worldToScreen(extent, 0).x

  context.beginPath()
  context.strokeStyle = viewportSettings.gridColor
  context.lineWidth = 1 / deviceScale

  for (let worldX = firstX; worldX <= visibleMaxX; worldX += spacing) {
    if (Math.abs(worldX) < spacing * 0.001) continue
    const screenX = alignToPhysicalPixel(worldToScreen(worldX, 0).x, deviceScale)
    context.moveTo(screenX, Math.max(0, gridTop))
    context.lineTo(screenX, Math.min(viewportHeight, gridBottom))
  }

  for (let worldY = firstY; worldY <= visibleMaxY; worldY += spacing) {
    if (Math.abs(worldY) < spacing * 0.001) continue
    const screenY = alignToPhysicalPixel(worldToScreen(0, worldY).y, deviceScale)
    context.moveTo(Math.max(0, gridLeft), screenY)
    context.lineTo(Math.min(viewportWidth, gridRight), screenY)
  }

  context.stroke()
}

function drawAxes(deviceScale) {
  const extent = viewportSettings.gridExtent
  const origin = worldToScreen(0, 0)
  const left = worldToScreen(-extent, 0).x
  const right = worldToScreen(extent, 0).x
  const top = worldToScreen(0, extent).y
  const bottom = worldToScreen(0, -extent).y
  context.lineWidth = 1 / deviceScale

  if (origin.y >= 0 && origin.y <= viewportHeight && right >= 0 && left <= viewportWidth) {
    const axisY = alignToPhysicalPixel(origin.y, deviceScale)
    context.beginPath()
    context.strokeStyle = viewportSettings.xAxisColor
    context.moveTo(Math.max(0, left), axisY)
    context.lineTo(Math.min(viewportWidth, right), axisY)
    context.stroke()
  }

  if (origin.x >= 0 && origin.x <= viewportWidth && bottom >= 0 && top <= viewportHeight) {
    const axisX = alignToPhysicalPixel(origin.x, deviceScale)
    context.beginPath()
    context.strokeStyle = viewportSettings.yAxisColor
    context.moveTo(axisX, Math.max(0, top))
    context.lineTo(axisX, Math.min(viewportHeight, bottom))
    context.stroke()
  }
}

function drawGridBoundary(deviceScale) {
  const extent = viewportSettings.gridExtent
  const topLeft = worldToScreen(-extent, extent)
  const bottomRight = worldToScreen(extent, -extent)
  const visibleLeft = Math.max(0, topLeft.x)
  const visibleTop = Math.max(0, topLeft.y)
  const visibleRight = Math.min(viewportWidth, bottomRight.x)
  const visibleBottom = Math.min(viewportHeight, bottomRight.y)

  if (visibleLeft > visibleRight || visibleTop > visibleBottom) return

  context.beginPath()
  context.strokeStyle = viewportSettings.gridBoundaryColor
  context.lineWidth = 1 / deviceScale

  if (topLeft.y >= 0 && topLeft.y <= viewportHeight) {
    const top = alignToPhysicalPixel(topLeft.y, deviceScale)
    context.moveTo(visibleLeft, top)
    context.lineTo(visibleRight, top)
  }
  if (bottomRight.y >= 0 && bottomRight.y <= viewportHeight) {
    const bottom = alignToPhysicalPixel(bottomRight.y, deviceScale)
    context.moveTo(visibleLeft, bottom)
    context.lineTo(visibleRight, bottom)
  }
  if (topLeft.x >= 0 && topLeft.x <= viewportWidth) {
    const left = alignToPhysicalPixel(topLeft.x, deviceScale)
    context.moveTo(left, visibleTop)
    context.lineTo(left, visibleBottom)
  }
  if (bottomRight.x >= 0 && bottomRight.x <= viewportWidth) {
    const right = alignToPhysicalPixel(bottomRight.x, deviceScale)
    context.moveTo(right, visibleTop)
    context.lineTo(right, visibleBottom)
  }

  context.stroke()
}

function drawCompletedLines(deviceScale) {
  if (completedLines.length === 0) return

  context.beginPath()
  context.strokeStyle = viewportSettings.geometryColor
  context.lineWidth = 1 / deviceScale

  completedLines.forEach((line) => {
    const start = worldToScreen(line.start.x, line.start.y)
    const end = worldToScreen(line.end.x, line.end.y)
    context.moveTo(start.x, start.y)
    context.lineTo(end.x, end.y)
  })

  context.stroke()
}

function drawLinePreview(deviceScale) {
  if (activeCommand !== "line" || pendingLineStart === null || previewLineEnd === null) return

  const start = worldToScreen(pendingLineStart.x, pendingLineStart.y)
  const end = worldToScreen(previewLineEnd.x, previewLineEnd.y)
  context.beginPath()
  context.strokeStyle = viewportSettings.previewColor
  context.lineWidth = 1 / deviceScale
  context.moveTo(start.x, start.y)
  context.lineTo(end.x, end.y)
  context.stroke()
}

function renderViewport() {
  const deviceScale = window.devicePixelRatio || 1
  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0)
  context.fillStyle = viewportSettings.backgroundColor
  context.fillRect(0, 0, viewportWidth, viewportHeight)
  drawGridLines(deviceScale)
  drawGridBoundary(deviceScale)
  drawAxes(deviceScale)
  drawCompletedLines(deviceScale)
  drawLinePreview(deviceScale)
}

function updateCommandFeedback(message) {
  document.dispatchEvent(
    new CustomEvent("caderact:command-feedback", { detail: { message } }),
  )
}

function startLineCommand() {
  activeCommand = "line"
  pendingLineStart = null
  previewLineEnd = null
  lineSessionStartIndex = completedLines.length
  updateCommandFeedback("Line: Specify first point")
}

function finishActiveCommand() {
  if (activeCommand === null) return false

  activeCommand = null
  pendingLineStart = null
  previewLineEnd = null
  lineSessionStartIndex = null
  updateCommandFeedback("Type a command...")
  renderViewport()
  return true
}

function cancelActiveCommand() {
  if (activeCommand === null) return false

  if (activeCommand === "line" && lineSessionStartIndex !== null) {
    completedLines.splice(lineSessionStartIndex)
  }

  return finishActiveCommand()
}

window.caderactViewport = {
  startLineCommand,
  finishActiveCommand,
  cancelActiveCommand,
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect()
  const newWidth = bounds.width
  const newHeight = bounds.height
  const deviceScale = window.devicePixelRatio || 1

  if (!isInitialized) {
    camera.panX = newWidth / 2
    camera.panY = newHeight / 2
    isInitialized = true
  } else {
    camera.panX += (newWidth - viewportWidth) / 2
    camera.panY += (newHeight - viewportHeight) / 2
  }

  viewportWidth = newWidth
  viewportHeight = newHeight
  canvas.width = Math.max(1, Math.round(newWidth * deviceScale))
  canvas.height = Math.max(1, Math.round(newHeight * deviceScale))
  renderViewport()
}

function getCanvasPoint(event) {
  const bounds = canvas.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

canvas.addEventListener("pointerdown", (event) => {
  const isSpaceDrag = event.button === 0 && isSpacePressed
  const isMiddleMouseDrag = event.button === 1
  if (!isSpaceDrag && !isMiddleMouseDrag) return

  const point = getCanvasPoint(event)
  navigationMode = event.ctrlKey && (isSpaceDrag || isMiddleMouseDrag) ? "zoom" : "pan"
  activePointerId = event.pointerId
  previousPointerX = point.x
  previousPointerY = point.y
  zoomAnchorX = point.x
  zoomAnchorY = point.y
  canvas.setPointerCapture(event.pointerId)
  canvas.classList.add("is-navigating")
  event.preventDefault()
})

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || navigationMode !== null || activeCommand !== "line") return

  const canvasPoint = getCanvasPoint(event)
  const worldPoint = screenToWorld(canvasPoint.x, canvasPoint.y)

  if (pendingLineStart === null) {
    pendingLineStart = worldPoint
    previewLineEnd = worldPoint
    updateCommandFeedback("Line: Specify next point")
    renderViewport()
    return
  }

  completedLines.push({ start: pendingLineStart, end: worldPoint })
  pendingLineStart = worldPoint
  previewLineEnd = worldPoint
  updateCommandFeedback("Line: Specify next point")
  renderViewport()
})

canvas.addEventListener("pointermove", (event) => {
  if (activeCommand !== "line" || pendingLineStart === null || navigationMode !== null) return

  const canvasPoint = getCanvasPoint(event)
  previewLineEnd = screenToWorld(canvasPoint.x, canvasPoint.y)
  renderViewport()
})

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== activePointerId || navigationMode === null) return

  const point = getCanvasPoint(event)
  if (navigationMode === "pan") {
    camera.panX += point.x - previousPointerX
    camera.panY += point.y - previousPointerY
  } else {
    const horizontalMovement = point.x - previousPointerX
    const zoomFactor = Math.exp(horizontalMovement * viewportSettings.dragZoomSensitivity)
    zoomAtScreenPoint(camera.zoom * zoomFactor, zoomAnchorX, zoomAnchorY)
  }

  previousPointerX = point.x
  previousPointerY = point.y
  renderViewport()
  event.preventDefault()
})

function stopNavigation(event) {
  if (event && activePointerId !== null && event.pointerId !== activePointerId) return
  navigationMode = null
  activePointerId = null
  canvas.classList.remove("is-navigating")
}

canvas.addEventListener("pointerup", stopNavigation)
canvas.addEventListener("pointercancel", stopNavigation)
canvas.addEventListener("lostpointercapture", stopNavigation)

canvas.addEventListener("wheel", (event) => {
  const point = getCanvasPoint(event)
  const zoomFactor = Math.exp(-event.deltaY * viewportSettings.wheelZoomSensitivity)
  zoomAtScreenPoint(camera.zoom * zoomFactor, point.x, point.y)
  renderViewport()
  event.preventDefault()
}, { passive: false })

canvas.addEventListener("pointerenter", () => canvas.classList.add("is-hovered"))
canvas.addEventListener("pointerleave", () => {
  canvas.classList.remove("is-hovered")
  if (activeCommand === "line" && previewLineEnd !== null) {
    previewLineEnd = null
    renderViewport()
  }
})

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || !canvas.classList.contains("is-hovered")) return
  isSpacePressed = true
  canvas.classList.add("is-navigation-ready")
  event.preventDefault()
})

window.addEventListener("keyup", (event) => {
  if (event.code !== "Space") return
  isSpacePressed = false
  canvas.classList.remove("is-navigation-ready")
  stopNavigation()
})

window.addEventListener("blur", () => {
  isSpacePressed = false
  canvas.classList.remove("is-navigation-ready")
  stopNavigation()
})

new ResizeObserver(resizeCanvas).observe(canvas)
window.addEventListener("resize", resizeCanvas)
