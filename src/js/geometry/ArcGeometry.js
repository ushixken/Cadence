// D7: pure, renderer-neutral three-point Arc derivation and angular predicates.
(() => {
  const TAU = Math.PI * 2
  const COLLINEAR_RELATIVE_TOLERANCE = 1e-12
  const freezePoint = point => Object.freeze({ x: point.x, y: point.y })
  function normalizeAngle(angle) {
    const normalized = angle % TAU
    return normalized < 0 ? normalized + TAU : normalized
  }
  function positiveDelta(from, to) { return normalizeAngle(to - from) }
  function angleOnSweep(angle, startAngle, sweep, epsilon = 1e-12) {
    if (![angle, startAngle, sweep].every(Number.isFinite) || sweep === 0 || Math.abs(sweep) >= TAU) return false
    return sweep > 0
      ? positiveDelta(startAngle, angle) <= sweep + epsilon
      : positiveDelta(angle, startAngle) <= -sweep + epsilon
  }
  function pointAt(arc, parameter) {
    const angle = arc.startAngle + arc.sweep * parameter
    return freezePoint({ x: arc.center.x + Math.cos(angle) * arc.radius,
      y: arc.center.y + Math.sin(angle) * arc.radius })
  }
  function fromThreePoints(first, second, third) {
    if (![first, second, third].every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))) {
      return Object.freeze({ valid: false, reason: "non-finite-point" })
    }
    const ax = first.x, ay = first.y, bx = second.x, by = second.y, cx = third.x, cy = third.y
    const abx = bx-ax, aby = by-ay, acx = cx-ax, acy = cy-ay
    const cross = abx*acy-aby*acx
    const scaleSquared = Math.max(abx*abx+aby*aby, acx*acx+acy*acy,
      (cx-bx)*(cx-bx)+(cy-by)*(cy-by))
    if (!(scaleSquared > 0) || Math.abs(cross) <= COLLINEAR_RELATIVE_TOLERANCE * scaleSquared) {
      return Object.freeze({ valid: false, reason: "collinear-points" })
    }
    const denominator = 2 * cross
    const abSquared = abx*abx+aby*aby, acSquared = acx*acx+acy*acy
    const center = freezePoint({ x: ax + (acy*abSquared-aby*acSquared)/denominator,
      y: ay + (abx*acSquared-acx*abSquared)/denominator })
    const radius = Math.hypot(ax-center.x, ay-center.y)
    const startAngle = normalizeAngle(Math.atan2(ay-center.y, ax-center.x))
    const middleAngle = normalizeAngle(Math.atan2(by-center.y, bx-center.x))
    const endAngle = normalizeAngle(Math.atan2(cy-center.y, cx-center.x))
    const counterClockwiseSweep = positiveDelta(startAngle, endAngle)
    const sweep = positiveDelta(startAngle, middleAngle) <= counterClockwiseSweep
      ? counterClockwiseSweep : -(TAU-counterClockwiseSweep)
    if (![center.x, center.y, radius, startAngle, sweep].every(Number.isFinite)
        || radius <= 0 || sweep === 0 || Math.abs(sweep) >= TAU) {
      return Object.freeze({ valid: false, reason: "unstable-geometry" })
    }
    return Object.freeze({ valid: true, center, radius, startAngle, sweep,
      start: freezePoint(first), middle: freezePoint(second), end: freezePoint(third) })
  }
  window.CaderactArcGeometry = Object.freeze({ fromThreePoints, pointAt, angleOnSweep, normalizeAngle,
    positiveDelta, TAU, COLLINEAR_RELATIVE_TOLERANCE })
})()
