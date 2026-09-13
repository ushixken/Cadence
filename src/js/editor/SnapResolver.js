// D2: pure pointer snap candidate collection and deterministic resolution.
(() => {
  const DEFAULT_TOLERANCE_PX = 10
  const PRIORITY_WINDOW_PX = 0.75
  const priorities = Object.freeze({ endpoint: 0, vertex: 0, intersection: 1, "draft-point": 2, midpoint: 3, center: 4, quadrant: 5, perpendicular: 6, tangent: 7, nearest: 8, grid: 9 })
  const freezePoint = point => Object.freeze({ x: point.x, y: point.y })
  // Exact half-cells resolve to the greater lattice index (toward +infinity).
  const nearestGridIndex = value => Math.floor(value + 0.5)

  function createResolver({ tolerancePx = DEFAULT_TOLERANCE_PX, priorityWindowPx = PRIORITY_WINDOW_PX } = {}) {
    function resolve({ rawWorldPoint, worldToScreen, records = [], transientCandidates = [], draftPoints = [], gridSpacing, enabled = {}, excludedFeatureIds = [], excludedRecordIds = [], referencePoint = null }) {
      const rawPoint = freezePoint(rawWorldPoint)
      if (!Number.isFinite(rawPoint.x) || !Number.isFinite(rawPoint.y) || typeof worldToScreen !== "function") {
        return Object.freeze({ snapped: false, point: rawPoint })
      }
      const rawScreen = worldToScreen(rawPoint.x, rawPoint.y)
      if (!Number.isFinite(rawScreen.x) || !Number.isFinite(rawScreen.y)) return Object.freeze({ snapped: false, point: rawPoint })
      const candidates = []
      const excluded = new Set(excludedFeatureIds)
      const excludedRecords = new Set(excludedRecordIds)
      function add(kind, point, stableKey, reference = null) {
        const advanced = new Set(["center","intersection","quadrant","nearest","perpendicular","tangent","vertex"])
        if (enabled[kind] === false || (advanced.has(kind) && enabled[kind] !== true) || (kind !== "grid" && kind !== "draft-point" && enabled.object === false) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return
        const screen = worldToScreen(point.x, point.y)
        if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return
        const distancePx = Math.hypot(screen.x - rawScreen.x, screen.y - rawScreen.y)
        if (!Number.isFinite(distancePx) || distancePx > tolerancePx) return
        let sourceReference=reference
        if(!sourceReference&&kind!=="grid"&&kind!=="draft-point"){
          const parts=String(stableKey).split(":")
          sourceReference=kind==="intersection"?Object.freeze({kind:"objects",recordIds:Object.freeze([parts[1],parts[2]])}):window.CaderactReferences.createObjectReference(parts[1])
        }
        candidates.push({ kind, point: freezePoint(point), distancePx, stableKey, reference, sourceReference })
      }
      function addContinuousGrid(point) {
        if (enabled.grid === false || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return
        const screen = worldToScreen(point.x, point.y)
        if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return
        const distancePx = Math.hypot(screen.x - rawScreen.x, screen.y - rawScreen.y)
        if (!Number.isFinite(distancePx)) return
        candidates.push({ kind: "grid", point: freezePoint(point), distancePx, stableKey: "grid", reference: null })
      }
      const ordered = Array.from(records).filter(record => !excludedRecords.has(record?.id) && (record?.type === "line" || record?.type === "circle" || record?.type === "arc" || record?.type === "ellipse" || record?.type === "polyline")).sort((a, b) => a.id.localeCompare(b.id))
      for (const record of ordered) {
        if(record.type==="circle"||record.type==="arc"||record.type==="ellipse") add("center",record.center,`center:${record.id}`)
        if(record.type==="circle") continue
        if(record.type==="ellipse") continue
        if(record.type==="polyline"){
          for(const vertex of [...record.vertices].sort((a,b)=>a.featureId.localeCompare(b.featureId))){if(!excluded.has(vertex.featureId))add("endpoint",vertex,`endpoint:${record.id}:${vertex.featureId}`,window.CaderactReferences.createEndpointReference(record.id,vertex.featureId))}
          const count=record.closed?record.vertices.length:record.vertices.length-1
          for(let index=0;index<count;index++){const a=record.vertices[index],b=record.vertices[(index+1)%record.vertices.length];add("midpoint",{x:(a.x+b.x)/2,y:(a.y+b.y)/2},`midpoint:${record.id}:${index}`)}
          continue
        }
        for (const endpoint of [record.start, record.end].sort((a, b) => a.featureId.localeCompare(b.featureId))) {
          if (excluded.has(endpoint.featureId)) continue
          add("endpoint", endpoint, `endpoint:${record.id}:${endpoint.featureId}`,
            window.CaderactReferences.createEndpointReference(record.id, endpoint.featureId))
        }
        if (record.type === "line") {
          const midpoint = { x: record.start.x + (record.end.x - record.start.x) / 2,
            y: record.start.y + (record.end.y - record.start.y) / 2 }
          add("midpoint", midpoint, `midpoint:${record.id}`)
        } else if(record.type==="arc") {
          const startAngle=Math.atan2(record.start.y-record.center.y,record.start.x-record.center.x)
          add("midpoint",{x:record.center.x+Math.cos(startAngle+record.sweep/2)*record.radius,y:record.center.y+Math.sin(startAngle+record.sweep/2)*record.radius},`midpoint:${record.id}`)
        }
        const quadrantAngles=[0,Math.PI/2,Math.PI,Math.PI*1.5]
        if(record.type==="arc")for(const angle of quadrantAngles)if(window.CaderactArcGeometry.angleOnSweep(angle,Math.atan2(record.start.y-record.center.y,record.start.x-record.center.x),record.sweep))add("quadrant",{x:record.center.x+Math.cos(angle)*record.radius,y:record.center.y+Math.sin(angle)*record.radius},`quadrant:${record.id}:${angle}`)
        if(record.type==="line"||record.type==="arc"){}
      }
      for(const record of ordered){
        if(record.type==="circle")for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])add("quadrant",{x:record.center.x+Math.cos(angle)*record.radius,y:record.center.y+Math.sin(angle)*record.radius},`quadrant:${record.id}:${angle}`)
        else if(record.type==="ellipse"){const a=record.majorAxis,ar=Math.hypot(a.x,a.y),n={x:-a.y/ar*record.minorRadius,y:a.x/ar*record.minorRadius};for(const point of [{x:record.center.x+a.x,y:record.center.y+a.y},{x:record.center.x-a.x,y:record.center.y-a.y},{x:record.center.x+n.x,y:record.center.y+n.y},{x:record.center.x-n.x,y:record.center.y-n.y}])add("quadrant",point,`quadrant:${record.id}:${point.x}:${point.y}`)}
        if(record.type==="polyline")for(const vertex of record.vertices)if(!excluded.has(vertex.featureId))add("vertex",vertex,`vertex:${record.id}:${vertex.featureId}`,window.CaderactReferences.createEndpointReference(record.id,vertex.featureId))
        const nearestOnSegment=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((rawPoint.x-a.x)*dx+(rawPoint.y-a.y)*dy)/d)):0;return{x:a.x+t*dx,y:a.y+t*dy}}
        const segments=record.type==="line"?[[record.start,record.end]]:record.type==="polyline"?Array.from({length:record.closed?record.vertices.length:record.vertices.length-1},(_,i)=>[record.vertices[i],record.vertices[(i+1)%record.vertices.length]]):[]
        for(const [a,b] of segments){const point=nearestOnSegment(a,b);add("nearest",point,`nearest:${record.id}:${a.featureId||""}:${b.featureId||""}`);if(referencePoint){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;if(d){const t=((referencePoint.x-a.x)*dx+(referencePoint.y-a.y)*dy)/d,point={x:a.x+t*dx,y:a.y+t*dy};add("perpendicular",point,`perpendicular:${record.id}:${a.featureId||""}`)}}}
        if(record.type==="circle"||record.type==="arc"){const dx=rawPoint.x-record.center.x,dy=rawPoint.y-record.center.y,len=Math.hypot(dx,dy);if(len){let point={x:record.center.x+dx/len*record.radius,y:record.center.y+dy/len*record.radius};const on=record.type!=="arc"||window.CaderactArcGeometry.angleOnSweep(Math.atan2(point.y-record.center.y,point.x-record.center.x),Math.atan2(record.start.y-record.center.y,record.start.x-record.center.x),record.sweep);if(on)add("nearest",point,`nearest:${record.id}`)}if(referencePoint){const rx=referencePoint.x-record.center.x,ry=referencePoint.y-record.center.y,d=Math.hypot(rx,ry);if(d){for(const sign of [1,-1]){const point={x:record.center.x+sign*rx/d*record.radius,y:record.center.y+sign*ry/d*record.radius},angle=Math.atan2(point.y-record.center.y,point.x-record.center.x),on=record.type!=="arc"||window.CaderactArcGeometry.angleOnSweep(angle,Math.atan2(record.start.y-record.center.y,record.start.x-record.center.x),record.sweep);if(on)add("perpendicular",point,`perpendicular:${record.id}:${sign}`)}if(d>=record.radius){const alpha=Math.atan2(ry,rx),delta=Math.acos(Math.min(1,record.radius/d));for(const angle of d===record.radius?[alpha]:[alpha+delta,alpha-delta]){const point={x:record.center.x+Math.cos(angle)*record.radius,y:record.center.y+Math.sin(angle)*record.radius},on=record.type!=="arc"||window.CaderactArcGeometry.angleOnSweep(angle,Math.atan2(record.start.y-record.center.y,record.start.x-record.center.x),record.sweep);if(on)add("tangent",point,`tangent:${record.id}:${angle}`)}}}}}
      }
      if(enabled.intersection!==false&&enabled.object!==false)for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){const outcome=window.CaderactCurveIntersection.intersect(ordered[i],ordered[j]);if(outcome.valid)for(const hit of outcome.hits)if(hit.onA&&hit.onB)add("intersection",hit.point,`intersection:${ordered[i].id}:${ordered[j].id}:${hit.point.x}:${hit.point.y}`)}
      const commandCandidates = Array.from(transientCandidates)
      // Keep the D2 draftPoints input compatible while commands migrate to the
      // generic transient-candidate contract.
      for (let i = 0; i < draftPoints.length; i++) {
        commandCandidates.push({ kind: "draft-point", point: draftPoints[i], stableKey: `draft-point:${i}`,
          reference: Object.freeze({ kind: "draft-point", index: i }) })
      }
      for (let i = 0; i < commandCandidates.length; i++) {
        const candidate = commandCandidates[i]
        if (!candidate || priorities[candidate.kind] === undefined) continue
        add(candidate.kind, candidate.point, candidate.stableKey || `transient:${candidate.kind}:${i}`,
          candidate.reference || null)
      }
      if (Number.isFinite(gridSpacing) && gridSpacing > 0) {
        addContinuousGrid({ x: nearestGridIndex(rawPoint.x / gridSpacing) * gridSpacing,
          y: nearestGridIndex(rawPoint.y / gridSpacing) * gridSpacing })
      }
      const deduplicated=[]
      candidates.sort((a,b)=>priorities[a.kind]-priorities[b.kind]||a.stableKey.localeCompare(b.stableKey))
      const isSemantic=kind=>kind!=="grid"&&kind!=="draft-point"
      for(const candidate of candidates){
        const existing=deduplicated.find(other=>Math.hypot(other.point.x-candidate.point.x,other.point.y-candidate.point.y)<=1e-9)
        if(existing){if(isSemantic(candidate.kind)&&!existing.kinds.includes(candidate.kind)){existing.kinds.push(candidate.kind);existing.kinds.sort((a,b)=>priorities[a]-priorities[b])}if(isSemantic(candidate.kind)&&candidate.reference)existing.references.push(candidate.reference)}
        else deduplicated.push({...candidate,kinds:isSemantic(candidate.kind)?[candidate.kind]:[],references:isSemantic(candidate.kind)&&candidate.reference?[candidate.reference]:[]})
      }
      candidates.length=0;candidates.push(...deduplicated)
      candidates.sort((a, b) => a.distancePx - b.distancePx
        || priorities[a.kind] - priorities[b.kind]
        || a.stableKey.localeCompare(b.stableKey))
      const nearestDistance = candidates[0]?.distancePx
      const nearTieCandidates = candidates.filter(candidate => candidate.distancePx <= nearestDistance + priorityWindowPx)
      nearTieCandidates.sort((a, b) => priorities[a.kind] - priorities[b.kind]
        || a.distancePx - b.distancePx
        || a.stableKey.localeCompare(b.stableKey))
      const winner = nearTieCandidates[0]
      if (!winner) return Object.freeze({ snapped: false, point: rawPoint })
      const objectSnap = candidates.filter(candidate => candidate.kind !== "grid" && candidate.kind !== "draft-point").sort((a,b)=>a.distancePx-b.distancePx||priorities[a.kind]-priorities[b.kind]||a.stableKey.localeCompare(b.stableKey))[0] || null
      return Object.freeze({ snapped: true, kind: winner.kind, kinds:Object.freeze(winner.kinds.slice()), point: winner.point,
        distancePx: winner.distancePx, reference: winner.reference, sourceReference:winner.sourceReference, references:Object.freeze(winner.references.slice()),
        objectSnap: objectSnap && Object.freeze({ kind:objectSnap.kind, kinds:Object.freeze(objectSnap.kinds.slice()), point:objectSnap.point, distancePx:objectSnap.distancePx, reference:objectSnap.reference, sourceReference:objectSnap.sourceReference, references:Object.freeze(objectSnap.references.slice()) }) })
    }
    return Object.freeze({ resolve, tolerancePx, priorityWindowPx })
  }
  window.CaderactSnapResolver = Object.freeze({ createResolver, DEFAULT_TOLERANCE_PX, PRIORITY_WINDOW_PX })
})()
