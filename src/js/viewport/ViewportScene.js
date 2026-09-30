;(() => {
  const SNAP_LABELS=Object.freeze({endpoint:"End",midpoint:"Mid",center:"Cen",intersection:"Int",insertion:"Ins",nearest:"Near",perpendicular:"Perp",tangent:"Tan",quadrant:"Quad",vertex:"Vertex","draft-point":"Draft Point",grid:"Grid",tracking:"Track"})
  const snapLabel=snap=>{const kinds=(snap?.kinds?.length?snap.kinds:[snap?.kind]).filter(kind=>kind&&kind!=="grid"&&kind!=="draft-point");return kinds.length?kinds.map(kind=>SNAP_LABELS[kind]||kind).join(", "):(SNAP_LABELS[snap?.kind]||"")}
  function createSceneBuilder({
    viewportSettings,
    camera,
    getViewportSize,
    getDocumentUnit = () => "mm",
    getDimensionStyle = () => window.CaderactDocument.DEFAULT_DIMENSION_STYLE,
    getRecords,
    getLayer = () => null,
    getDraftLines = () => [],
    getPreview = () => null,
    getPreviewLines = null,
    getCirclePreview = () => null,
    getArcPreview = () => null,
    getEllipsePreview = () => null,
    getDimensionPreview=()=>null,
    getTextPreview=()=>null,
    getMovePreview = () => null,
    getOffsetPreview = () => null,
    getTrimPreview = () => null,
    getExtendPreview = () => null,
    getMeasurementPreview = () => null,
    getDraftPoints = () => [],
    getSnapResult = () => null,
    getSelectedIds = () => [],
    getGrips = () => [],
    getGripPreview = () => null,
    getSelectionBox = () => null,
    getProfessionalSelection = () => null,
    getSelectionCycle = () => null,
    getPolarGuide = () => null,
    getObjectTrackingState = () => null,
    getPaperSpace = () => null,
    getLayoutViewports = () => [],
    getModelRecords = () => [],
  }) {
    const GRID_STEPS = Object.freeze([1, 2, 5])
    const MAJOR_MULTIPLE = 5
    const MAX_GRID_LINES_PER_AXIS = 512
    const GRID_EPSILON_MULTIPLIER = 8
    // Records are immutable. Cache expensive world-space Hatch presentation by
    // record identity; camera-only scene builds only re-project the cached data.
    // A document edit publishes a new record object and therefore invalidates
    // the relevant entry naturally without revision bookkeeping.
    const hatchPresentationCache=new WeakMap()
    function hatchPresentation(record){
      const cached=hatchPresentationCache.get(record)
      if(cached)return cached
      const derived=record.pattern.kind==="named"?window.CaderactHatchGeometry.generatePattern(record):window.CaderactHatchGeometry.triangulate(record)
      hatchPresentationCache.set(record,derived)
      return derived
    }

    function nearlyEqual(a, b) {
      return (
        Math.abs(a - b) <=
        Number.EPSILON *
          GRID_EPSILON_MULTIPLIER *
          Math.max(1, Math.abs(a), Math.abs(b))
      )
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
      const exponent = Math.max(
        -300,
        Math.min(300, Math.floor(Math.log10(required))),
      )
      const magnitude = 10 ** exponent
      let adaptiveSpacing = 10 * magnitude
      for (const step of GRID_STEPS) {
        const candidate = step * magnitude
        if (candidate > required || nearlyEqual(candidate, required)) {
          adaptiveSpacing = candidate
          break
        }
      }
      return Math.max(
        adaptiveSpacing,
        window.CaderactGridPolicy.minimumGridSpacing(getDocumentUnit()),
      )
    }

    function addSegment(segments, x1, y1, x2, y2) {
      segments.push(x1, y1, x2, y2)
    }

    function colorToRgba(color) {
      if (color.startsWith("#")) {
        const value = Number.parseInt(color.slice(1), 16)
        return [
          ((value >> 16) & 255) / 255,
          ((value >> 8) & 255) / 255,
          (value & 255) / 255,
          1,
        ]
      }
      const values = color.match(/[\d.]+/g).map(Number)
      return [values[0] / 255, values[1] / 255, values[2] / 255, values[3] ?? 1]
    }

    function lineGroup(color, segments, {linetype="continuous",lineWidth=1,lineweight=null}={}) {
      return {
        color,
        colorData: colorToRgba(color),
        linetype,
        lineweight,
        dashPattern: window.CaderactStrokeStyle.dashPattern(linetype),
        lineWidth,
        segments: new Float32Array(segments),
      }
    }

    function activeLayoutViewportGridGroups(viewport, modelUnit) {
      if (viewportSettings.gridVisible === false || !viewport?.active || viewport.frameOnly) return []
      const millimetersPerModelUnit = window.CaderactUnits.conversionFactor(modelUnit, "mm")
      const paperUnitsPerModelUnit = millimetersPerModelUnit / viewport.scale
      const pixelsPerModelUnit = paperUnitsPerModelUnit * camera.state.zoom
      if (!(pixelsPerModelUnit > 0)) return []
      const required = viewportSettings.minimumGridSpacingPixels / pixelsPerModelUnit
      const exponent = Math.floor(Math.log10(Math.max(required, Number.MIN_VALUE)))
      const magnitude = 10 ** exponent
      let spacing = 10 * magnitude
      for (const step of GRID_STEPS) {
        const candidate = step * magnitude
        if (candidate >= required || nearlyEqual(candidate, required)) {
          spacing = candidate
          break
        }
      }
      const halfWidth = viewport.frame.width / (2 * paperUnitsPerModelUnit)
      const halfHeight = viewport.frame.height / (2 * paperUnitsPerModelUnit)
      const left = viewport.viewCenter.x - halfWidth
      const right = viewport.viewCenter.x + halfWidth
      const bottom = viewport.viewCenter.y - halfHeight
      const top = viewport.viewCenter.y + halfHeight
      const minor = [], major = [], xAxis = [], yAxis = []
      const multiple = viewportSettings.majorGridInterval || MAJOR_MULTIPLE
      const project = point => {
        const paper = window.CaderactPaperSpace.projectModelPoint(point, viewport, modelUnit)
        return camera.worldToScreen(paper.x, paper.y)
      }
      const verticalStart = stableCeil(left / spacing)
      const verticalEnd = stableFloor(right / spacing)
      for (let index = verticalStart; index <= verticalEnd && index - verticalStart <= MAX_GRID_LINES_PER_AXIS; index += 1) {
        const x = index * spacing
        const a = project({ x, y: bottom }), b = project({ x, y: top })
        const target = index === 0 ? yAxis : index % multiple === 0 ? major : minor
        addSegment(target, a.x, a.y, b.x, b.y)
      }
      const horizontalStart = stableCeil(bottom / spacing)
      const horizontalEnd = stableFloor(top / spacing)
      for (let index = horizontalStart; index <= horizontalEnd && index - horizontalStart <= MAX_GRID_LINES_PER_AXIS; index += 1) {
        const y = index * spacing
        const a = project({ x: left, y }), b = project({ x: right, y })
        const target = index === 0 ? xAxis : index % multiple === 0 ? major : minor
        addSegment(target, a.x, a.y, b.x, b.y)
      }
      const group = (role, color, segments, lineWidth = 1) => Object.freeze({
        lineGroup: lineGroup(color, segments, { lineWidth }),
        circleGroup: null,
        arcGroup: null,
        ellipseGroup: null,
        viewportId: viewport.id,
        role,
      })
      return [
        group("model-grid-minor", viewportSettings.gridColor, minor),
        group("model-grid-major", viewportSettings.majorGridColor || viewportSettings.gridBoundaryColor, major),
        group("model-x-axis", viewportSettings.xAxisColor, xAxis, 1.25),
        group("model-y-axis", viewportSettings.yAxisColor, yAxis, 1.25),
      ]
    }

    function createScene({recordsOverride=null}={}) {
      const { width: viewportWidth, height: viewportHeight } = getViewportSize()
      const paperSpace=getPaperSpace()
      const scale = window.devicePixelRatio || 1
      const extent = viewportSettings.gridExtent
      const minorGrid = [],
        majorGrid = [],
        boundary = [],
        xAxis = [],
        yAxis = [],
        geometry = [],
        acceptedDraft = [],
        nextPreview = [],
        snapMarker = [], polarGuideSegments = [], objectTrackingGuide = [], objectTrackingMarkers = [], measurementSegments = [], measurementMarkers = [],
        selection = [], hatchTriangles=[],dimensionTriangles=[],dimensionAnnotations=[]
      const selectionWindow = [],
        selectionCrossing = []
      const selectionWindowFill = [],
        selectionCrossingFill = []
      const idleGrips = [],
        hoverGrips = [],
        activeGrips = []
      const committedCircles = [],
        previewCircles = [],
        selectedCircles = []
      const committedArcs = [],
        previewArcs = [],
        selectedArcs = []
      const committedEllipses = [],
        previewEllipses = [],
        selectedEllipses = []
      const committedPolylines = [],
        selectedPolylines = []
      const propertyBuckets=new Map()
      function propertyStyle(record){const layer=getLayer(record.layerId),properties=window.CaderactObjectProperties;const color=properties.effectiveColor(record,layer),linetype=properties.effectiveLinetype(record,layer),lineweight=properties.effectiveLineweight(record,layer);return Object.freeze({color,linetype,lineweight,lineWidth:window.CaderactStrokeStyle.lineweightToCssPixels(lineweight)})}
      function propertyBucket(record){const style=propertyStyle(record),key=`${style.color}|${style.linetype}|${style.lineweight}`;if(!propertyBuckets.has(key))propertyBuckets.set(key,{style,segments:[],circles:[],arcs:[],ellipses:[],recordIds:[]});const bucket=propertyBuckets.get(key);bucket.recordIds.push(record.id);return bucket}
      const previewPropertyBuckets=new Map()
      function previewPropertyBucket(record){const style=propertyStyle(record),key=`${style.color}|${style.linetype}|${style.lineweight}`;if(!previewPropertyBuckets.has(key))previewPropertyBuckets.set(key,{style,segments:[],circles:[],arcs:[],ellipses:[],recordIds:[]});const bucket=previewPropertyBuckets.get(key);if(record.id)bucket.recordIds.push(record.id);return bucket}
      function appendTextAnnotation(record,color,{selected=false,preview=false}={}){const presentation=window.CaderactAnnotationGeometry.derive(record);if(!presentation.supported)return;const text=presentation.annotation,anchor=camera.worldToScreen(text.point.x,text.point.y);dimensionAnnotations.push(Object.freeze({recordId:record.id??null,role:"text",text:text.text,x:anchor.x,y:anchor.y,rotation:-text.rotation,fontSize:text.height*camera.state.zoom,horizontalAlignment:text.horizontalAlignment,color,selected,preview}))}
      function appendStyledPreview(record){
        const bucket=previewPropertyBucket(record),color=viewportSettings.previewColor
        const segment=(start,end)=>{const a=camera.worldToScreen(start.x,start.y),b=camera.worldToScreen(end.x,end.y);addSegment(bucket.segments,a.x,a.y,b.x,b.y);addSegment(nextPreview,a.x,a.y,b.x,b.y)}
        if(record.type==="line")segment(record.start,record.end)
        else if(record.type==="polyline"){const count=record.closed?record.vertices.length:record.vertices.length-1;for(let index=0;index<count;index++)segment(record.vertices[index],record.vertices[(index+1)%record.vertices.length])}
        else if(record.type==="circle"){const center=camera.worldToScreen(record.center.x,record.center.y),edge=camera.worldToScreen(record.center.x+record.radius,record.center.y);bucket.circles.push(Object.freeze({recordId:record.id,center:Object.freeze(center),radius:Math.hypot(edge.x-center.x,edge.y-center.y)}))}
        else if(record.type==="arc")bucket.arcs.push(projectArc(record))
        else if(record.type==="ellipse")bucket.ellipses.push(projectEllipse(record))
        else if(record.type==="region"){for(const loop of record.loops)for(const edge of loop.edges){if(edge.kind==="line")segment(edge.start,edge.end);else if(edge.kind==="arc")bucket.arcs.push(projectArc({...edge,id:record.id}));else if(edge.kind==="circle"){const center=camera.worldToScreen(edge.center.x,edge.center.y),point=camera.worldToScreen(edge.center.x+edge.radius,edge.center.y);bucket.circles.push(Object.freeze({recordId:record.id,center:Object.freeze(center),radius:Math.hypot(point.x-center.x,point.y-center.y)}))}else if(edge.kind==="ellipse")bucket.ellipses.push(projectEllipse({...edge,id:record.id}))}}
        else if(record.type==="hatch"){const derived=hatchPresentation(record);if(derived.valid){if(record.pattern.kind==="named")for(const value of derived.segments)segment(value.start,value.end);else for(const triangle of derived.triangles)hatchTriangles.push(Object.freeze({preview:true,recordId:record.id,points:Object.freeze(triangle.map(value=>Object.freeze(camera.worldToScreen(value.x,value.y)))),color,colorData:colorToRgba(color)}))}}
        else if(record.type==="text")appendTextAnnotation(record,color,{preview:true})
        else if(record.type?.startsWith("dimension-")){const presentation=window.CaderactDimensionGeometry.derive(record,getDimensionStyle(record),{length:getDocumentUnit()});if(presentation.supported){for(const [start,end] of presentation.lines)segment(start,end);for(const arc of presentation.arcs||[])bucket.arcs.push(projectArc({...arc,id:record.id}));for(const triangle of presentation.triangles)dimensionTriangles.push(Object.freeze({preview:true,points:Object.freeze(triangle.map(value=>Object.freeze(camera.worldToScreen(value.x,value.y)))),color,colorData:colorToRgba(color)}));const anchor=camera.worldToScreen(presentation.text.point.x,presentation.text.point.y);dimensionAnnotations.push(Object.freeze({preview:true,recordId:record.id,text:presentation.text.value,x:anchor.x,y:anchor.y,rotation:-presentation.text.rotation,fontSize:presentation.text.height*camera.state.zoom,color}))}}
      }
      const moveSourceGhost = [],
        moveGuide = [],
        moveSourceCircles = [],
        moveSourceArcs = [],
        moveSourceEllipses = []
      const rotateCenterMarker = [],
        rotateReferenceMarker = [],
        rotateTargetMarker = []
      function projectArc(record) {
        const center = camera.worldToScreen(record.center.x, record.center.y)
        const start = camera.worldToScreen(record.start.x, record.start.y)
        return Object.freeze({
          recordId: record.id,
          center: Object.freeze({ x: center.x, y: center.y }),
          radius: Math.hypot(start.x - center.x, start.y - center.y),
          startAngle: Math.atan2(start.y - center.y, start.x - center.x),
          sweep: -record.sweep,
        })
      }
      function projectEllipse(record) {
        const center = camera.worldToScreen(record.center.x, record.center.y)
        const axisEnd = camera.worldToScreen(
          record.center.x + record.majorAxis.x,
          record.center.y + record.majorAxis.y,
        )
        const radiusX = Math.hypot(axisEnd.x - center.x, axisEnd.y - center.y)
        return Object.freeze({
          recordId: record.id,
          center: Object.freeze({ x: center.x, y: center.y }),
          radiusX,
          radiusY: record.minorRadius * camera.state.zoom,
          rotation: Math.atan2(axisEnd.y - center.y, axisEnd.x - center.x),
        })
      }
      const topLeft = camera.screenToWorld(0, 0)
      const bottomRight = camera.screenToWorld(viewportWidth, viewportHeight)
      const minX = Math.max(-extent, topLeft.x),
        maxX = Math.min(extent, bottomRight.x)
      const minY = Math.max(-extent, bottomRight.y),
        maxY = Math.min(extent, topLeft.y)
      const top = camera.worldToScreen(0, extent).y,
        bottom = camera.worldToScreen(0, -extent).y
      const left = camera.worldToScreen(-extent, 0).x,
        right = camera.worldToScreen(extent, 0).x

      const spacing = getAdaptiveGridSpacing()
      if (
        !paperSpace &&
        Number.isFinite(viewportWidth) &&
        Number.isFinite(viewportHeight) &&
        viewportWidth > 0 &&
        viewportHeight > 0 &&
        Number.isFinite(spacing) &&
        spacing > 0 &&
        minX <= maxX &&
        minY <= maxY
      ) {
        function addVisibleLines(minimum, maximum, vertical) {
          const first = stableFloor(minimum / spacing),
            last = stableCeil(maximum / spacing)
          if (!Number.isFinite(first) || !Number.isFinite(last) || first > last)
            return
          const count = Math.min(last - first + 1, MAX_GRID_LINES_PER_AXIS)
          for (let offset = 0; offset < count; offset++) {
            const index = first + offset
            if (index === 0) continue
            const coordinate = index * spacing
            const target = index % (viewportSettings.majorGridInterval || MAJOR_MULTIPLE) === 0 ? majorGrid : minorGrid
            if (vertical) {
              const sx = camera.worldToScreen(coordinate, 0).x
              addSegment(
                target,
                sx,
                Math.max(0, top),
                sx,
                Math.min(viewportHeight, bottom),
              )
            } else {
              const sy = camera.worldToScreen(0, coordinate).y
              addSegment(
                target,
                Math.max(0, left),
                sy,
                Math.min(viewportWidth, right),
                sy,
              )
            }
          }
        }
        addVisibleLines(minX, maxX, true)
        addVisibleLines(minY, maxY, false)
      }

      const visibleLeft = Math.max(0, left),
        visibleTop = Math.max(0, top)
      const visibleRight = Math.min(viewportWidth, right),
        visibleBottom = Math.min(viewportHeight, bottom)
      if (visibleLeft <= visibleRight && visibleTop <= visibleBottom) {
        if (top >= 0 && top <= viewportHeight)
          addSegment(boundary, visibleLeft, top, visibleRight, top)
        if (bottom >= 0 && bottom <= viewportHeight)
          addSegment(boundary, visibleLeft, bottom, visibleRight, bottom)
        if (left >= 0 && left <= viewportWidth)
          addSegment(boundary, left, visibleTop, left, visibleBottom)
        if (right >= 0 && right <= viewportWidth)
          addSegment(boundary, right, visibleTop, right, visibleBottom)
      }

      const origin = camera.worldToScreen(0, 0)
      if (
        origin.y >= 0 &&
        origin.y <= viewportHeight &&
        right >= 0 &&
        left <= viewportWidth
      ) {
        addSegment(
          xAxis,
          Math.max(0, left),
          origin.y,
          Math.min(viewportWidth, right),
          origin.y,
        )
      }
      if (
        origin.x >= 0 &&
        origin.x <= viewportWidth &&
        bottom >= 0 &&
        top <= viewportHeight
      ) {
        addSegment(
          yAxis,
          origin.x,
          Math.max(0, top),
          origin.x,
          Math.min(viewportHeight, bottom),
        )
      }

      // A6 persistent projection: query the authoritative document read-side on
      // every scene build. Unknown record types are skipped deterministically.
      const records = recordsOverride===null?getRecords():recordsOverride,
        selectedIds = new Set(getSelectedIds()),
        gripPreview = getGripPreview(),
        movePreview = getMovePreview() || getOffsetPreview()
      const movingIds = new Set(
        movePreview?.mode !== "copy" && !movePreview?.preserveSourceVisible
          ? movePreview?.records?.map((record) => record.id) || []
          : [],
      )
      for (const record of records) {
        if (movingIds.has(record.id)) continue
        const bucket=propertyBucket(record)
        if (record?.type === "line") {
          const a = camera.worldToScreen(record.start.x, record.start.y)
          const b = camera.worldToScreen(record.end.x, record.end.y)
          addSegment(bucket.segments, a.x, a.y, b.x, b.y)
          if (selectedIds.has(record.id))
            addSegment(selection, a.x, a.y, b.x, b.y)
        } else if (record?.type === "polyline") {
          const vertices = record.vertices.map((vertex) => {
            const point = camera.worldToScreen(vertex.x, vertex.y)
            return Object.freeze({
              x: point.x,
              y: point.y,
              featureId: vertex.featureId,
            })
          })
          const polyline = Object.freeze({
            recordId: record.id,
            vertices: Object.freeze(vertices),
            closed: record.closed,
          })
          committedPolylines.push(polyline)
          if (selectedIds.has(record.id)) selectedPolylines.push(polyline)
          const count = record.closed ? vertices.length : vertices.length - 1
          for (let index = 0; index < count; index++) {
            const a = vertices[index],
              b = vertices[(index + 1) % vertices.length]
            addSegment(bucket.segments, a.x, a.y, b.x, b.y)
            if (selectedIds.has(record.id))
              addSegment(selection, a.x, a.y, b.x, b.y)
          }
        } else if(record?.type==="text"){
          const selected=selectedIds.has(record.id);appendTextAnnotation(record,selected?viewportSettings.selectionColor:bucket.style.color,{selected})
        } else if(record?.type?.startsWith("dimension-")){
          const presentation=window.CaderactDimensionGeometry.derive(record,getDimensionStyle(record),{length:getDocumentUnit()})
          if(presentation.supported){const selected=selectedIds.has(record.id);for(const [start,end] of presentation.lines){const a=camera.worldToScreen(start.x,start.y),b=camera.worldToScreen(end.x,end.y);addSegment(bucket.segments,a.x,a.y,b.x,b.y);if(selected)addSegment(selection,a.x,a.y,b.x,b.y)}for(const arc of presentation.arcs||[]){const projected=projectArc({...arc,id:record.id});bucket.arcs.push(projected);if(selected)selectedArcs.push(projected)}for(const triangle of presentation.triangles){const points=Object.freeze(triangle.map(value=>Object.freeze(camera.worldToScreen(value.x,value.y))));dimensionTriangles.push(Object.freeze({points,color:bucket.style.color,colorData:colorToRgba(bucket.style.color)}));if(selected)dimensionTriangles.push(Object.freeze({selected:true,points,color:viewportSettings.selectionColor,colorData:colorToRgba(viewportSettings.selectionColor)}))}if(presentation.text){const anchor=camera.worldToScreen(presentation.text.point.x,presentation.text.point.y);dimensionAnnotations.push(Object.freeze({recordId:record.id,text:presentation.text.value,x:anchor.x,y:anchor.y,rotation:-presentation.text.rotation,fontSize:presentation.text.height*camera.state.zoom,color:selected?viewportSettings.selectionColor:bucket.style.color}))}}
        } else if (record?.type === "circle") {
          const center = camera.worldToScreen(record.center.x, record.center.y)
          const edge = camera.worldToScreen(
            record.center.x + record.radius,
            record.center.y,
          )
          const circle = Object.freeze({
            recordId: record.id,
            center: Object.freeze({ x: center.x, y: center.y }),
            radius: Math.hypot(edge.x - center.x, edge.y - center.y),
          })
          bucket.circles.push(circle)
          if (selectedIds.has(record.id)) selectedCircles.push(circle)
        } else if (record?.type === "arc") {
          const arc = projectArc(record)
          bucket.arcs.push(arc)
          if (selectedIds.has(record.id)) selectedArcs.push(arc)
        } else if (record?.type === "ellipse") {
          const ellipse = projectEllipse(record)
          bucket.ellipses.push(ellipse)
          if (selectedIds.has(record.id)) selectedEllipses.push(ellipse)
        } else if(record?.type==="hatch"){
          const derived=hatchPresentation(record),selected=selectedIds.has(record.id)
          if(derived.valid){if(record.pattern.kind==="named")for(const segment of derived.segments){const a=camera.worldToScreen(segment.start.x,segment.start.y),b=camera.worldToScreen(segment.end.x,segment.end.y);addSegment(bucket.segments,a.x,a.y,b.x,b.y)}else for(const triangle of derived.triangles){const points=Object.freeze(triangle.map(value=>Object.freeze(camera.worldToScreen(value.x,value.y))));hatchTriangles.push(Object.freeze({recordId:record.id,points,color:bucket.style.color,colorData:colorToRgba(bucket.style.color)}))}}
          if(selected)for(const loop of record.loops)for(const edge of loop.edges){const points=window.CaderactRegionGeometry.sampleEdge(edge).map(value=>camera.worldToScreen(value.x,value.y));for(let i=1;i<points.length;i++)addSegment(selection,points[i-1].x,points[i-1].y,points[i].x,points[i].y)}
        } else if(record?.type==="region"){
          const selected=selectedIds.has(record.id)
          for(const loop of record.loops)for(const edge of loop.edges){if(edge.kind==="line"){const a=camera.worldToScreen(edge.start.x,edge.start.y),b=camera.worldToScreen(edge.end.x,edge.end.y);addSegment(bucket.segments,a.x,a.y,b.x,b.y);if(selected)addSegment(selection,a.x,a.y,b.x,b.y)}else if(edge.kind==="arc"){const arc=projectArc({...edge,id:record.id});bucket.arcs.push(arc);if(selected)selectedArcs.push(arc)}else if(edge.kind==="circle"){const center=camera.worldToScreen(edge.center.x,edge.center.y),p=camera.worldToScreen(edge.center.x+edge.radius,edge.center.y),circle=Object.freeze({recordId:record.id,center:Object.freeze(center),radius:Math.hypot(p.x-center.x,p.y-center.y)});bucket.circles.push(circle);if(selected)selectedCircles.push(circle)}else if(edge.kind==="ellipse"){const ellipse=projectEllipse({...edge,id:record.id});bucket.ellipses.push(ellipse);if(selected)selectedEllipses.push(ellipse)}}
        }
      }
      const defaultStyleKey=`${viewportSettings.geometryColor}|continuous|0.25`,propertyDrawGroups=[]
      for(const [key,bucket] of propertyBuckets){const style=bucket.style;if(key===defaultStyleKey){for(const value of bucket.segments)geometry.push(value);for(const value of bucket.circles)committedCircles.push(value);for(const value of bucket.arcs)committedArcs.push(value);for(const value of bucket.ellipses)committedEllipses.push(value);continue}const styledLine=lineGroup(style.color,bucket.segments,style);propertyDrawGroups.push(Object.freeze({style,recordIds:Object.freeze(bucket.recordIds.slice().sort()),lineGroup:styledLine,circleGroup:Object.freeze({...styledLine,circles:Object.freeze(bucket.circles)}),arcGroup:Object.freeze({...styledLine,arcs:Object.freeze(bucket.arcs)}),ellipseGroup:Object.freeze({...styledLine,ellipses:Object.freeze(bucket.ellipses)})}))}
      const dimensionPreview=getDimensionPreview()
      if(dimensionPreview){const presentation=window.CaderactDimensionGeometry.derive(dimensionPreview,getDimensionStyle(dimensionPreview),{length:getDocumentUnit()}),color=viewportSettings.previewColor;if(presentation.supported){for(const [start,end] of presentation.lines){const a=camera.worldToScreen(start.x,start.y),b=camera.worldToScreen(end.x,end.y);addSegment(nextPreview,a.x,a.y,b.x,b.y)}for(const arc of presentation.arcs||[])previewArcs.push(projectArc({...arc,id:null}));for(const triangle of presentation.triangles)dimensionTriangles.push(Object.freeze({preview:true,points:Object.freeze(triangle.map(value=>Object.freeze(camera.worldToScreen(value.x,value.y)))),color,colorData:colorToRgba(color)}));const anchor=camera.worldToScreen(presentation.text.point.x,presentation.text.point.y);dimensionAnnotations.push(Object.freeze({preview:true,text:presentation.text.value,x:anchor.x,y:anchor.y,rotation:-presentation.text.rotation,fontSize:presentation.text.height*camera.state.zoom,color}))}}
      const textPreview=getTextPreview();if(textPreview)appendTextAnnotation(textPreview,viewportSettings.previewColor,{preview:true})

      // Accepted draft geometry and the next-segment rubber band deliberately
      // use independent buffers. Pointer movement can only rebuild nextPreview.
      for (const line of getDraftLines()) {
        const a = camera.worldToScreen(line.start.x, line.start.y)
        const b = camera.worldToScreen(line.end.x, line.end.y)
        addSegment(acceptedDraft, a.x, a.y, b.x, b.y)
      }

      const legacyPreview = getPreview()
      const activePreviews = getPreviewLines
        ? getPreviewLines()
        : legacyPreview
          ? [legacyPreview]
          : []
      for (const activePreview of activePreviews) {
        const a = camera.worldToScreen(
          activePreview.start.x,
          activePreview.start.y,
        )
        const b = camera.worldToScreen(activePreview.end.x, activePreview.end.y)
        addSegment(nextPreview, a.x, a.y, b.x, b.y)
      }
      const measurementPreview=getMeasurementPreview()
      let measurementOverlay=null
      if(measurementPreview){const worldSegments=measurementPreview.rays||[[measurementPreview.start,measurementPreview.end]],projected=[];for(const [start,end] of worldSegments){const a=camera.worldToScreen(start.x,start.y),b=camera.worldToScreen(end.x,end.y);addSegment(measurementSegments,a.x,a.y,b.x,b.y);projected.push(a,b)}const size=3;for(const p of projected){addSegment(measurementMarkers,p.x-size,p.y,p.x+size,p.y);addSegment(measurementMarkers,p.x,p.y-size,p.x,p.y+size)}nextPreview.push(...measurementSegments,...measurementMarkers);measurementOverlay=Object.freeze({startPoint:projected[0]&&Object.freeze(projected[0]),endPoint:projected.at(-1)&&Object.freeze(projected.at(-1)),segments:new Float32Array(measurementSegments),markerSegments:new Float32Array(measurementMarkers),distance:measurementPreview.distance,angleRadians:measurementPreview.angleRadians})}

      const circlePreview = getCirclePreview()
      if (
        circlePreview &&
        Number.isFinite(circlePreview.radius) &&
        circlePreview.radius > 0
      ) {
        const center = camera.worldToScreen(
          circlePreview.center.x,
          circlePreview.center.y,
        )
        const edge = camera.worldToScreen(
          circlePreview.center.x + circlePreview.radius,
          circlePreview.center.y,
        )
        previewCircles.push(
          Object.freeze({
            center: Object.freeze({ x: center.x, y: center.y }),
            radius: Math.hypot(edge.x - center.x, edge.y - center.y),
          }),
        )
      }
      const arcPreview = getArcPreview()
      if (arcPreview?.valid) {
        const previewRecord = {
          id: null,
          center: arcPreview.center,
          start: arcPreview.start,
          sweep: arcPreview.sweep,
        }
        previewArcs.push(projectArc(previewRecord))
      }
      const ellipsePreview = getEllipsePreview()
      if (ellipsePreview?.valid)
        previewEllipses.push(
          projectEllipse({
            id: null,
            center: ellipsePreview.center,
            majorAxis: ellipsePreview.majorAxis,
            minorRadius: ellipsePreview.minorRadius,
          }),
        )

      for (const record of movePreview?.records || []) appendStyledPreview(record)
      // M6P6: Trim preview -- renderer-neutral transient survivor geometry
      // produced by TrimPlanner (via the active Trim command session) and
      // projected through the exact same generic line/arc/polyline path
      // already used for Move/Copy/Rotate/Scale previews above. No trim
      // topology or intersection math lives here; `record` shapes are plain
      // Line/Arc/Polyline geometry with no persistent id.
      const trimPreview = getTrimPreview()
      for (const record of trimPreview?.records || []) appendStyledPreview(record)
      const extendPreview = getExtendPreview()
      for (const record of extendPreview?.records || []) appendStyledPreview(record)

      for (const record of [
        ...(movePreview?.mode !== "copy" ? movePreview?.sourceRecords || [] : []),
        ...(extendPreview?.sourceRecords || []),
      ]) {
        if (record.type === "line") {
          const a = camera.worldToScreen(record.start.x, record.start.y),
            b = camera.worldToScreen(record.end.x, record.end.y)
          addSegment(moveSourceGhost, a.x, a.y, b.x, b.y)
        } else if (record.type === "polyline") {
          const count = record.closed
            ? record.vertices.length
            : record.vertices.length - 1
          for (let index = 0; index < count; index++) {
            const a = record.vertices[index],
              b = record.vertices[(index + 1) % record.vertices.length],
              pa = camera.worldToScreen(a.x, a.y),
              pb = camera.worldToScreen(b.x, b.y)
            addSegment(moveSourceGhost, pa.x, pa.y, pb.x, pb.y)
          }
        } else if (record.type === "circle") {
          const center = camera.worldToScreen(record.center.x, record.center.y),
            edge = camera.worldToScreen(
              record.center.x + record.radius,
              record.center.y,
            )
          moveSourceCircles.push(
            Object.freeze({
              recordId: record.id,
              center: Object.freeze(center),
              radius: Math.hypot(edge.x - center.x, edge.y - center.y),
            }),
          )
        } else if (record.type === "arc")
          moveSourceArcs.push(projectArc(record))
        else if (record.type === "ellipse")
          moveSourceEllipses.push(projectEllipse(record))
      }
      let moveOverlay = null
      if (movePreview?.basePoint) {
        const base = camera.worldToScreen(
            movePreview.basePoint.x,
            movePreview.basePoint.y,
          ),
          candidate = movePreview.candidatePoint
            ? camera.worldToScreen(
                movePreview.candidatePoint.x,
                movePreview.candidatePoint.y,
              )
            : null,
          size = 3
        let reference = null
        if (movePreview.referencePoint) {
          reference = camera.worldToScreen(
            movePreview.referencePoint.x,
            movePreview.referencePoint.y,
          )
          addSegment(moveGuide, base.x, base.y, reference.x, reference.y)
        }
        if (candidate)
          addSegment(moveGuide, base.x, base.y, candidate.x, candidate.y)
        if (
          movePreview.mode === "rotate" ||
          movePreview.mode === "scale" ||
          movePreview.mode === "mirror"
        ) {
          const anchor = 4,
            arm = 6
          addSegment(
            rotateCenterMarker,
            base.x,
            base.y - anchor,
            base.x + anchor,
            base.y,
          )
          addSegment(
            rotateCenterMarker,
            base.x + anchor,
            base.y,
            base.x,
            base.y + anchor,
          )
          addSegment(
            rotateCenterMarker,
            base.x,
            base.y + anchor,
            base.x - anchor,
            base.y,
          )
          addSegment(
            rotateCenterMarker,
            base.x - anchor,
            base.y,
            base.x,
            base.y - anchor,
          )
          addSegment(
            rotateCenterMarker,
            base.x - arm,
            base.y,
            base.x + arm,
            base.y,
          )
          addSegment(
            rotateCenterMarker,
            base.x,
            base.y - arm,
            base.x,
            base.y + arm,
          )
          if (reference) {
            addSegment(
              rotateReferenceMarker,
              reference.x,
              reference.y - size,
              reference.x + size,
              reference.y,
            )
            addSegment(
              rotateReferenceMarker,
              reference.x + size,
              reference.y,
              reference.x,
              reference.y + size,
            )
            addSegment(
              rotateReferenceMarker,
              reference.x,
              reference.y + size,
              reference.x - size,
              reference.y,
            )
            addSegment(
              rotateReferenceMarker,
              reference.x - size,
              reference.y,
              reference.x,
              reference.y - size,
            )
          }
          if (candidate) {
            addSegment(
              rotateTargetMarker,
              candidate.x - size,
              candidate.y - size,
              candidate.x + size,
              candidate.y - size,
            )
            addSegment(
              rotateTargetMarker,
              candidate.x + size,
              candidate.y - size,
              candidate.x + size,
              candidate.y + size,
            )
            addSegment(
              rotateTargetMarker,
              candidate.x + size,
              candidate.y + size,
              candidate.x - size,
              candidate.y + size,
            )
            addSegment(
              rotateTargetMarker,
              candidate.x - size,
              candidate.y + size,
              candidate.x - size,
              candidate.y - size,
            )
            addSegment(
              rotateTargetMarker,
              candidate.x - size - 2,
              candidate.y,
              candidate.x + size + 2,
              candidate.y,
            )
            addSegment(
              rotateTargetMarker,
              candidate.x,
              candidate.y - size - 2,
              candidate.x,
              candidate.y + size + 2,
            )
          }
        } else {
          addSegment(
            moveGuide,
            base.x - size,
            base.y - size,
            base.x + size,
            base.y - size,
          )
          addSegment(
            moveGuide,
            base.x + size,
            base.y - size,
            base.x + size,
            base.y + size,
          )
          addSegment(
            moveGuide,
            base.x + size,
            base.y + size,
            base.x - size,
            base.y + size,
          )
          addSegment(
            moveGuide,
            base.x - size,
            base.y + size,
            base.x - size,
            base.y - size,
          )
        }
        const markers =
          movePreview.mode === "rotate" ||
          movePreview.mode === "scale" ||
          movePreview.mode === "mirror"
            ? Object.freeze({
                center: Object.freeze({
                  point: Object.freeze({ x: base.x, y: base.y }),
                  segments: new Float32Array(rotateCenterMarker),
                }),
                reference: reference
                  ? Object.freeze({
                      point: Object.freeze({ x: reference.x, y: reference.y }),
                      segments: new Float32Array(rotateReferenceMarker),
                    })
                  : null,
                target: candidate
                  ? Object.freeze({
                      point: Object.freeze({ x: candidate.x, y: candidate.y }),
                      segments: new Float32Array(rotateTargetMarker),
                    })
                  : null,
              })
            : null
        moveOverlay = Object.freeze({
          recordIds: Object.freeze(Array.from(movePreview.recordIds)),
          source: Object.freeze({
            segments: new Float32Array(moveSourceGhost),
            circles: Object.freeze(moveSourceCircles),
            arcs: Object.freeze(moveSourceArcs),
            ellipses: Object.freeze(moveSourceEllipses),
          }),
          mode: movePreview.mode,
          copyMode: Boolean(movePreview.copyMode),
          preserveSourceVisible: Boolean(movePreview.preserveSourceVisible),
          factor: movePreview.factor ?? null,
          angle: movePreview.angle ?? null,
          basePoint: Object.freeze({ x: base.x, y: base.y }),
          referencePoint: reference
            ? Object.freeze({ x: reference.x, y: reference.y })
            : null,
          candidatePoint: candidate
            ? Object.freeze({ x: candidate.x, y: candidate.y })
            : null,
          markers,
          guideSegments: new Float32Array(moveGuide),
        })
      }

      if (gripPreview) {
        if (gripPreview.type === "line") {
          const a = camera.worldToScreen(
            gripPreview.start.x,
            gripPreview.start.y,
          )
          const b = camera.worldToScreen(gripPreview.end.x, gripPreview.end.y)
          addSegment(nextPreview, a.x, a.y, b.x, b.y)
        } else if (gripPreview.type === "polyline") {
          const count = gripPreview.closed
            ? gripPreview.vertices.length
            : gripPreview.vertices.length - 1
          for (let index = 0; index < count; index++) {
            const a = camera.worldToScreen(
              gripPreview.vertices[index].x,
              gripPreview.vertices[index].y,
            )
            const next =
              gripPreview.vertices[(index + 1) % gripPreview.vertices.length]
            const b = camera.worldToScreen(next.x, next.y)
            addSegment(nextPreview, a.x, a.y, b.x, b.y)
          }
        } else if(gripPreview.type==="hatch")appendStyledPreview(gripPreview)
        else if(gripPreview.type==="text")appendTextAnnotation(gripPreview,viewportSettings.previewColor,{preview:true})
        else if(gripPreview.type?.startsWith("dimension-")){
          const presentation=window.CaderactDimensionGeometry.derive(gripPreview,getDimensionStyle(gripPreview),{length:getDocumentUnit()})
          if(presentation.supported){for(const [start,end] of presentation.lines){const a=camera.worldToScreen(start.x,start.y),b=camera.worldToScreen(end.x,end.y);addSegment(nextPreview,a.x,a.y,b.x,b.y)}for(const arc of presentation.arcs||[])previewArcs.push(projectArc({...arc,id:null}));for(const triangle of presentation.triangles)dimensionTriangles.push(Object.freeze({preview:true,points:Object.freeze(triangle.map(value=>Object.freeze(camera.worldToScreen(value.x,value.y)))),color:viewportSettings.previewColor,colorData:colorToRgba(viewportSettings.previewColor)}));const anchor=camera.worldToScreen(presentation.text.point.x,presentation.text.point.y);dimensionAnnotations.push(Object.freeze({preview:true,text:presentation.text.value,x:anchor.x,y:anchor.y,rotation:-presentation.text.rotation,fontSize:presentation.text.height*camera.state.zoom,color:viewportSettings.previewColor}))}
        }
      }

      const snap = getSnapResult()
      let snapOverlay = null
      if (
        snap?.snapped &&
        Number.isFinite(snap.point?.x) &&
        Number.isFinite(snap.point?.y)
      ) {
        const center = camera.worldToScreen(snap.point.x, snap.point.y),
          size = 5
        if (snap.kind === "endpoint") {
          addSegment(
            snapMarker,
            center.x - size,
            center.y - size,
            center.x + size,
            center.y - size,
          )
          addSegment(
            snapMarker,
            center.x + size,
            center.y - size,
            center.x + size,
            center.y + size,
          )
          addSegment(
            snapMarker,
            center.x + size,
            center.y + size,
            center.x - size,
            center.y + size,
          )
          addSegment(
            snapMarker,
            center.x - size,
            center.y + size,
            center.x - size,
            center.y - size,
          )
        } else if (snap.kind === "draft-point") {
          addSegment(
            snapMarker,
            center.x,
            center.y - size,
            center.x + size,
            center.y,
          )
          addSegment(
            snapMarker,
            center.x + size,
            center.y,
            center.x,
            center.y + size,
          )
          addSegment(
            snapMarker,
            center.x,
            center.y + size,
            center.x - size,
            center.y,
          )
          addSegment(
            snapMarker,
            center.x - size,
            center.y,
            center.x,
            center.y - size,
          )
        } else if (snap.kind === "midpoint") {
          addSegment(
            snapMarker,
            center.x,
            center.y - size,
            center.x + size,
            center.y + size,
          )
          addSegment(
            snapMarker,
            center.x + size,
            center.y + size,
            center.x - size,
            center.y + size,
          )
          addSegment(
            snapMarker,
            center.x - size,
            center.y + size,
            center.x,
            center.y - size,
          )
        } else if (snap.kind === "center") {
          for(let index=0;index<8;index++){const a=index*Math.PI/4,b=(index+1)*Math.PI/4;addSegment(snapMarker,center.x+Math.cos(a)*size,center.y+Math.sin(a)*size,center.x+Math.cos(b)*size,center.y+Math.sin(b)*size)}
          addSegment(snapMarker,center.x-size-2,center.y,center.x+size+2,center.y)
          addSegment(snapMarker,center.x,center.y-size-2,center.x,center.y+size+2)
        } else if (snap.kind === "intersection") {
          addSegment(snapMarker,center.x-size,center.y-size,center.x+size,center.y+size)
          addSegment(snapMarker,center.x+size,center.y-size,center.x-size,center.y+size)
        } else if (snap.kind === "quadrant") {
          addSegment(snapMarker,center.x-size,center.y,center.x,center.y-size)
          addSegment(snapMarker,center.x,center.y-size,center.x+size,center.y)
          addSegment(snapMarker,center.x+size,center.y,center.x,center.y+size)
          addSegment(snapMarker,center.x,center.y+size,center.x-size,center.y)
          addSegment(snapMarker,center.x-size-2,center.y,center.x+size+2,center.y)
        } else if (snap.kind === "vertex") {
          const inset=size-2;addSegment(snapMarker,center.x-inset,center.y-inset,center.x+inset,center.y-inset);addSegment(snapMarker,center.x+inset,center.y-inset,center.x+inset,center.y+inset);addSegment(snapMarker,center.x+inset,center.y+inset,center.x-inset,center.y+inset);addSegment(snapMarker,center.x-inset,center.y+inset,center.x-inset,center.y-inset)
        } else if (snap.kind === "nearest") {
          for(let index=0;index<8;index++){const a=index*Math.PI/4,b=(index+1)*Math.PI/4;addSegment(snapMarker,center.x+Math.cos(a)*2,center.y+Math.sin(a)*2,center.x+Math.cos(b)*2,center.y+Math.sin(b)*2)}
        } else if (snap.kind === "perpendicular") {
          addSegment(snapMarker,center.x-size,center.y-size,center.x-size,center.y+size)
          addSegment(snapMarker,center.x-size,center.y+size,center.x+size,center.y+size)
          addSegment(snapMarker,center.x-size+3,center.y+size-3,center.x-size+3,center.y+size)
          addSegment(snapMarker,center.x-size+3,center.y+size-3,center.x-size,center.y+size-3)
        } else if (snap.kind === "insertion") {
          addSegment(snapMarker,center.x-size,center.y-size,center.x+size,center.y-size);addSegment(snapMarker,center.x+size,center.y-size,center.x+size,center.y+size);addSegment(snapMarker,center.x+size,center.y+size,center.x-size,center.y+size);addSegment(snapMarker,center.x-size,center.y+size,center.x-size,center.y-size);addSegment(snapMarker,center.x-size,center.y,center.x+size,center.y);addSegment(snapMarker,center.x,center.y-size,center.x,center.y+size)
        } else if (snap.kind === "tangent") {
          for(let index=0;index<8;index++){const a=index*Math.PI/4,b=(index+1)*Math.PI/4;addSegment(snapMarker,center.x+Math.cos(a)*4,center.y+Math.sin(a)*4,center.x+Math.cos(b)*4,center.y+Math.sin(b)*4)}
          addSegment(snapMarker,center.x+4,center.y-6,center.x+4,center.y+6)
        } else {
          const inset = 2.5
          addSegment(
            snapMarker,
            center.x - inset,
            center.y - size,
            center.x - inset,
            center.y + size,
          )
          addSegment(
            snapMarker,
            center.x + inset,
            center.y - size,
            center.x + inset,
            center.y + size,
          )
          addSegment(
            snapMarker,
            center.x - size,
            center.y - inset,
            center.x + size,
            center.y - inset,
          )
          addSegment(
            snapMarker,
            center.x - size,
            center.y + inset,
            center.x + size,
            center.y + inset,
          )
        }
        const label = snapLabel(snap)
        snapOverlay = Object.freeze({
          kind: snap.kind,
          glyph: snap.kind,
          point: Object.freeze({ x: center.x, y: center.y }),
          label,
          sizePx: size,
          strokeWidthPx: viewportSettings.snapMarkerStrokeWidth || 1,
          segments: new Float32Array(snapMarker),
        })
      }

      const POINT_MARKER_HALF_SIZE = 3
      const projectedGrips = []
      for (const grip of getGrips()) {
        const center = camera.worldToScreen(grip.point.x, grip.point.y)
        const size = grip.state === "idle" ? POINT_MARKER_HALF_SIZE : 4
        const target =
          grip.state === "active"
            ? activeGrips
            : grip.state === "hover"
              ? hoverGrips
              : idleGrips
        addSegment(
          target,
          center.x - size,
          center.y - size,
          center.x + size,
          center.y - size,
        )
        addSegment(
          target,
          center.x + size,
          center.y - size,
          center.x + size,
          center.y + size,
        )
        addSegment(
          target,
          center.x + size,
          center.y + size,
          center.x - size,
          center.y + size,
        )
        addSegment(
          target,
          center.x - size,
          center.y + size,
          center.x - size,
          center.y - size,
        )
        projectedGrips.push(
          Object.freeze({
            recordId: grip.recordId,
            featureId: grip.featureId,
            kind: grip.kind,
            state: grip.state,
            point: Object.freeze({ x: center.x, y: center.y }),
          }),
        )
      }

      const draftPoints = []
      const projectedDraftPoints = []
      for (const point of getDraftPoints()) {
        if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue
        const center = camera.worldToScreen(point.x, point.y)
        const size = POINT_MARKER_HALF_SIZE
        addSegment(
          draftPoints,
          center.x - size,
          center.y - size,
          center.x + size,
          center.y - size,
        )
        addSegment(
          draftPoints,
          center.x + size,
          center.y - size,
          center.x + size,
          center.y + size,
        )
        addSegment(
          draftPoints,
          center.x + size,
          center.y + size,
          center.x - size,
          center.y + size,
        )
        addSegment(
          draftPoints,
          center.x - size,
          center.y + size,
          center.x - size,
          center.y - size,
        )
        projectedDraftPoints.push(
          Object.freeze({
            point: Object.freeze({ x: center.x, y: center.y }),
          }),
        )
      }

      const box = getSelectionBox()
      let selectionBoxOverlay = null
      if (box?.active) {
        const rect = window.CaderactSelectionBox.normalizeRect(
          box.start,
          box.current,
        )
        const target =
          box.mode === "window" ? selectionWindow : selectionCrossing
        const fillTarget =
          box.mode === "window" ? selectionWindowFill : selectionCrossingFill
        function addEdge(x1, y1, x2, y2) {
          if (box.mode === "window") {
            addSegment(target, x1, y1, x2, y2)
            return
          }
          const length = Math.hypot(x2 - x1, y2 - y1),
            dash = 6,
            gap = 4
          if (length === 0) return
          for (let offset = 0; offset < length; offset += dash + gap) {
            const a = offset / length,
              b = Math.min(length, offset + dash) / length
            addSegment(
              target,
              x1 + (x2 - x1) * a,
              y1 + (y2 - y1) * a,
              x1 + (x2 - x1) * b,
              y1 + (y2 - y1) * b,
            )
          }
        }
        addEdge(rect.left, rect.top, rect.right, rect.top)
        addEdge(rect.right, rect.top, rect.right, rect.bottom)
        addEdge(rect.right, rect.bottom, rect.left, rect.bottom)
        addEdge(rect.left, rect.bottom, rect.left, rect.top)
        const fillTop = Math.max(0, rect.top),
          fillBottom = Math.min(viewportHeight, rect.bottom)
        const fillLeft = Math.max(0, rect.left),
          fillRight = Math.min(viewportWidth, rect.right)
        if (fillLeft <= fillRight && fillTop <= fillBottom)
          for (let y = Math.ceil(fillTop); y <= fillBottom; y += 1)
            addSegment(fillTarget, fillLeft, y, fillRight, y)
        selectionBoxOverlay = Object.freeze({
          kind: "selection-box",
          mode: box.mode,
          ...rect,
          fill: Object.freeze({
            color:
              box.mode === "window"
                ? viewportSettings.selectionWindowFill ||
                  "rgba(75, 155, 210, 0.10)"
                : viewportSettings.selectionCrossingFill ||
                  "rgba(78, 170, 112, 0.10)",
            segments: new Float32Array(fillTarget),
          }),
          segments: new Float32Array(target),
        })
      }

      const professional=getProfessionalSelection(),professionalSegments=[]
      if(professional){const points=[...professional.points];if(professional.current&&(points.length===0||points.at(-1).x!==professional.current.x||points.at(-1).y!==professional.current.y))points.push(professional.current);const target=professional.mode==="window-polygon"?selectionWindow:selectionCrossing;const addProfessional=(a,b)=>{professionalSegments.push(a.x,a.y,b.x,b.y);if(professional.mode==="window-polygon")addSegment(target,a.x,a.y,b.x,b.y);else{const length=Math.hypot(b.x-a.x,b.y-a.y)||1;for(let offset=0;offset<length;offset+=10){const start=offset/length,end=Math.min(length,offset+6)/length;addSegment(target,a.x+(b.x-a.x)*start,a.y+(b.y-a.y)*start,a.x+(b.x-a.x)*end,a.y+(b.y-a.y)*end)}}};for(let index=1;index<points.length;index++)addProfessional(points[index-1],points[index]);if(professional.mode!=="fence"&&points.length>2)addProfessional(points.at(-1),points[0])}
      const selectionCycle=getSelectionCycle()

      // The ordered groups are a renderer input, never authoritative geometry.
      const combinedMajorGrid = viewportSettings.gridVisible === false ? [] : majorGrid.concat(boundary)
      const polarGuide = getPolarGuide()
      if (polarGuide) {
        const origin = camera.worldToScreen(polarGuide.reference.x, polarGuide.reference.y)
        const directionPoint = camera.worldToScreen(polarGuide.reference.x + Math.cos(polarGuide.angle), polarGuide.reference.y + Math.sin(polarGuide.angle))
        const length = Math.hypot(directionPoint.x - origin.x, directionPoint.y - origin.y) || 1
        const span = Math.hypot(viewportWidth, viewportHeight)
        const dx = (directionPoint.x - origin.x) / length * span, dy = (directionPoint.y - origin.y) / length * span
        addSegment(polarGuideSegments, origin.x - dx, origin.y - dy, origin.x + dx, origin.y + dy)
        addSegment(nextPreview, origin.x - dx, origin.y - dy, origin.x + dx, origin.y + dy)
      }
      const tracking = getObjectTrackingState()
      let objectTrackingOverlay = null
      const acquiredTrackingPoints=tracking?.acquiredPoints?.length?tracking.acquiredPoints:(tracking?.acquired?[tracking.acquired]:[])
      if (acquiredTrackingPoints.length || tracking?.activeGuides?.length) {
        const projectedAcquired=[]
        for(const trackedPoint of acquiredTrackingPoints){const acquired=camera.worldToScreen(trackedPoint.point.x,trackedPoint.point.y),acquiredSize=4;projectedAcquired.push(Object.freeze({x:acquired.x,y:acquired.y}));addSegment(objectTrackingMarkers,acquired.x-acquiredSize,acquired.y,acquired.x,acquired.y-acquiredSize);addSegment(objectTrackingMarkers,acquired.x,acquired.y-acquiredSize,acquired.x+acquiredSize,acquired.y);addSegment(objectTrackingMarkers,acquired.x+acquiredSize,acquired.y,acquired.x,acquired.y+acquiredSize);addSegment(objectTrackingMarkers,acquired.x,acquired.y+acquiredSize,acquired.x-acquiredSize,acquired.y)}
        for(const activeGuide of tracking.activeGuides||[]){const origin=camera.worldToScreen(activeGuide.origin.x,activeGuide.origin.y);if(activeGuide.kind==="horizontal")addSegment(objectTrackingGuide,0,origin.y,viewportWidth,origin.y);else if(activeGuide.kind==="vertical")addSegment(objectTrackingGuide,origin.x,0,origin.x,viewportHeight);else if(activeGuide.kind==="polar"||activeGuide.kind==="parallel"||activeGuide.kind==="extension"){const direction=camera.worldToScreen(activeGuide.origin.x+Math.cos(activeGuide.angle),activeGuide.origin.y+Math.sin(activeGuide.angle)),length=Math.hypot(direction.x-origin.x,direction.y-origin.y)||1,span=Math.hypot(viewportWidth,viewportHeight),dx=(direction.x-origin.x)/length*span,dy=(direction.y-origin.y)/length*span;if(activeGuide.kind==="polar"||activeGuide.kind==="extension")addSegment(objectTrackingGuide,origin.x,origin.y,origin.x+dx,origin.y+dy);else addSegment(objectTrackingGuide,origin.x-dx,origin.y-dy,origin.x+dx,origin.y+dy)}}
        if(!(tracking.activeGuides?.length)){const acquired=projectedAcquired.at(-1);if(tracking.guide==="horizontal")addSegment(objectTrackingGuide,0,acquired.y,viewportWidth,acquired.y);else if(tracking.guide==="vertical")addSegment(objectTrackingGuide,acquired.x,0,acquired.x,viewportHeight)}
        const directSnap=snap?.snapped&&snap.kind!=="tracking"
        const candidate=tracking.candidate&&!directSnap?camera.worldToScreen(tracking.candidate.x,tracking.candidate.y):null
        if(candidate){const size=tracking.candidateKind==="intersection"?4:3;addSegment(objectTrackingMarkers,candidate.x-size,candidate.y,candidate.x+size,candidate.y);addSegment(objectTrackingMarkers,candidate.x,candidate.y-size,candidate.x,candidate.y+size)}
        objectTrackingOverlay=Object.freeze({acquiredPoint:projectedAcquired.at(-1),acquiredPoints:Object.freeze(projectedAcquired),candidatePoint:candidate?Object.freeze({x:candidate.x,y:candidate.y}):null,candidateKind:tracking.candidateKind,guideKind:tracking.guide,guides:Object.freeze((tracking.activeGuides||[]).map(value=>Object.freeze({...value,origin:Object.freeze(camera.worldToScreen(value.origin.x,value.origin.y))}))),guideSegments:new Float32Array(objectTrackingGuide),markerSegments:new Float32Array(objectTrackingMarkers)})
      }
      const propertyPreviewDrawGroups=[]
      for(const bucket of previewPropertyBuckets.values()){const style=bucket.style,styledLine=lineGroup(style.color,bucket.segments,style);propertyPreviewDrawGroups.push(Object.freeze({style,recordIds:Object.freeze(bucket.recordIds.slice().sort()),lineGroup:styledLine,circleGroup:Object.freeze({...styledLine,circles:Object.freeze(bucket.circles)}),arcGroup:Object.freeze({...styledLine,arcs:Object.freeze(bucket.arcs)}),ellipseGroup:Object.freeze({...styledLine,ellipses:Object.freeze(bucket.ellipses)})}))}
      const lineGroups = [
        lineGroup(viewportSettings.gridColor, viewportSettings.gridVisible === false||paperSpace ? [] : minorGrid),
        lineGroup(
          viewportSettings.majorGridColor || viewportSettings.gridBoundaryColor,
          paperSpace ? [] : combinedMajorGrid,
        ),
        lineGroup(viewportSettings.xAxisColor, viewportSettings.gridVisible === false||paperSpace ? [] : xAxis),
        lineGroup(viewportSettings.yAxisColor, viewportSettings.gridVisible === false||paperSpace ? [] : yAxis),
        lineGroup(viewportSettings.geometryColor, geometry),
        lineGroup(
          viewportSettings.acceptedDraftColor || viewportSettings.geometryColor,
          acceptedDraft,
        ),
        lineGroup(viewportSettings.previewColor, nextPreview),
        {
          ...lineGroup(
            viewportSettings.selectionColor || viewportSettings.geometryColor,
            selection,
          ),
          lineWidth: 2,
        },
        lineGroup(
          viewportSettings.gripColor || viewportSettings.geometryColor,
          idleGrips,
        ),
        lineGroup(
          viewportSettings.gripHoverColor || viewportSettings.snapMarkerColor,
          hoverGrips,
        ),
        lineGroup(
          viewportSettings.gripActiveColor || viewportSettings.selectionColor,
          activeGrips,
        ),
        lineGroup(
          viewportSettings.draftPointColor || viewportSettings.geometryColor,
          draftPoints,
        ),
        lineGroup(
          viewportSettings.selectionWindowFill || "rgba(75, 155, 210, 0.10)",
          selectionWindowFill,
        ),
        lineGroup(
          viewportSettings.selectionCrossingFill || "rgba(78, 170, 112, 0.10)",
          selectionCrossingFill,
        ),
        lineGroup(
          viewportSettings.selectionWindowColor ||
            viewportSettings.selectionColor,
          selectionWindow,
        ),
        lineGroup(
          viewportSettings.selectionCrossingColor ||
            viewportSettings.selectionColor,
          selectionCrossing,
        ),
        lineGroup(
          viewportSettings.snapMarkerColor || viewportSettings.previewColor,
          snapMarker,
          {lineWidth:viewportSettings.snapMarkerStrokeWidth || 1},
        ),
        lineGroup(
          viewportSettings.moveSourceGhostColor || "rgba(160, 177, 193, 0.35)",
          moveSourceGhost,
        ),
        lineGroup(
          viewportSettings.moveGuideColor || viewportSettings.snapMarkerColor,
          moveGuide,
        ),
        lineGroup(
          viewportSettings.rotateCenterMarkerColor ||
            viewportSettings.snapMarkerColor,
          rotateCenterMarker,
        ),
        lineGroup(
          viewportSettings.rotateReferenceMarkerColor ||
            viewportSettings.previewColor,
          rotateReferenceMarker,
        ),
        lineGroup(
          viewportSettings.rotateTargetMarkerColor ||
            viewportSettings.selectionColor,
          rotateTargetMarker,
        ),
        lineGroup(viewportSettings.trackingGuideColor || "rgba(111, 190, 210, 0.62)", objectTrackingGuide,{linetype:"dashed",lineWidth:1}),
        lineGroup(viewportSettings.trackingMarkerColor || "rgba(137, 218, 232, 0.96)", objectTrackingMarkers,{lineWidth:1.25}),
      ]
      const circleGroups = lineGroups.map((group, index) =>
        Object.freeze({
          color: group.color,
          colorData: group.colorData,
          lineWidth: group.lineWidth,
          circles: Object.freeze(
            index === 4
              ? committedCircles
              : index === 6
                ? previewCircles
                : index === 7
                  ? selectedCircles
                  : index === 17
                    ? moveSourceCircles
                    : [],
          ),
        }),
      )
      const arcGroups = lineGroups.map((group, index) =>
        Object.freeze({
          color: group.color,
          colorData: group.colorData,
          lineWidth: group.lineWidth,
          arcs: Object.freeze(
            index === 4
              ? committedArcs
              : index === 6
                ? previewArcs
                : index === 7
                  ? selectedArcs
                  : index === 17
                    ? moveSourceArcs
                    : [],
          ),
        }),
      )
      const ellipseGroups = lineGroups.map((group, index) =>
        Object.freeze({
          color: group.color,
          colorData: group.colorData,
          lineWidth: group.lineWidth,
          ellipses: Object.freeze(
            index === 4
              ? committedEllipses
              : index === 6
                ? previewEllipses
                : index === 7
                  ? selectedEllipses
                  : index === 17
                    ? moveSourceEllipses
                    : [],
          ),
        }),
      )
      let paperSpaceOverlay=null,paperDrawGroups=[],paperTriangles=[]
      if(paperSpace?.valid){const p=paperSpace,project=value=>camera.worldToScreen(value.x,value.y),a=project({x:p.sheet.left,y:p.sheet.bottom}),b=project({x:p.sheet.right,y:p.sheet.bottom}),c=project({x:p.sheet.right,y:p.sheet.top}),d=project({x:p.sheet.left,y:p.sheet.top}),pa=project({x:p.printable.left,y:p.printable.bottom}),pb=project({x:p.printable.right,y:p.printable.bottom}),pc=project({x:p.printable.right,y:p.printable.top}),pd=project({x:p.printable.left,y:p.printable.top}),sheetSegments=[a.x,a.y,b.x,b.y,b.x,b.y,c.x,c.y,c.x,c.y,d.x,d.y,d.x,d.y,a.x,a.y],printableSegments=[pa.x,pa.y,pb.x,pb.y,pb.x,pb.y,pc.x,pc.y,pc.x,pc.y,pd.x,pd.y,pd.x,pd.y,pa.x,pa.y],fill="#f7f7f2",boundary="rgba(88, 99, 109, 0.48)",margin="rgba(88, 99, 109, 0.14)";paperTriangles=[Object.freeze({points:Object.freeze([a,b,c]),color:fill,colorData:colorToRgba(fill)}),Object.freeze({points:Object.freeze([a,c,d]),color:fill,colorData:colorToRgba(fill)})];const sheetGroup=lineGroup(boundary,sheetSegments,{lineWidth:.75}),marginGroup=lineGroup(margin,printableSegments,{linetype:"dashed",lineWidth:.5});paperDrawGroups=[Object.freeze({lineGroup:sheetGroup,circleGroup:null,arcGroup:null,ellipseGroup:null,role:"paper-edge"}),Object.freeze({lineGroup:marginGroup,circleGroup:null,arcGroup:null,ellipseGroup:null,role:"printable-area"})];paperSpaceOverlay=Object.freeze({unit:"mm",sheet:p.sheet,printable:p.printable,screenSheet:Object.freeze({left:a.x,bottom:a.y,right:c.x,top:c.y}),segments:sheetGroup.segments,printableSegments:marginGroup.segments,fillColor:fill,boundaryColor:boundary,printableColor:margin})}
      const layoutViewportDrawGroups=[],layoutViewportItems=[],layoutViewportBackgroundTriangles=[]
      if(paperSpace?.valid){const clip=(a,b,f)=>{let t0=0,t1=1,dx=b.x-a.x,dy=b.y-a.y;for(const [p,q] of [[-dx,a.x-f.x],[dx,f.x+f.width-a.x],[-dy,a.y-f.y],[dy,f.y+f.height-a.y]]){if(p===0&&q<0)return null;if(p!==0){const r=q/p;if(p<0){if(r>t1)return null;t0=Math.max(t0,r)}else{if(r<t0)return null;t1=Math.min(t1,r)}}}return[{x:a.x+t0*dx,y:a.y+t0*dy},{x:a.x+t1*dx,y:a.y+t1*dy}]};const modelUnit=getDocumentUnit();for(const viewport of getLayoutViewports()){const buckets=new Map(),frame=viewport.frame,framePoints=[{x:frame.x,y:frame.y},{x:frame.x+frame.width,y:frame.y},{x:frame.x+frame.width,y:frame.y+frame.height},{x:frame.x,y:frame.y+frame.height}],frameSegments=[];for(let i=0;i<4;i++){const a=camera.worldToScreen(framePoints[i].x,framePoints[i].y),b=camera.worldToScreen(framePoints[(i+1)%4].x,framePoints[(i+1)%4].y);addSegment(frameSegments,a.x,a.y,b.x,b.y)}for(const record of viewport.frameOnly?[]:getModelRecords()){const layer=getLayer(record.layerId);if(layer?.visible===false)continue;const color=window.CaderactObjectProperties.effectiveColor(record,layer),key=color;if(!buckets.has(key))buckets.set(key,[]);const source=buckets.get(key),pairs=[];if(record.type==="line")pairs.push([record.start,record.end]);else if(record.type==="polyline"){const count=record.closed?record.vertices.length:record.vertices.length-1;for(let i=0;i<count;i++)pairs.push([record.vertices[i],record.vertices[(i+1)%record.vertices.length]])}else if(record.type==="circle"){for(let i=0;i<64;i++){const a=i*Math.PI*2/64,b=(i+1)*Math.PI*2/64;pairs.push([{x:record.center.x+Math.cos(a)*record.radius,y:record.center.y+Math.sin(a)*record.radius},{x:record.center.x+Math.cos(b)*record.radius,y:record.center.y+Math.sin(b)*record.radius}])}}else if(record.type==="arc"){const start=Math.atan2(record.start.y-record.center.y,record.start.x-record.center.x),count=48;for(let i=0;i<count;i++){const a=start+record.sweep*i/count,b=start+record.sweep*(i+1)/count;pairs.push([{x:record.center.x+Math.cos(a)*record.radius,y:record.center.y+Math.sin(a)*record.radius},{x:record.center.x+Math.cos(b)*record.radius,y:record.center.y+Math.sin(b)*record.radius}])}}else if(record.type==="ellipse"){const major=Math.hypot(record.majorAxis.x,record.majorAxis.y),angle=Math.atan2(record.majorAxis.y,record.majorAxis.x);for(let i=0;i<64;i++){const point=t=>({x:record.center.x+Math.cos(t)*major*Math.cos(angle)-Math.sin(t)*record.minorRadius*Math.sin(angle),y:record.center.y+Math.cos(t)*major*Math.sin(angle)+Math.sin(t)*record.minorRadius*Math.cos(angle)});pairs.push([point(i*Math.PI*2/64),point((i+1)*Math.PI*2/64)])}}for(const pair of pairs){const a=window.CaderactPaperSpace.projectModelPoint(pair[0],viewport,modelUnit),b=window.CaderactPaperSpace.projectModelPoint(pair[1],viewport,modelUnit),clipped=clip(a,b,frame);if(!clipped)continue;const sa=camera.worldToScreen(clipped[0].x,clipped[0].y),sb=camera.worldToScreen(clipped[1].x,clipped[1].y);addSegment(source,sa.x,sa.y,sb.x,sb.y)}}for(const [color,segments] of buckets){const group=lineGroup(color,segments);layoutViewportDrawGroups.push(Object.freeze({lineGroup:group,circleGroup:null,arcGroup:null,ellipseGroup:null,viewportId:viewport.id}))}const frameGroup=lineGroup("#252b31",frameSegments,{lineWidth:1});layoutViewportDrawGroups.push(Object.freeze({lineGroup:frameGroup,circleGroup:null,arcGroup:null,ellipseGroup:null,viewportId:viewport.id,role:"frame"}));layoutViewportItems.push(Object.freeze({id:viewport.id,frame:Object.freeze({...frame}),screenSegments:frameGroup.segments,scale:viewport.scale,locked:viewport.locked,viewCenter:Object.freeze({...viewport.viewCenter})}))}}
      if(paperSpace?.valid){for(const viewport of getLayoutViewports()){if(viewport.active&&!viewport.frameOnly){const f=viewport.frame,a=camera.worldToScreen(f.x,f.y),b=camera.worldToScreen(f.x+f.width,f.y),c=camera.worldToScreen(f.x+f.width,f.y+f.height),d=camera.worldToScreen(f.x,f.y+f.height),color=viewportSettings.backgroundColor,colorData=colorToRgba(color);layoutViewportBackgroundTriangles.push(Object.freeze({points:Object.freeze([a,b,c]),color,colorData,viewportId:viewport.id}),Object.freeze({points:Object.freeze([a,c,d]),color,colorData,viewportId:viewport.id}))}layoutViewportDrawGroups.unshift(...activeLayoutViewportGridGroups(viewport,getDocumentUnit()))}}
      return {
        width: viewportWidth,
        height: viewportHeight,
        deviceScale: scale,
        backgroundColor: viewportSettings.backgroundColor,
        backgroundColorData: colorToRgba(viewportSettings.backgroundColor),
        grid: Object.freeze({
          unit: getDocumentUnit(),
          minorSpacing: spacing,
          majorSpacing: spacing * (viewportSettings.majorGridInterval || MAJOR_MULTIPLE),
          majorMultiple: viewportSettings.majorGridInterval || MAJOR_MULTIPLE,
          maxLinesPerAxis: MAX_GRID_LINES_PER_AXIS,
          minorSegments: new Float32Array(minorGrid),
          majorSegments: new Float32Array(majorGrid),
          boundarySegments: new Float32Array(boundary),
        }),
        snapOverlay,
        acceptedDraftOverlay: Object.freeze({
          segments: new Float32Array(acceptedDraft),
        }),
        nextSegmentPreviewOverlay: Object.freeze({
          segments: new Float32Array(nextPreview),
        }),
        polarTrackingOverlay: Object.freeze({ segments: new Float32Array(polarGuideSegments) }),
        objectTrackingOverlay,
        paperSpaceOverlay,
        layoutViewportOverlay:Object.freeze({items:Object.freeze(layoutViewportItems)}),
        measurementOverlay,
        selectionOverlay: Object.freeze({
          recordIds: Object.freeze(Array.from(selectedIds).sort()),
          segments: new Float32Array(selection),
        }),
        gripOverlay: Object.freeze({
          grips: Object.freeze(projectedGrips),
          idleSegments: new Float32Array(idleGrips),
          hoverSegments: new Float32Array(hoverGrips),
          activeSegments: new Float32Array(activeGrips),
        }),
        draftPointOverlay: Object.freeze({
          points: Object.freeze(projectedDraftPoints),
          segments: new Float32Array(draftPoints),
        }),
        circleOverlay: Object.freeze({
          committed: Object.freeze(committedCircles),
          preview: Object.freeze(previewCircles),
          selected: Object.freeze(selectedCircles),
        }),
        arcOverlay: Object.freeze({
          committed: Object.freeze(committedArcs),
          preview: Object.freeze(previewArcs),
          selected: Object.freeze(selectedArcs),
        }),
        ellipseOverlay: Object.freeze({
          committed: Object.freeze(committedEllipses),
          preview: Object.freeze(previewEllipses),
          selected: Object.freeze(selectedEllipses),
        }),
        selectionBoxOverlay,
        professionalSelectionOverlay:professional?Object.freeze({kind:"professional-selection",mode:professional.mode,segments:new Float32Array(professionalSegments),points:Object.freeze(professional.points)}):null,
        selectionCycleOverlay:selectionCycle?Object.freeze({...selectionCycle}):null,
        transformOverlay: moveOverlay,
        moveOverlay,
        polylineOverlay: Object.freeze({
          committed: Object.freeze(committedPolylines),
          selected: Object.freeze(selectedPolylines),
        }),
        lineGroups,
        circleGroups,
        arcGroups,
        ellipseGroups,
        solidFillOverlay:Object.freeze({triangles:Object.freeze(hatchTriangles)}),
        triangleGroups:Object.freeze([Object.freeze({role:"annotation",triangles:Object.freeze(dimensionTriangles)}),Object.freeze({role:"solid-hatch",triangles:Object.freeze(hatchTriangles)}),Object.freeze({role:"paper",triangles:Object.freeze(paperTriangles)}),Object.freeze({role:"model-view-background",triangles:Object.freeze(layoutViewportBackgroundTriangles)})]),
        annotationOverlay:Object.freeze({items:Object.freeze(dimensionAnnotations)}),
        propertyDrawGroups:Object.freeze(propertyDrawGroups),
        propertyPreviewDrawGroups:Object.freeze(propertyPreviewDrawGroups),
        drawGroups: Object.freeze(
          [...paperDrawGroups,...layoutViewportDrawGroups,...lineGroups.slice(0,5).map((lineGroup, index) =>
            Object.freeze({
              lineGroup,
              circleGroup: circleGroups[index],
              arcGroup: arcGroups[index],
              ellipseGroup: ellipseGroups[index],
            }),
          ),...propertyDrawGroups,...lineGroups.slice(5,7).map((lineGroup,offset)=>{const index=offset+5;return Object.freeze({lineGroup,circleGroup:circleGroups[index],arcGroup:arcGroups[index],ellipseGroup:ellipseGroups[index]})}),...propertyPreviewDrawGroups,...lineGroups.slice(7).map((lineGroup,offset)=>{const index=offset+7;return Object.freeze({lineGroup,circleGroup:circleGroups[index],arcGroup:arcGroups[index],ellipseGroup:ellipseGroups[index]})})],
        ),
      }
    }

    let worldGeometryCache=null
    function invalidateWorldGeometry(){worldGeometryCache=null}
    function createWorldGeometry(records){
      const source=Array.from(records),reusable=worldGeometryCache&&worldGeometryCache.source.length===source.length&&source.every((record,index)=>record===worldGeometryCache.source[index])
      if(reusable)return worldGeometryCache.scene
      // Stable presentation coordinates retain the renderer's conventional
      // downward Y axis while omitting camera scale and translation.
      const worldSettings={...viewportSettings,gridVisible:false,gridExtent:0},identityCamera={state:{zoom:1},worldToScreen:(x,y)=>({x,y:-y}),screenToWorld:(x,y)=>({x,y:-y})}
      const builder=createSceneBuilder({viewportSettings:worldSettings,camera:identityCamera,getViewportSize:()=>({width:1,height:1}),getDocumentUnit,getDimensionStyle,getRecords:()=>source,getLayer,getModelRecords:()=>[]})
      const projected=builder.createScene(),baseGroup=Object.freeze({lineGroup:projected.lineGroups[4],circleGroup:projected.circleGroups[4],arcGroup:projected.arcGroups[4],ellipseGroup:projected.ellipseGroups[4]}),triangles=projected.triangleGroups.filter(group=>group.role==="solid-hatch"||group.role==="annotation").map(group=>Object.freeze({role:group.role,triangles:Object.freeze(group.triangles.filter(triangle=>!triangle.preview&&!triangle.selected))}))
      const scene=Object.freeze({drawGroups:Object.freeze([baseGroup,...projected.propertyDrawGroups]),triangleGroups:Object.freeze(triangles),annotations:Object.freeze(projected.annotationOverlay.items.filter(item=>!item.preview)),recordCount:source.length})
      worldGeometryCache={source,scene}
      return scene
    }
    function createRenderScene({reuseWorld=true}={}){
      if(!reuseWorld||getPaperSpace()?.valid)return createScene()
      const worldGeometry=worldGeometryCache?.scene||createWorldGeometry(getRecords()),overlay=createScene({recordsOverride:Object.freeze([])}),cameraTransform=Object.freeze({zoom:camera.state.zoom,panX:camera.state.panX,panY:camera.state.panY}),annotations=worldGeometry.annotations.map(item=>Object.freeze({...item,x:camera.state.panX+item.x*camera.state.zoom,y:camera.state.panY+item.y*camera.state.zoom,fontSize:item.fontSize*camera.state.zoom}))
      return Object.freeze({...overlay,worldGeometry,cameraTransform,annotationOverlay:Object.freeze({items:Object.freeze(annotations)})})
    }
    return Object.freeze({
      createScene,
      createRenderScene,
      invalidateWorldGeometry,
      getWorldGeometryState:()=>Object.freeze({cached:Boolean(worldGeometryCache),recordCount:worldGeometryCache?.scene.recordCount||0,scene:worldGeometryCache?.scene||null}),
      getAdaptiveGridSpacing,
      GRID_STEPS,
      MAJOR_MULTIPLE,
      MAX_GRID_LINES_PER_AXIS,
      POINT_MARKER_HALF_SIZE,
    })
  }

  const POINT_MARKER_HALF_SIZE = 3
  window.CaderactViewportScene = Object.freeze({
    createSceneBuilder,
    SNAP_LABELS,
    snapLabel,
    POINT_MARKER_HALF_SIZE,
  })
})()
