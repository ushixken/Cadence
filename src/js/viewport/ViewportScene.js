(() => {
  function createSceneBuilder({ viewportSettings, camera, getViewportSize, getDocumentUnit = () => "mm", getRecords, getDraftLines = () => [], getPreview = () => null, getPreviewLines = null, getCirclePreview = () => null, getArcPreview = () => null, getEllipsePreview = () => null, getMovePreview = () => null, getDraftPoints = () => [], getSnapResult = () => null, getSelectedIds = () => [], getGrips = () => [], getGripPreview = () => null, getSelectionBox = () => null }) {
    const GRID_STEPS = Object.freeze([1, 2, 5])
    const MAJOR_MULTIPLE = 5
    const MAX_GRID_LINES_PER_AXIS = 512
    const GRID_EPSILON_MULTIPLIER = 8

    function nearlyEqual(a, b) {
      return Math.abs(a - b) <= Number.EPSILON * GRID_EPSILON_MULTIPLIER * Math.max(1, Math.abs(a), Math.abs(b))
    }

    function stableFloor(value) {
      const nearest = Math.round(value)
      return nearlyEqual(value, nearest) ? nearest : Math.floor(value)
    }

    function stableCeil(value) {
      const nearest = Math.round(value)
      return nearlyEqual(value, nearest) ? nearest : Math.ceil(value)
    }

    function getAdaptiveGridSpacing() {
      const zoom = camera.state.zoom
      if (!Number.isFinite(zoom) || zoom <= 0) return 1
      const required = viewportSettings.minimumGridSpacingPixels / zoom
      if (!Number.isFinite(required)) return 1e300
      if (required <= 0) return 1e-300
      const exponent = Math.max(-300, Math.min(300, Math.floor(Math.log10(required))))
      const magnitude = 10 ** exponent
      let adaptiveSpacing = 10 * magnitude
      for (const step of GRID_STEPS) {
        const candidate = step * magnitude
        if (candidate > required || nearlyEqual(candidate, required)) { adaptiveSpacing = candidate; break }
      }
      return Math.max(adaptiveSpacing, window.CaderactGridPolicy.minimumGridSpacing(getDocumentUnit()))
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
      const minorGrid = [], majorGrid = [], boundary = [], xAxis = [], yAxis = [], geometry = [], acceptedDraft = [], nextPreview = [], snapMarker = [], selection = []
      const selectionWindow = [], selectionCrossing = []
      const selectionWindowFill = [], selectionCrossingFill = []
      const idleGrips = [], hoverGrips = [], activeGrips = []
      const committedCircles = [], previewCircles = [], selectedCircles = []
      const committedArcs = [], previewArcs = [], selectedArcs = []
      const committedEllipses = [], previewEllipses = [], selectedEllipses = []
      const committedPolylines = [], selectedPolylines = []
      const moveSourceGhost = [], moveGuide = [], moveSourceCircles = [], moveSourceArcs = [], moveSourceEllipses = []
      function projectArc(record) {
        const center=camera.worldToScreen(record.center.x,record.center.y)
        const start=camera.worldToScreen(record.start.x,record.start.y)
        return Object.freeze({recordId:record.id,center:Object.freeze({x:center.x,y:center.y}),
          radius:Math.hypot(start.x-center.x,start.y-center.y),
          startAngle:Math.atan2(start.y-center.y,start.x-center.x),sweep:-record.sweep})
      }
      function projectEllipse(record) {
        const center=camera.worldToScreen(record.center.x,record.center.y)
        const axisEnd=camera.worldToScreen(record.center.x+record.majorAxis.x,record.center.y+record.majorAxis.y)
        const radiusX=Math.hypot(axisEnd.x-center.x,axisEnd.y-center.y)
        return Object.freeze({recordId:record.id,center:Object.freeze({x:center.x,y:center.y}),radiusX,
          radiusY:record.minorRadius*camera.state.zoom,rotation:Math.atan2(axisEnd.y-center.y,axisEnd.x-center.x)})
      }
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
          const first = stableFloor(minimum / spacing), last = stableCeil(maximum / spacing)
          if (!Number.isFinite(first) || !Number.isFinite(last) || first > last) return
          const count = Math.min(last - first + 1, MAX_GRID_LINES_PER_AXIS)
          for (let offset = 0; offset < count; offset++) {
            const index = first + offset
            if (index === 0) continue
            const coordinate = index * spacing
            const target = index % MAJOR_MULTIPLE === 0 ? majorGrid : minorGrid
            if (vertical) {
              const sx = camera.worldToScreen(coordinate, 0).x
              addSegment(target, sx, Math.max(0, top), sx, Math.min(viewportHeight, bottom))
            } else {
              const sy = camera.worldToScreen(0, coordinate).y
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
        if (top >= 0 && top <= viewportHeight) addSegment(boundary, visibleLeft, top, visibleRight, top)
        if (bottom >= 0 && bottom <= viewportHeight) addSegment(boundary, visibleLeft, bottom, visibleRight, bottom)
        if (left >= 0 && left <= viewportWidth) addSegment(boundary, left, visibleTop, left, visibleBottom)
        if (right >= 0 && right <= viewportWidth) addSegment(boundary, right, visibleTop, right, visibleBottom)
      }

      const origin = camera.worldToScreen(0, 0)
      if (origin.y >= 0 && origin.y <= viewportHeight && right >= 0 && left <= viewportWidth) {
        addSegment(xAxis, Math.max(0, left), origin.y, Math.min(viewportWidth, right), origin.y)
      }
      if (origin.x >= 0 && origin.x <= viewportWidth && bottom >= 0 && top <= viewportHeight) {
        addSegment(yAxis, origin.x, Math.max(0, top), origin.x, Math.min(viewportHeight, bottom))
      }

      // A6 persistent projection: query the authoritative document read-side on
      // every scene build. Unknown record types are skipped deterministically.
      const records = getRecords(), selectedIds = new Set(getSelectedIds()), gripPreview = getGripPreview(), movePreview = getMovePreview()
      const movingIds = new Set(movePreview?.mode === "move" ? movePreview.records.map(record => record.id) : [])
      for (const record of records) {
        if (movingIds.has(record.id)) continue
        if (record?.type === "line") {
          const a = camera.worldToScreen(record.start.x, record.start.y)
          const b = camera.worldToScreen(record.end.x, record.end.y)
          addSegment(geometry, a.x, a.y, b.x, b.y)
          if(selectedIds.has(record.id))addSegment(selection,a.x,a.y,b.x,b.y)
        } else if(record?.type === "polyline") {
          const vertices=record.vertices.map(vertex=>{const point=camera.worldToScreen(vertex.x,vertex.y);return Object.freeze({x:point.x,y:point.y,featureId:vertex.featureId})})
          const polyline=Object.freeze({recordId:record.id,vertices:Object.freeze(vertices),closed:record.closed})
          committedPolylines.push(polyline);if(selectedIds.has(record.id))selectedPolylines.push(polyline)
          const count=record.closed?vertices.length:vertices.length-1
          for(let index=0;index<count;index++){const a=vertices[index],b=vertices[(index+1)%vertices.length];addSegment(geometry,a.x,a.y,b.x,b.y);if(selectedIds.has(record.id))addSegment(selection,a.x,a.y,b.x,b.y)}
        } else if (record?.type === "circle") {
          const center = camera.worldToScreen(record.center.x, record.center.y)
          const edge = camera.worldToScreen(record.center.x + record.radius, record.center.y)
          const circle = Object.freeze({ recordId: record.id, center: Object.freeze({ x: center.x, y: center.y }),
            radius: Math.hypot(edge.x - center.x, edge.y - center.y) })
          committedCircles.push(circle)
          if (selectedIds.has(record.id)) selectedCircles.push(circle)
        } else if (record?.type === "arc") {
          const arc=projectArc(record);committedArcs.push(arc)
          if(selectedIds.has(record.id))selectedArcs.push(arc)
        } else if(record?.type === "ellipse") {
          const ellipse=projectEllipse(record);committedEllipses.push(ellipse)
          if(selectedIds.has(record.id))selectedEllipses.push(ellipse)
        }
      }

      // Accepted draft geometry and the next-segment rubber band deliberately
      // use independent buffers. Pointer movement can only rebuild nextPreview.
      for (const line of getDraftLines()) {
        const a = camera.worldToScreen(line.start.x, line.start.y)
        const b = camera.worldToScreen(line.end.x, line.end.y)
        addSegment(acceptedDraft, a.x, a.y, b.x, b.y)
      }

      const legacyPreview = getPreview()
      const activePreviews = getPreviewLines ? getPreviewLines() : legacyPreview ? [legacyPreview] : []
      for (const activePreview of activePreviews) {
        const a = camera.worldToScreen(activePreview.start.x, activePreview.start.y)
        const b = camera.worldToScreen(activePreview.end.x, activePreview.end.y)
        addSegment(nextPreview, a.x, a.y, b.x, b.y)
      }

      const circlePreview = getCirclePreview()
      if (circlePreview && Number.isFinite(circlePreview.radius) && circlePreview.radius > 0) {
        const center = camera.worldToScreen(circlePreview.center.x, circlePreview.center.y)
        const edge = camera.worldToScreen(circlePreview.center.x + circlePreview.radius, circlePreview.center.y)
        previewCircles.push(Object.freeze({ center: Object.freeze({ x: center.x, y: center.y }),
          radius: Math.hypot(edge.x - center.x, edge.y - center.y) }))
      }
      const arcPreview=getArcPreview()
      if(arcPreview?.valid){
        const previewRecord={id:null,center:arcPreview.center,start:arcPreview.start,sweep:arcPreview.sweep}
        previewArcs.push(projectArc(previewRecord))
      }
      const ellipsePreview=getEllipsePreview()
      if(ellipsePreview?.valid)previewEllipses.push(projectEllipse({id:null,center:ellipsePreview.center,
        majorAxis:ellipsePreview.majorAxis,minorRadius:ellipsePreview.minorRadius}))

      for (const record of movePreview?.records || []) {
        if (record.type === "line") {
          const a=camera.worldToScreen(record.start.x,record.start.y),b=camera.worldToScreen(record.end.x,record.end.y);addSegment(nextPreview,a.x,a.y,b.x,b.y)
        } else if(record.type === "polyline") {
          const count=record.closed?record.vertices.length:record.vertices.length-1
          for(let index=0;index<count;index++){const a=record.vertices[index],b=record.vertices[(index+1)%record.vertices.length],pa=camera.worldToScreen(a.x,a.y),pb=camera.worldToScreen(b.x,b.y);addSegment(nextPreview,pa.x,pa.y,pb.x,pb.y)}
        } else if(record.type === "circle") {
          const center=camera.worldToScreen(record.center.x,record.center.y),edge=camera.worldToScreen(record.center.x+record.radius,record.center.y);previewCircles.push(Object.freeze({recordId:record.id,center:Object.freeze(center),radius:Math.hypot(edge.x-center.x,edge.y-center.y)}))
        } else if(record.type === "arc") previewArcs.push(projectArc(record))
        else if(record.type === "ellipse") previewEllipses.push(projectEllipse(record))
      }
      for (const record of movePreview?.mode === "move" ? movePreview.sourceRecords : []) {
        if(record.type === "line") {
          const a=camera.worldToScreen(record.start.x,record.start.y),b=camera.worldToScreen(record.end.x,record.end.y);addSegment(moveSourceGhost,a.x,a.y,b.x,b.y)
        } else if(record.type === "polyline") {
          const count=record.closed?record.vertices.length:record.vertices.length-1
          for(let index=0;index<count;index++){const a=record.vertices[index],b=record.vertices[(index+1)%record.vertices.length],pa=camera.worldToScreen(a.x,a.y),pb=camera.worldToScreen(b.x,b.y);addSegment(moveSourceGhost,pa.x,pa.y,pb.x,pb.y)}
        } else if(record.type === "circle") {
          const center=camera.worldToScreen(record.center.x,record.center.y),edge=camera.worldToScreen(record.center.x+record.radius,record.center.y);moveSourceCircles.push(Object.freeze({recordId:record.id,center:Object.freeze(center),radius:Math.hypot(edge.x-center.x,edge.y-center.y)}))
        } else if(record.type === "arc") moveSourceArcs.push(projectArc(record))
        else if(record.type === "ellipse") moveSourceEllipses.push(projectEllipse(record))
      }
      let moveOverlay=null
      if(movePreview?.basePoint&&movePreview?.candidatePoint){
        const base=camera.worldToScreen(movePreview.basePoint.x,movePreview.basePoint.y),candidate=camera.worldToScreen(movePreview.candidatePoint.x,movePreview.candidatePoint.y),size=3
        addSegment(moveGuide,base.x,base.y,candidate.x,candidate.y)
        addSegment(moveGuide,base.x-size,base.y-size,base.x+size,base.y-size);addSegment(moveGuide,base.x+size,base.y-size,base.x+size,base.y+size)
        addSegment(moveGuide,base.x+size,base.y+size,base.x-size,base.y+size);addSegment(moveGuide,base.x-size,base.y+size,base.x-size,base.y-size)
        moveOverlay=Object.freeze({recordIds:Object.freeze(Array.from(movePreview.recordIds)),source:Object.freeze({segments:new Float32Array(moveSourceGhost),circles:Object.freeze(moveSourceCircles),arcs:Object.freeze(moveSourceArcs),ellipses:Object.freeze(moveSourceEllipses)}),
          basePoint:Object.freeze({x:base.x,y:base.y}),candidatePoint:Object.freeze({x:candidate.x,y:candidate.y}),guideSegments:new Float32Array(moveGuide)})
      }

      if (gripPreview) {
        if (gripPreview.type === "line") {
          const a = camera.worldToScreen(gripPreview.start.x, gripPreview.start.y)
          const b = camera.worldToScreen(gripPreview.end.x, gripPreview.end.y)
          addSegment(nextPreview, a.x, a.y, b.x, b.y)
        } else if (gripPreview.type === "polyline") {
          const count = gripPreview.closed ? gripPreview.vertices.length : gripPreview.vertices.length - 1
          for (let index = 0; index < count; index++) {
            const a = camera.worldToScreen(gripPreview.vertices[index].x, gripPreview.vertices[index].y)
            const next = gripPreview.vertices[(index + 1) % gripPreview.vertices.length]
            const b = camera.worldToScreen(next.x, next.y)
            addSegment(nextPreview, a.x, a.y, b.x, b.y)
          }
        }
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
        } else if (snap.kind === "draft-point") {
          addSegment(snapMarker, center.x, center.y-size, center.x+size, center.y)
          addSegment(snapMarker, center.x+size, center.y, center.x, center.y+size)
          addSegment(snapMarker, center.x, center.y+size, center.x-size, center.y)
          addSegment(snapMarker, center.x-size, center.y, center.x, center.y-size)
        } else if (snap.kind === "midpoint") {
          addSegment(snapMarker, center.x, center.y-size, center.x+size, center.y+size)
          addSegment(snapMarker, center.x+size, center.y+size, center.x-size, center.y+size)
          addSegment(snapMarker, center.x-size, center.y+size, center.x, center.y-size)
        } else {
          const inset = 2.5
          addSegment(snapMarker, center.x-inset, center.y-size, center.x-inset, center.y+size)
          addSegment(snapMarker, center.x+inset, center.y-size, center.x+inset, center.y+size)
          addSegment(snapMarker, center.x-size, center.y-inset, center.x+size, center.y-inset)
          addSegment(snapMarker, center.x-size, center.y+inset, center.x+size, center.y+inset)
        }
        const label = snap.kind === "draft-point" ? "Draft Point" : snap.kind[0].toUpperCase() + snap.kind.slice(1)
        snapOverlay = Object.freeze({ kind: snap.kind, point: Object.freeze({ x: center.x, y: center.y }),
          label, segments: new Float32Array(snapMarker) })
      }

      const POINT_MARKER_HALF_SIZE = 3
      const projectedGrips = []
      for (const grip of getGrips()) {
        const center = camera.worldToScreen(grip.point.x, grip.point.y)
        const size = grip.state === "idle" ? POINT_MARKER_HALF_SIZE : 4
        const target = grip.state === "active" ? activeGrips : grip.state === "hover" ? hoverGrips : idleGrips
        addSegment(target, center.x-size, center.y-size, center.x+size, center.y-size)
        addSegment(target, center.x+size, center.y-size, center.x+size, center.y+size)
        addSegment(target, center.x+size, center.y+size, center.x-size, center.y+size)
        addSegment(target, center.x-size, center.y+size, center.x-size, center.y-size)
        projectedGrips.push(Object.freeze({ recordId: grip.recordId, featureId: grip.featureId,
          kind: grip.kind, state: grip.state, point: Object.freeze({ x: center.x, y: center.y }) }))
      }

      const draftPoints = []
      const projectedDraftPoints = []
      for (const point of getDraftPoints()) {
        if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue
        const center = camera.worldToScreen(point.x, point.y)
        const size = POINT_MARKER_HALF_SIZE
        addSegment(draftPoints, center.x - size, center.y - size, center.x + size, center.y - size)
        addSegment(draftPoints, center.x + size, center.y - size, center.x + size, center.y + size)
        addSegment(draftPoints, center.x + size, center.y + size, center.x - size, center.y + size)
        addSegment(draftPoints, center.x - size, center.y + size, center.x - size, center.y - size)
        projectedDraftPoints.push(Object.freeze({
          point: Object.freeze({ x: center.x, y: center.y }),
        }))
      }

      const box=getSelectionBox()
      let selectionBoxOverlay=null
      if(box?.active){
        const rect=window.CaderactSelectionBox.normalizeRect(box.start,box.current)
        const target=box.mode==="window"?selectionWindow:selectionCrossing
        const fillTarget=box.mode==="window"?selectionWindowFill:selectionCrossingFill
        function addEdge(x1,y1,x2,y2){
          if(box.mode==="window"){addSegment(target,x1,y1,x2,y2);return}
          const length=Math.hypot(x2-x1,y2-y1),dash=6,gap=4
          if(length===0)return
          for(let offset=0;offset<length;offset+=dash+gap){const a=offset/length,b=Math.min(length,offset+dash)/length
            addSegment(target,x1+(x2-x1)*a,y1+(y2-y1)*a,x1+(x2-x1)*b,y1+(y2-y1)*b)}
        }
        addEdge(rect.left,rect.top,rect.right,rect.top);addEdge(rect.right,rect.top,rect.right,rect.bottom)
        addEdge(rect.right,rect.bottom,rect.left,rect.bottom);addEdge(rect.left,rect.bottom,rect.left,rect.top)
        const fillTop=Math.max(0,rect.top),fillBottom=Math.min(viewportHeight,rect.bottom)
        const fillLeft=Math.max(0,rect.left),fillRight=Math.min(viewportWidth,rect.right)
        if(fillLeft<=fillRight&&fillTop<=fillBottom)for(let y=Math.ceil(fillTop);y<=fillBottom;y+=1)addSegment(fillTarget,fillLeft,y,fillRight,y)
        selectionBoxOverlay=Object.freeze({kind:"selection-box",mode:box.mode,...rect,
          fill:Object.freeze({color:box.mode==="window"?(viewportSettings.selectionWindowFill||"rgba(75, 155, 210, 0.10)"):(viewportSettings.selectionCrossingFill||"rgba(78, 170, 112, 0.10)"),
            segments:new Float32Array(fillTarget)}),segments:new Float32Array(target)})
      }

      // The ordered groups are a renderer input, never authoritative geometry.
      const combinedMajorGrid = majorGrid.concat(boundary)
      const lineGroups = [
        lineGroup(viewportSettings.gridColor, minorGrid),
        lineGroup(viewportSettings.majorGridColor || viewportSettings.gridBoundaryColor, combinedMajorGrid),
        lineGroup(viewportSettings.xAxisColor, xAxis),
        lineGroup(viewportSettings.yAxisColor, yAxis),
        lineGroup(viewportSettings.geometryColor, geometry),
        lineGroup(viewportSettings.acceptedDraftColor || viewportSettings.geometryColor, acceptedDraft),
        lineGroup(viewportSettings.previewColor, nextPreview),
        {...lineGroup(viewportSettings.selectionColor || viewportSettings.geometryColor, selection),lineWidth:2},
        lineGroup(viewportSettings.gripColor || viewportSettings.geometryColor, idleGrips),
        lineGroup(viewportSettings.gripHoverColor || viewportSettings.snapMarkerColor, hoverGrips),
        lineGroup(viewportSettings.gripActiveColor || viewportSettings.selectionColor, activeGrips),
        lineGroup(viewportSettings.draftPointColor || viewportSettings.geometryColor, draftPoints),
        lineGroup(viewportSettings.selectionWindowFill || "rgba(75, 155, 210, 0.10)", selectionWindowFill),
        lineGroup(viewportSettings.selectionCrossingFill || "rgba(78, 170, 112, 0.10)", selectionCrossingFill),
        lineGroup(viewportSettings.selectionWindowColor || viewportSettings.selectionColor, selectionWindow),
        lineGroup(viewportSettings.selectionCrossingColor || viewportSettings.selectionColor, selectionCrossing),
        lineGroup(viewportSettings.snapMarkerColor || viewportSettings.previewColor, snapMarker),
        lineGroup(viewportSettings.moveSourceGhostColor || "rgba(160, 177, 193, 0.35)", moveSourceGhost),
        lineGroup(viewportSettings.moveGuideColor || viewportSettings.snapMarkerColor, moveGuide),
      ]
      const circleGroups = lineGroups.map((group, index) => Object.freeze({
        color: group.color, colorData: group.colorData, lineWidth: group.lineWidth,
        circles: Object.freeze(index === 4 ? committedCircles : index === 6 ? previewCircles : index === 7 ? selectedCircles : index === 17 ? moveSourceCircles : []),
      }))
      const arcGroups=lineGroups.map((group,index)=>Object.freeze({color:group.color,colorData:group.colorData,lineWidth:group.lineWidth,
        arcs:Object.freeze(index===4?committedArcs:index===6?previewArcs:index===7?selectedArcs:index===17?moveSourceArcs:[])}))
      const ellipseGroups=lineGroups.map((group,index)=>Object.freeze({color:group.color,colorData:group.colorData,lineWidth:group.lineWidth,
        ellipses:Object.freeze(index===4?committedEllipses:index===6?previewEllipses:index===7?selectedEllipses:index===17?moveSourceEllipses:[])}))
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
        acceptedDraftOverlay: Object.freeze({ segments: new Float32Array(acceptedDraft) }),
        nextSegmentPreviewOverlay: Object.freeze({ segments: new Float32Array(nextPreview) }),
        selectionOverlay: Object.freeze({recordIds:Object.freeze(Array.from(selectedIds).sort()),segments:new Float32Array(selection)}),
        gripOverlay: Object.freeze({ grips: Object.freeze(projectedGrips), idleSegments: new Float32Array(idleGrips),
          hoverSegments: new Float32Array(hoverGrips), activeSegments: new Float32Array(activeGrips) }),
        draftPointOverlay: Object.freeze({ points: Object.freeze(projectedDraftPoints), segments: new Float32Array(draftPoints) }),
        circleOverlay: Object.freeze({ committed: Object.freeze(committedCircles), preview: Object.freeze(previewCircles),
          selected: Object.freeze(selectedCircles) }),
        arcOverlay:Object.freeze({committed:Object.freeze(committedArcs),preview:Object.freeze(previewArcs),selected:Object.freeze(selectedArcs)}),
        ellipseOverlay:Object.freeze({committed:Object.freeze(committedEllipses),preview:Object.freeze(previewEllipses),selected:Object.freeze(selectedEllipses)}),
        selectionBoxOverlay,
        transformOverlay:moveOverlay,
        moveOverlay,
        polylineOverlay:Object.freeze({committed:Object.freeze(committedPolylines),selected:Object.freeze(selectedPolylines)}),
        lineGroups, circleGroups, arcGroups, ellipseGroups,
        drawGroups: Object.freeze(lineGroups.map((lineGroup, index) => Object.freeze({ lineGroup, circleGroup: circleGroups[index],arcGroup:arcGroups[index],ellipseGroup:ellipseGroups[index] }))),
      }
    }

    return Object.freeze({ createScene, getAdaptiveGridSpacing, GRID_STEPS, MAJOR_MULTIPLE, MAX_GRID_LINES_PER_AXIS, POINT_MARKER_HALF_SIZE })
  }

  const POINT_MARKER_HALF_SIZE = 3
  window.CaderactViewportScene = Object.freeze({ createSceneBuilder, POINT_MARKER_HALF_SIZE })
})()
