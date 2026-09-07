// D9: pure three-point axis Ellipse derivation.
(() => {
  const freezePoint = point => Object.freeze({ x: point.x, y: point.y })
  function fromAxisEndpoints(first, second, third) {
    if (![first, second, third].every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))) {
      return Object.freeze({ valid: false, reason: "non-finite-point" })
    }
    const dx = second.x - first.x, dy = second.y - first.y
    const length = Math.hypot(dx, dy)
    if (!(length > 0) || !Number.isFinite(length)) return Object.freeze({ valid: false, reason: "zero-first-axis" })
    const center = freezePoint({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 })
    const majorAxis = freezePoint({ x: dx / 2, y: dy / 2 })
    const minorRadius = Math.abs((third.x - first.x) * dy - (third.y - first.y) * dx) / length
    if (!(minorRadius > 0) || !Number.isFinite(minorRadius) || ![center.x, center.y, majorAxis.x, majorAxis.y].every(Number.isFinite)) {
      return Object.freeze({ valid: false, reason: "zero-second-axis" })
    }
    return Object.freeze({ valid: true, center, majorAxis, minorRadius,
      semiMajorRadius: length / 2, orientation: Math.atan2(dy, dx),
      first: freezePoint(first), second: freezePoint(second), third: freezePoint(third) })
  }
  function pointAt(ellipse, parameter) {
    const axis = ellipse.majorAxis, radius = Math.hypot(axis.x, axis.y)
    if (!(radius > 0)) return freezePoint({ x: NaN, y: NaN })
    const minorX = -axis.y / radius * ellipse.minorRadius
    const minorY = axis.x / radius * ellipse.minorRadius
    return freezePoint({ x: ellipse.center.x + axis.x * Math.cos(parameter) + minorX * Math.sin(parameter),
      y: ellipse.center.y + axis.y * Math.cos(parameter) + minorY * Math.sin(parameter) })
  }
  window.CaderactEllipseGeometry = Object.freeze({ fromAxisEndpoints, pointAt })
})()
