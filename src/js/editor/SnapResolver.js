// D2: pure pointer snap candidate collection and deterministic resolution.
(() => {
  const DEFAULT_TOLERANCE_PX = 10
  const PRIORITY_WINDOW_PX = 0.75
  const priorities = Object.freeze({ endpoint: 0, "draft-point": 1, midpoint: 2, grid: 3 })
  const freezePoint = point => Object.freeze({ x: point.x, y: point.y })

  function createResolver({ tolerancePx = DEFAULT_TOLERANCE_PX, priorityWindowPx = PRIORITY_WINDOW_PX } = {}) {
    function resolve({ rawWorldPoint, worldToScreen, records = [], draftPoints = [], gridSpacing, enabled = {}, excludedFeatureIds = [] }) {
      const rawPoint = freezePoint(rawWorldPoint)
      if (!Number.isFinite(rawPoint.x) || !Number.isFinite(rawPoint.y) || typeof worldToScreen !== "function") {
        return Object.freeze({ snapped: false, point: rawPoint })
      }
      const rawScreen = worldToScreen(rawPoint.x, rawPoint.y)
      if (!Number.isFinite(rawScreen.x) || !Number.isFinite(rawScreen.y)) return Object.freeze({ snapped: false, point: rawPoint })
      const candidates = []
      const excluded = new Set(excludedFeatureIds)
      function add(kind, point, stableKey, reference = null) {
        if (enabled[kind] === false || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return
        const screen = worldToScreen(point.x, point.y)
        if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return
        const distancePx = Math.hypot(screen.x - rawScreen.x, screen.y - rawScreen.y)
        if (!Number.isFinite(distancePx) || distancePx > tolerancePx) return
        candidates.push({ kind, point: freezePoint(point), distancePx, stableKey, reference })
      }
      const ordered = Array.from(records).filter(record => record?.type === "line").sort((a, b) => a.id.localeCompare(b.id))
      for (const record of ordered) {
        for (const endpoint of [record.start, record.end].sort((a, b) => a.featureId.localeCompare(b.featureId))) {
          if (excluded.has(endpoint.featureId)) continue
          add("endpoint", endpoint, `endpoint:${record.id}:${endpoint.featureId}`,
            window.CaderactReferences.createEndpointReference(record.id, endpoint.featureId))
        }
        const midpoint = { x: record.start.x + (record.end.x - record.start.x) / 2,
          y: record.start.y + (record.end.y - record.start.y) / 2 }
        add("midpoint", midpoint, `midpoint:${record.id}`)
      }
      for (let i = 0; i < draftPoints.length; i++) {
        const dp = draftPoints[i]
        if (!dp || !Number.isFinite(dp.x) || !Number.isFinite(dp.y)) continue
        add("draft-point", dp, `draft-point:${i}`, Object.freeze({ kind: "draft-point", index: i }))
      }
      if (Number.isFinite(gridSpacing) && gridSpacing > 0) {
        add("grid", { x: Math.round(rawPoint.x / gridSpacing) * gridSpacing,
          y: Math.round(rawPoint.y / gridSpacing) * gridSpacing }, "grid")
      }
      candidates.sort((a, b) => {
        const distanceDifference = a.distancePx - b.distancePx
        if (Math.abs(distanceDifference) > priorityWindowPx) return distanceDifference
        return priorities[a.kind] - priorities[b.kind] || distanceDifference || a.stableKey.localeCompare(b.stableKey)
      })
      const winner = candidates[0]
      if (!winner) return Object.freeze({ snapped: false, point: rawPoint })
      return Object.freeze({ snapped: true, kind: winner.kind, point: winner.point,
        distancePx: winner.distancePx, reference: winner.reference })
    }
    return Object.freeze({ resolve, tolerancePx, priorityWindowPx })
  }
  window.CaderactSnapResolver = Object.freeze({ createResolver, DEFAULT_TOLERANCE_PX, PRIORITY_WINDOW_PX })
})()
