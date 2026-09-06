(() => {
  function createSceneBuilder({ viewportSettings, camera, getViewportSize, getDocumentUnit = () => "mm", getRecords, getDraftLines = () => [], getPreview, getSnapResult = () => null, getSelectedIds = () => [] }) {
    const GRID_STEPS = Object.freeze([1, 2, 5])
    const MAJOR_MULTIPLE = 5
    const MAX_GRID_LINES_PER_AXIS = 512

    function getAdaptiveGridSpacing() {
      const zoom = camera.state.zoom
      if (!Number.isFinite(zoom) || zoom <= 0) return 1
      const required = viewportSettings.minimumGridSpacingPixels / zoom
      if (!Number.isFinite(required)) return 1e300
      if (required <= 0) return 1e-300
      const exponent = Math.max(-300, Math.min(300, Math.floor(Math.log10(required))))
      const magnitude = 10 ** exponent
      for (const step of GRID_STEPS) if (step * magnitude >= required) return step * magnitude
      return 10 * magnitude
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
      const minorGrid = [], majorGrid = [], boundary = [], xAxis = [], yAxis = [], geometry = [], preview = [], snapMarker = [], selection = []
      const topLeft = camera.screenToWorld(0, 0)
      const bottomRight = camera.screenToWorld(viewportWidth, viewportHeight)
      const minX = Math.max(-extent, topLeft.x), maxX = Math.min(extent, bottomRight.x)
      const minY = Math.max(-extent, bottomRight.y), maxY = Math.min(extent, topLeft.y)
      const top = camera.worldToScreen(0, extent).y, bottom = camera.worldToScreen(0, -extent).y
      const left = camera.worldToScreen(-extent, 0).x, right = camera.worldToScreen(extent, 0).x

      const spacing = getAdaptiveGridSpacing()
      if (Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight) && viewportWidth > 0 && viewportHeight > 0 &&
          Number.isFinite(spacing) && spacing > 0 && minX <= maxX && minY <= maxY) {
        function addVisibleLines(minimum, maximum, vertical) {
          const first = Math.ceil(minimum / spacing), last = Math.floor(maximum / spacing)
          if (!Number.isFinite(first) || !Number.isFinite(last) || first > last) return
          const count = Math.min(last - first + 1, MAX_GRID_LINES_PER_AXIS)
          for (let offset = 0; offset < count; offset++) {
            const index = first + offset
            if (index === 0) continue
            const coordinate = index * spacing
            const target = index % MAJOR_MULTIPLE === 0 ? majorGrid : minorGrid
            if (vertical) {
              const sx = alignToPhysicalPixel(camera.worldToScreen(coordinate, 0).x, scale)
              addSegment(target, sx, Math.max(0, top), sx, Math.min(viewportHeight, bottom))
            } else {
              const sy = alignToPhysicalPixel(camera.worldToScreen(0, coordinate).y, scale)
              addSegment(target, Math.max(0, left), sy, Math.min(viewportWidth, right), sy)
            }
          }
        }
        addVisibleLines(minX, maxX, true)
        addVisibleLines(minY, maxY, false)
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

      // A6 persistent projection: query the authoritative document read-side on
      // every scene build. Unknown record types are skipped deterministically.
      const records = getRecords(), selectedIds = new Set(getSelectedIds())
      for (const record of records) {
        if (record?.type !== "line") continue
        const a = camera.worldToScreen(record.start.x, record.start.y)
        const b = camera.worldToScreen(record.end.x, record.end.y)
        addSegment(geometry, a.x, a.y, b.x, b.y)
        if(selectedIds.has(record.id))addSegment(selection,a.x,a.y,b.x,b.y)
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

      const snap = getSnapResult()
      let snapOverlay = null
      if (snap?.snapped && Number.isFinite(snap.point?.x) && Number.isFinite(snap.point?.y)) {
        const center = camera.worldToScreen(snap.point.x, snap.point.y), size = 5
        if (snap.kind === "endpoint") {
          addSegment(snapMarker, center.x-size, center.y-size, center.x+size, center.y-size)
          addSegment(snapMarker, center.x+size, center.y-size, center.x+size, center.y+size)
          addSegment(snapMarker, center.x+size, center.y+size, center.x-size, center.y+size)
          addSegment(snapMarker, center.x-size, center.y+size, center.x-size, center.y-size)
        } else if (snap.kind === "midpoint") {
          addSegment(snapMarker, center.x, center.y-size, center.x+size, center.y+size)
          addSegment(snapMarker, center.x+size, center.y+size, center.x-size, center.y+size)
          addSegment(snapMarker, center.x-size, center.y+size, center.x, center.y-size)
        } else {
          addSegment(snapMarker, center.x-size, center.y, center.x+size, center.y)
          addSegment(snapMarker, center.x, center.y-size, center.x, center.y+size)
        }
        snapOverlay = Object.freeze({ kind: snap.kind, point: Object.freeze({ x: center.x, y: center.y }),
          label: snap.kind[0].toUpperCase()+snap.kind.slice(1), segments: new Float32Array(snapMarker) })
      }

      // The ordered groups are a renderer input, never authoritative geometry.
      const combinedMajorGrid = majorGrid.concat(boundary)
      return {
        width: viewportWidth, height: viewportHeight, deviceScale: scale,
        backgroundColor: viewportSettings.backgroundColor,
        backgroundColorData: colorToRgba(viewportSettings.backgroundColor),
        grid: Object.freeze({
          unit: getDocumentUnit(), minorSpacing: spacing, majorSpacing: spacing * MAJOR_MULTIPLE,
          majorMultiple: MAJOR_MULTIPLE, maxLinesPerAxis: MAX_GRID_LINES_PER_AXIS,
          minorSegments: new Float32Array(minorGrid), majorSegments: new Float32Array(majorGrid),
          boundarySegments: new Float32Array(boundary),
        }),
        snapOverlay,
        selectionOverlay: Object.freeze({recordIds:Object.freeze(Array.from(selectedIds).sort()),segments:new Float32Array(selection)}),
        lineGroups: [
          lineGroup(viewportSettings.gridColor, minorGrid),
          lineGroup(viewportSettings.majorGridColor || viewportSettings.gridBoundaryColor, combinedMajorGrid),
          lineGroup(viewportSettings.xAxisColor, xAxis),
          lineGroup(viewportSettings.yAxisColor, yAxis),
          lineGroup(viewportSettings.geometryColor, geometry),
          lineGroup(viewportSettings.previewColor, preview),
          lineGroup(viewportSettings.snapMarkerColor || viewportSettings.previewColor, snapMarker),
          {...lineGroup(viewportSettings.selectionColor || viewportSettings.geometryColor, selection),lineWidth:2},
        ],
      }
    }

    return Object.freeze({ createScene, getAdaptiveGridSpacing, GRID_STEPS, MAJOR_MULTIPLE, MAX_GRID_LINES_PER_AXIS })
  }

  window.CaderactViewportScene = Object.freeze({ createSceneBuilder })
})()
