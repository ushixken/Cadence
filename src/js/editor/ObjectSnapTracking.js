// P4A: pure, ephemeral one-point object-snap tracking. Viewport integration
// deliberately lives elsewhere so this controller has no DOM/document/session
// dependency.
(() => {
  const ELIGIBLE = new Set(["endpoint", "vertex", "midpoint", "center", "quadrant", "intersection"])
  const point = value => Object.freeze({ x: value.x, y: value.y })
  const stableReference = reference => reference ? JSON.stringify(reference) : ""
  function create({ dwellMs = 500, guideTolerancePx = 8, setTimer = setTimeout, clearTimer = clearTimeout, onChange = () => {} } = {}) {
    let hover = null, timer = null, acquired = null, guide = null, candidate = null
    const emit = () => { const value = state(); onChange(value); return value }
    const clearPending = () => { if (timer !== null) clearTimer(timer); timer = null; hover = null }
    const state = () => Object.freeze({ hovered: hover && Object.freeze({ kind:hover.kind, point:hover.point, reference:hover.reference }), acquired: acquired && Object.freeze({ kind:acquired.kind, point:acquired.point, reference:acquired.reference }), guide, candidate })
    function observeSnap(result) {
      const valid = result?.snapped && ELIGIBLE.has(result.kind) && Number.isFinite(result.point?.x) && Number.isFinite(result.point?.y)
      if (!valid) { clearPending(); return emit() }
      const next = { kind:result.kind, point:point(result.point), reference:result.reference || null }
      const key = `${next.kind}:${next.point.x}:${next.point.y}:${stableReference(next.reference)}`
      if (hover?.key === key || acquired?.key === key) return state()
      clearPending(); hover = { ...next, key }
      timer = setTimer(() => { if (!hover || hover.key !== key) return; acquired = hover; hover = null; timer = null; emit() }, dwellMs)
      return emit()
    }
    function clearHover() { clearPending(); guide = null; candidate = null; return emit() }
    function clear() { clearPending(); acquired = null; guide = null; candidate = null; return emit() }
    function project(pointerWorld, worldToScreen) {
      guide = null; candidate = null
      if (!acquired || !Number.isFinite(pointerWorld?.x) || !Number.isFinite(pointerWorld?.y) || typeof worldToScreen !== "function") return emit()
      const a = worldToScreen(acquired.point.x, acquired.point.y), p = worldToScreen(pointerWorld.x, pointerWorld.y)
      if (![a?.x,a?.y,p?.x,p?.y].every(Number.isFinite)) return emit()
      const horizontal = Math.abs(p.y-a.y), vertical = Math.abs(p.x-a.x)
      if (horizontal > guideTolerancePx && vertical > guideTolerancePx) return emit()
      if (horizontal <= vertical) { guide = "horizontal"; candidate = point({ x:pointerWorld.x, y:acquired.point.y }) }
      else { guide = "vertical"; candidate = point({ x:acquired.point.x, y:pointerWorld.y }) }
      return emit()
    }
    return Object.freeze({ observeSnap, clearHover, clear, project, getState:state, dwellMs, guideTolerancePx })
  }
  window.CaderactObjectSnapTracking = Object.freeze({ create, ELIGIBLE })
})()
