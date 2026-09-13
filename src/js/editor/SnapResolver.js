// D2: pure pointer snap candidate collection and deterministic resolution.
(() => {
  const DEFAULT_TOLERANCE_PX = 10
  const PRIORITY_WINDOW_PX = 0.75
  const priorities = Object.freeze({ endpoint: 0, "draft-point": 1, midpoint: 2, grid: 3 })
  const freezePoint = point => Object.freeze({ x: point.x, y: point.y })
  // Exact half-cells resolve to the greater lattice index (toward +infinity).
  const nearestGridIndex = value => Math.floor(value + 0.5)

  function createResolver({ tolerancePx = DEFAULT_TOLERANCE_PX, priorityWindowPx = PRIORITY_WINDOW_PX } = {}) {
    function resolve({ rawWorldPoint, worldToScreen, records = [], transientCandidates = [], draftPoints = [], gridSpacing, enabled = {}, excludedFeatureIds = [], excludedRecordIds = [] }) {
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
        if (enabled[kind] === false || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return
        const screen = worldToScreen(point.x, point.y)
        if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return
        const distancePx = Math.hypot(screen.x - rawScreen.x, screen.y - rawScreen.y)
        if (!Number.isFinite(distancePx) || distancePx > tolerancePx) return
        candidates.push({ kind, point: freezePoint(point), distancePx, stableKey, reference })
      }
      function addContinuousGrid(point) {
        if (enabled.grid === false || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return
        const screen = worldToScreen(point.x, point.y)
        if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return
        const distancePx = Math.hypot(screen.x - rawScreen.x, screen.y - rawScreen.y)
        if (!Number.isFinite(distancePx)) return
        candidates.push({ kind: "grid", point: freezePoint(point), distancePx, stableKey: "grid", reference: null })
      }
      const ordered = Array.from(records).filter(record => !excludedRecords.has(record?.id) && (record?.type === "line" || record?.type === "arc" || record?.type === "polyline")).sort((a, b) => a.id.localeCompare(b.id))
      for (const record of ordered) {
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
        }
      }
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
      return Object.freeze({ snapped: true, kind: winner.kind, point: winner.point,
        distancePx: winner.distancePx, reference: winner.reference })
    }
    return Object.freeze({ resolve, tolerancePx, priorityWindowPx })
  }
  window.CaderactSnapResolver = Object.freeze({ createResolver, DEFAULT_TOLERANCE_PX, PRIORITY_WINDOW_PX })
})()
