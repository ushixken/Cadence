// M6P2: reusable tolerance strategy + classification for raw intersection
// hits from CurveIntersection, so Trim (and later Extend) can distinguish
// usable cut parameters from duplicate/tangent/coincident/non-actionable
// ones without re-deriving tolerance logic per curve pair.
//
// Tolerance strategy mirrors existing project conventions: a small absolute
// LINEAR tolerance for model-space distances (matching the 1e-9-scaled
// on-radius checks in CaderactDocument's Arc validation), a matching
// PARAMETER tolerance for curve-native parameters, and an angular tolerance
// for tangency (matching ArcGeometry's 1e-12-class relative epsilons, scaled
// up slightly since tangency compares two independently-derived directions).
(() => {
  const LINEAR_TOLERANCE = 1e-9
  const PARAMETER_TOLERANCE = 1e-7
  const TANGENT_SIN_TOLERANCE = 1e-9
  const NEAR_TANGENT_SIN_TOLERANCE = 1e-4

  const finitePoint = p => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  const scaledLinearTolerance = magnitude => LINEAR_TOLERANCE * Math.max(1, Math.abs(magnitude))

  function unitTangent(curve, parameter) {
    switch (curve.kind) {
      case "line": {
        const dx = curve.end.x - curve.start.x, dy = curve.end.y - curve.start.y, length = Math.hypot(dx, dy)
        return length > 0 ? { x: dx / length, y: dy / length } : null
      }
      case "circle": return { x: -Math.sin(parameter), y: Math.cos(parameter) }
      case "arc": {
        const angle = window.CaderactCurveParameter.arcParameterToAngle(curve, parameter)
        const sign = Math.sign(curve.sweep) || 1
        return { x: -Math.sin(angle) * sign, y: Math.cos(angle) * sign }
      }
      case "ellipse": {
        const dx = -curve.majorAxis.x * Math.sin(parameter) + (-curve.majorAxis.y / curve.majorRadius * curve.minorRadius) * Math.cos(parameter)
        const dy = -curve.majorAxis.y * Math.sin(parameter) + (curve.majorAxis.x / curve.majorRadius * curve.minorRadius) * Math.cos(parameter)
        const length = Math.hypot(dx, dy)
        return length > 0 ? { x: dx / length, y: dy / length } : null
      }
      default: return null
    }
  }

  // Signed sine of the angle between two curves' tangents at a shared point;
  // ~0 means the tangents are parallel (a tangency), regardless of curve type.
  function tangentCross(curveA, curveB, parameterA, parameterB) {
    const tangentA = unitTangent(curveA, parameterA), tangentB = unitTangent(curveB, parameterB)
    if (!tangentA || !tangentB) return null
    return tangentA.x * tangentB.y - tangentA.y * tangentB.x
  }

  function endpointsOf(curve) {
    if (curve.kind === "line") return [curve.start, curve.end]
    if (curve.kind === "arc") return [window.CaderactCurveParameter.pointAt(curve, 0), window.CaderactCurveParameter.pointAt(curve, 1)]
    return []
  }
  function isAtEndpoint(curve, worldPoint) {
    return endpointsOf(curve).some(endpoint => Math.hypot(endpoint.x - worldPoint.x, endpoint.y - worldPoint.y) <= scaledLinearTolerance(endpoint.x))
  }

  // Classifies one normalized hit (from CurveIntersection.intersect/intersectAtomic).
  // Rejects non-finite results outright rather than letting NaN/Infinity leak
  // into Trim interval math.
  function classifyHit(curveA, curveB, hit) {
    if (!finitePoint(hit?.point) || !Number.isFinite(hit.parameterA) || !Number.isFinite(hit.parameterB)) {
      return Object.freeze({ valid: false, reason: "non-finite-result" })
    }
    const cross = tangentCross(curveA, curveB, hit.parameterA, hit.parameterB)
    const tangent = cross !== null && Math.abs(cross) <= TANGENT_SIN_TOLERANCE
    const nearTangent = !tangent && cross !== null && Math.abs(cross) <= NEAR_TANGENT_SIN_TOLERANCE
    return Object.freeze({
      valid: true, point: hit.point, parameterA: hit.parameterA, parameterB: hit.parameterB,
      onA: Boolean(hit.onA), onB: Boolean(hit.onB), actionable: Boolean(hit.onA && hit.onB),
      tangent, nearTangent,
      sharedEndpointA: isAtEndpoint(curveA, hit.point), sharedEndpointB: isAtEndpoint(curveB, hit.point),
    })
  }

  // Classifies a full raw hit list, dropping invalid/non-finite entries and
  // collapsing duplicate results (the same physical point reported more than
  // once -- e.g. a tangency solved as two near-identical roots) into one
  // classified entry so Trim never manufactures a zero-length interval from a
  // duplicate cut.
  function classify(curveA, curveB, hits) {
    const classified = []
    for (const hit of hits) {
      const result = classifyHit(curveA, curveB, hit)
      if (!result.valid) continue
      const duplicate = classified.find(existing => Math.hypot(existing.point.x - result.point.x, existing.point.y - result.point.y) <= scaledLinearTolerance(result.point.x))
      if (duplicate) continue
      classified.push(result)
    }
    return Object.freeze(classified)
  }

  // Coincident/overlapping geometry detection: two curves that share
  // infinitely many points rather than a discrete set (identical infinite
  // line, identical circle, identical ellipse). CurveIntersection reports
  // "degenerate" for the concentric/parallel case; this adds the point-level
  // check needed to tell "coincident" apart from "parallel and distinct".
  function isCoincidentLineLine(a, b) {
    const dx1 = a.end.x - a.start.x, dy1 = a.end.y - a.start.y
    const dx2 = b.end.x - b.start.x, dy2 = b.end.y - b.start.y
    const cross = dx1 * dy2 - dy1 * dx2
    if (Math.abs(cross) > TANGENT_SIN_TOLERANCE * Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2)) return false
    const px = b.start.x - a.start.x, py = b.start.y - a.start.y
    const throughCross = dx1 * py - dy1 * px
    return Math.abs(throughCross) <= scaledLinearTolerance(Math.hypot(dx1, dy1))
  }
  function isCoincidentCircleLike(a, b) {
    return Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) <= scaledLinearTolerance(a.radius)
      && Math.abs(a.radius - b.radius) <= scaledLinearTolerance(a.radius)
  }
  function isCoincident(curveA, curveB) {
    if (curveA.kind === "line" && curveB.kind === "line") return isCoincidentLineLine(curveA, curveB)
    const circleKinds = new Set(["circle", "arc"])
    if (circleKinds.has(curveA.kind) && circleKinds.has(curveB.kind)) {
      return isCoincidentCircleLike({ center: curveA.center, radius: curveA.radius }, { center: curveB.center, radius: curveB.radius })
    }
    if (curveA.kind === "ellipse" && curveB.kind === "ellipse") {
      return Math.hypot(curveA.center.x - curveB.center.x, curveA.center.y - curveB.center.y) <= scaledLinearTolerance(curveA.majorRadius)
        && Math.abs(curveA.majorRadius - curveB.majorRadius) <= scaledLinearTolerance(curveA.majorRadius)
        && Math.abs(curveA.minorRadius - curveB.minorRadius) <= scaledLinearTolerance(curveA.minorRadius)
    }
    return false
  }

  window.CaderactIntersectionClassifier = Object.freeze({
    classify, classifyHit, isCoincident, unitTangent,
    LINEAR_TOLERANCE, PARAMETER_TOLERANCE, TANGENT_SIN_TOLERANCE, NEAR_TANGENT_SIN_TOLERANCE, scaledLinearTolerance,
  })
})()
