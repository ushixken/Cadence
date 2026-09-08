// M6P2: pure curve parameterization shared by Trim (M6) and later Extend (M7).
// Parameters are curve-native and never depend on screen-space ordering:
//   line    -> t in [0, 1] along the finite segment (unbounded t supported for
//              raw/Extend-style queries; [0,1] is the finite domain).
//   circle  -> angle in [0, TAU) about the center.
//   arc     -> s, the fraction in [0, 1] of the stored sweep from startAngle
//              (s outside [0,1] represents the same underlying circle but off
//              the finite Arc domain; reuses ArcGeometry's angle math so the
//              seam/domain logic stays in one place).
//   ellipse -> angle in [0, TAU), same convention as EllipseGeometry.pointAt.
//   polyline segment -> plain Line parameter t in [0, 1] on that segment.
(() => {
  const TAU = Math.PI * 2
  const EPSILON = 1e-9
  const { normalizeAngle, positiveDelta, angleOnSweep } = window.CaderactArcGeometry

  function pointAt(curve, parameter) {
    switch (curve.kind) {
      case "line": return Object.freeze({ x: curve.start.x + (curve.end.x - curve.start.x) * parameter,
        y: curve.start.y + (curve.end.y - curve.start.y) * parameter })
      case "circle": return Object.freeze({ x: curve.center.x + Math.cos(parameter) * curve.radius,
        y: curve.center.y + Math.sin(parameter) * curve.radius })
      case "arc": return window.CaderactArcGeometry.pointAt(curve, parameter)
      case "ellipse": return window.CaderactEllipseGeometry.pointAt(curve, parameter)
      default: return Object.freeze({ x: NaN, y: NaN })
    }
  }

  // Arc's finite-domain fraction s from a raw circle angle, consistent with
  // ArcGeometry.angleOnSweep's own sweep-direction handling.
  function arcAngleToParameter(curve, angle) {
    return curve.sweep > 0
      ? positiveDelta(curve.startAngle, angle) / curve.sweep
      : -positiveDelta(angle, curve.startAngle) / curve.sweep
  }
  function arcParameterToAngle(curve, s) { return normalizeAngle(curve.startAngle + curve.sweep * s) }

  function isParameterInDomain(curve, parameter, epsilon = EPSILON) {
    if (!Number.isFinite(parameter)) return false
    switch (curve.kind) {
      case "line": return parameter >= -epsilon && parameter <= 1 + epsilon
      case "arc": return parameter >= -epsilon && parameter <= 1 + epsilon
      case "circle": case "ellipse": return true
      default: return false
    }
  }

  // Curve-native ordering: for open curves this is plain numeric order; for
  // closed curves it orders by distance travelled from the arbitrary seam at
  // parameter 0 (matches the seam convention used by TrimIntervals).
  function compareParameters(curve, a, b) {
    if (curve.kind === "circle" || curve.kind === "ellipse") {
      return normalizeAngle(a) - normalizeAngle(b)
    }
    return a - b
  }

  // Nearest curve-native parameter to a MODEL-SPACE point. Always returns a
  // parameter (clamped into the finite domain for open curves) so pick logic
  // never needs to fall back to screen-space hit testing.
  function nearestParameter(curve, point) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return Object.freeze({ valid: false, reason: "non-finite-point" })
    switch (curve.kind) {
      case "line": {
        const dx = curve.end.x - curve.start.x, dy = curve.end.y - curve.start.y
        const lengthSquared = dx * dx + dy * dy
        const raw = ((point.x - curve.start.x) * dx + (point.y - curve.start.y) * dy) / lengthSquared
        const parameter = Math.min(1, Math.max(0, raw))
        return Object.freeze({ valid: true, parameter, point: pointAt(curve, parameter) })
      }
      case "circle": {
        const angle = normalizeAngle(Math.atan2(point.y - curve.center.y, point.x - curve.center.x))
        return Object.freeze({ valid: true, parameter: angle, point: pointAt(curve, angle) })
      }
      case "arc": {
        const angle = normalizeAngle(Math.atan2(point.y - curve.center.y, point.x - curve.center.x))
        const raw = arcAngleToParameter(curve, angle)
        const parameter = angleOnSweep(angle, curve.startAngle, curve.sweep)
          ? raw
          : (Math.min(Math.abs(raw), Math.abs(raw - 1)) === Math.abs(raw) ? 0 : 1)
        return Object.freeze({ valid: true, parameter, point: pointAt(curve, parameter) })
      }
      case "ellipse": {
        // Exact nearest-point-on-ellipse has no closed form; project into the
        // ellipse's own (major, minor) unit basis instead. This is an affine
        // angular pick, not a true Euclidean-nearest projection -- documented
        // limitation, adequate for click/pick purposes.
        const majorRadius = curve.majorRadius
        const majorHat = Object.freeze({ x: curve.majorAxis.x / majorRadius, y: curve.majorAxis.y / majorRadius })
        const minorHat = Object.freeze({ x: -majorHat.y, y: majorHat.x })
        const relative = { x: point.x - curve.center.x, y: point.y - curve.center.y }
        const u = (relative.x * majorHat.x + relative.y * majorHat.y) / majorRadius
        const v = (relative.x * minorHat.x + relative.y * minorHat.y) / curve.minorRadius
        const angle = (u === 0 && v === 0) ? 0 : normalizeAngle(Math.atan2(v, u))
        return Object.freeze({ valid: true, parameter: angle, point: pointAt(curve, angle) })
      }
      default: return Object.freeze({ valid: false, reason: "unsupported-curve-type" })
    }
  }

  // Locates which Polyline segment (and local segment parameter) a global
  // polyline parameter or a clicked point corresponds to. `segments` is the
  // ordered array produced by CurveDescriptor.polylineSegments(...).segments.
  function locatePolylineSegment(segments, point) {
    let best = null
    for (const segment of segments) {
      const local = nearestParameter(segment, point)
      if (!local.valid) continue
      const distance = Math.hypot(local.point.x - point.x, local.point.y - point.y)
      if (!best || distance < best.distance) {
        best = Object.freeze({ segmentIndex: segment.segmentIndex, localParameter: local.parameter, distance, point: local.point })
      }
    }
    return best ?? Object.freeze({ valid: false, reason: "no-segments" })
  }

  window.CaderactCurveParameter = Object.freeze({
    pointAt, nearestParameter, compareParameters, isParameterInDomain,
    arcAngleToParameter, arcParameterToAngle, locatePolylineSegment, EPSILON,
  })
})()
