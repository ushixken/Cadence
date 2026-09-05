(() => {
  function createSceneBuilder({ viewportSettings, camera, getViewportSize, getLines, getDraftLines = () => [], getPreview }) {
    function getAdaptiveGridSpacing() {
      const required = viewportSettings.minimumGridSpacingPixels / camera.state.zoom
      const magnitude = 10 ** Math.floor(Math.log10(required))
      for (const step of [1, 2, 5]) {
        if (step * magnitude >= required) return Math.max(viewportSettings.baseGridSpacing, step * magnitude)
      }
      return Math.max(viewportSettings.baseGridSpacing, 10 * magnitude)
    }

    function alignToPhysicalPixel(value, scale) {
      return (Math.round(value * scale) + 0.5) / scale
    }

    function addSegment(segments, x1, y1, x2, y2) {
      segments.push(x1, y1, x2, y2)
    }

    function colorToRgba(color) {
      if (color.startsWith("#")) {
        const value = Number.parseInt(color.slice(1), 16)
        return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, 1]
      }
      const values = color.match(/[\d.]+/g).map(Number)
      return [values[0] / 255, values[1] / 255, values[2] / 255, values[3] ?? 1]
    }

    function lineGroup(color, segments) {
      return { color, colorData: colorToRgba(color), lineWidth: 1, segments: new Float32Array(segments) }
    }

    function createScene() {
      const { width: viewportWidth, height: viewportHeight } = getViewportSize()
      const scale = window.devicePixelRatio || 1
      const extent = viewportSettings.gridExtent
      const grid = [], boundary = [], xAxis = [], yAxis = [], geometry = [], preview = []
      const topLeft = camera.screenToWorld(0, 0)
      const bottomRight = camera.screenToWorld(viewportWidth, viewportHeight)
      const minX = Math.max(-extent, topLeft.x), maxX = Math.min(extent, bottomRight.x)
      const minY = Math.max(-extent, bottomRight.y), maxY = Math.min(extent, topLeft.y)
      const top = camera.worldToScreen(0, extent).y, bottom = camera.worldToScreen(0, -extent).y
      const left = camera.worldToScreen(-extent, 0).x, right = camera.worldToScreen(extent, 0).x

      if (minX <= maxX && minY <= maxY) {
        const spacing = getAdaptiveGridSpacing()
        for (let x = Math.ceil(minX / spacing) * spacing; x <= maxX; x += spacing) {
          if (Math.abs(x) >= spacing * 0.001) {
            const sx = alignToPhysicalPixel(camera.worldToScreen(x, 0).x, scale)
            addSegment(grid, sx, Math.max(0, top), sx, Math.min(viewportHeight, bottom))
          }
        }
        for (let y = Math.ceil(minY / spacing) * spacing; y <= maxY; y += spacing) {
          if (Math.abs(y) >= spacing * 0.001) {
            const sy = alignToPhysicalPixel(camera.worldToScreen(0, y).y, scale)
            addSegment(grid, Math.max(0, left), sy, Math.min(viewportWidth, right), sy)
          }
        }
      }

      const visibleLeft = Math.max(0, left), visibleTop = Math.max(0, top)
      const visibleRight = Math.min(viewportWidth, right), visibleBottom = Math.min(viewportHeight, bottom)
      if (visibleLeft <= visibleRight && visibleTop <= visibleBottom) {
        if (top >= 0 && top <= viewportHeight) addSegment(boundary, visibleLeft, alignToPhysicalPixel(top, scale), visibleRight, alignToPhysicalPixel(top, scale))
        if (bottom >= 0 && bottom <= viewportHeight) addSegment(boundary, visibleLeft, alignToPhysicalPixel(bottom, scale), visibleRight, alignToPhysicalPixel(bottom, scale))
        if (left >= 0 && left <= viewportWidth) addSegment(boundary, alignToPhysicalPixel(left, scale), visibleTop, alignToPhysicalPixel(left, scale), visibleBottom)
        if (right >= 0 && right <= viewportWidth) addSegment(boundary, alignToPhysicalPixel(right, scale), visibleTop, alignToPhysicalPixel(right, scale), visibleBottom)
      }

      const origin = camera.worldToScreen(0, 0)
      if (origin.y >= 0 && origin.y <= viewportHeight && right >= 0 && left <= viewportWidth) {
        addSegment(xAxis, Math.max(0, left), alignToPhysicalPixel(origin.y, scale), Math.min(viewportWidth, right), alignToPhysicalPixel(origin.y, scale))
      }
      if (origin.x >= 0 && origin.x <= viewportWidth && bottom >= 0 && top <= viewportHeight) {
        addSegment(yAxis, alignToPhysicalPixel(origin.x, scale), Math.max(0, top), alignToPhysicalPixel(origin.x, scale), Math.min(viewportHeight, bottom))
      }

      for (const line of getLines()) {
        const a = camera.worldToScreen(line.start.x, line.start.y)
        const b = camera.worldToScreen(line.end.x, line.end.y)
        addSegment(geometry, a.x, a.y, b.x, b.y)
      }

      // Accepted Line draft segments share the active-tool overlay group with
      // the rubber band, but remain separate from authoritative geometry.
      for (const line of getDraftLines()) {
        const a = camera.worldToScreen(line.start.x, line.start.y)
        const b = camera.worldToScreen(line.end.x, line.end.y)
        addSegment(preview, a.x, a.y, b.x, b.y)
      }

      const activePreview = getPreview()
      if (activePreview) {
        const a = camera.worldToScreen(activePreview.start.x, activePreview.start.y)
        const b = camera.worldToScreen(activePreview.end.x, activePreview.end.y)
        addSegment(preview, a.x, a.y, b.x, b.y)
      }

      // The ordered groups are a renderer input, never authoritative geometry.
      return {
        width: viewportWidth, height: viewportHeight, deviceScale: scale,
        backgroundColor: viewportSettings.backgroundColor,
        backgroundColorData: colorToRgba(viewportSettings.backgroundColor),
        lineGroups: [
          lineGroup(viewportSettings.gridColor, grid),
          lineGroup(viewportSettings.gridBoundaryColor, boundary),
          lineGroup(viewportSettings.xAxisColor, xAxis),
          lineGroup(viewportSettings.yAxisColor, yAxis),
          lineGroup(viewportSettings.geometryColor, geometry),
          lineGroup(viewportSettings.previewColor, preview),
        ],
      }
    }

    return Object.freeze({ createScene, getAdaptiveGridSpacing })
  }

  window.CaderactViewportScene = Object.freeze({ createSceneBuilder })
})()
