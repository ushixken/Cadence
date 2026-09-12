// P1: pure model-space orthogonal constraint for pointer candidates.
(() => {
  function constrain(point, reference, enabled) {
    if (!enabled || !Number.isFinite(reference?.x) || !Number.isFinite(reference?.y)
      || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return Object.freeze({ x: point.x, y: point.y })
    const dx = point.x - reference.x, dy = point.y - reference.y
    return Object.freeze(Math.abs(dx) >= Math.abs(dy) ? { x: point.x, y: reference.y } : { x: reference.x, y: point.y })
  }
  window.CaderactOrthoConstraint = Object.freeze({ constrain })
})()
