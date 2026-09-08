// M7: pure Extend RESULT PLANNING layer. Reuses the M6 curve descriptor,
// parameterization, intersection, and classification foundation, but owns only
// Extend-specific endpoint/side selection and replacement planning.
(() => {
  const Descriptor = window.CaderactCurveDescriptor
  const Parameter = window.CaderactCurveParameter
  const Intersection = window.CaderactCurveIntersection
  const Classifier = window.CaderactIntersectionClassifier
  const { TAU } = window.CaderactArcGeometry
  const { PARAMETER_TOLERANCE } = Classifier

  const freezePoint = point => Object.freeze({ x: point.x, y: point.y })
  const near = (a, b, epsilon = PARAMETER_TOLERANCE) => Math.abs(a - b) <= epsilon
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

  function preserveFeatureIntent(featureId) {
    return Object.freeze({ role: "preserve-existing-feature", featureId })
  }

  function noOp(target, reason, extra = {}) {
    return Object.freeze({ status: "no-op", reason, targetRecordId: target?.id ?? null, ...extra })
  }
  function invalidTarget(target, reason) {
    return Object.freeze({ status: "invalid-target", reason, targetRecordId: target?.id ?? null })
  }
  function planned(fields) {
    return Object.freeze({ status: "planned", ...fields })
  }

  function geometrySnapshot(record) {
    if (record?.type === "line") return Object.freeze({ type: "line", start: freezePoint(record.start), end: freezePoint(record.end) })
    if (record?.type === "arc") return Object.freeze({ type: "arc", center: freezePoint(record.center), radius: record.radius, start: freezePoint(record.start), end: freezePoint(record.end), sweep: record.sweep })
    if (record?.type === "polyline") return Object.freeze({ type: "polyline", closed: Boolean(record.closed), vertices: Object.freeze(record.vertices.map(freezePoint)) })
    if (record?.type === "circle") return Object.freeze({ type: "circle", center: freezePoint(record.center), radius: record.radius })
    if (record?.type === "ellipse") return Object.freeze({ type: "ellipse", center: freezePoint(record.center), majorAxis: freezePoint(record.majorAxis), minorRadius: record.minorRadius })
    return null
  }

  function gatherExtendCandidates(targetCurve, cuttingEdges, side, targetRecordId) {
    const candidates = []
    let sawCoincident = false, sawAnyHit = false, sawBoundaryDomainHit = false
    for (const boundaryRecord of cuttingEdges ?? []) {
      if (!boundaryRecord || boundaryRecord.id === targetRecordId) continue
      const atomic = Descriptor.atomicCurves(boundaryRecord)
      if (!atomic.valid) continue
      for (const boundaryCurve of atomic.curves) {
        if (Classifier.isCoincident(targetCurve, boundaryCurve)) { sawCoincident = true; continue }
        const raw = Intersection.intersectAtomic(targetCurve, boundaryCurve)
        if (!raw.valid) continue
        for (const hit of raw.hits) {
          sawAnyHit = true
          if (!hit.onB) continue
          sawBoundaryDomainHit = true
          const parameter = hit.parameterA
          if (!Number.isFinite(parameter)) continue
          if (side === "start" && parameter < -PARAMETER_TOLERANCE) {
            candidates.push(Object.freeze({ parameter, point: freezePoint(hit.point), distance: Math.abs(parameter), boundaryRecordId: boundaryRecord.id }))
          } else if (side === "end" && parameter > 1 + PARAMETER_TOLERANCE) {
            candidates.push(Object.freeze({ parameter, point: freezePoint(hit.point), distance: Math.abs(parameter - 1), boundaryRecordId: boundaryRecord.id }))
          } else if ((side === "start" && near(parameter, 0)) || (side === "end" && near(parameter, 1))) {
            candidates.push(Object.freeze({ parameter, point: freezePoint(hit.point), distance: 0, alreadyOnBoundary: true, boundaryRecordId: boundaryRecord.id }))
          }
        }
      }
    }
    if (candidates.length) {
      const sorted = candidates.slice().sort((a, b) =>
        (a.alreadyOnBoundary === b.alreadyOnBoundary ? 0 : a.alreadyOnBoundary ? -1 : 1) ||
        a.distance - b.distance ||
        String(a.boundaryRecordId).localeCompare(String(b.boundaryRecordId)) ||
        a.parameter - b.parameter)
      return Object.freeze({ candidates: Object.freeze(sorted), sawCoincident, sawAnyHit, sawBoundaryDomainHit })
    }
    return Object.freeze({ candidates: Object.freeze([]), sawCoincident, sawAnyHit, sawBoundaryDomainHit })
  }

  function extendNoHitReason(gathered) {
    if (gathered.sawCoincident) return "coincident-overlap"
    if (gathered.sawAnyHit && !gathered.sawBoundaryDomainHit) return "boundary-hit-outside-domain"
    return "no-valid-extension"
  }

  function planExtendLineTarget(target, curve, cuttingEdges, pickPoint) {
    const startDistance = distance(pickPoint, target.start), endDistance = distance(pickPoint, target.end)
    const side = startDistance <= endDistance ? "start" : "end"
    const gathered = gatherExtendCandidates(curve, cuttingEdges, side, target.id)
    if (!gathered.candidates.length) return noOp(target, extendNoHitReason(gathered), { side })
    const chosen = gathered.candidates[0]
    if (chosen.alreadyOnBoundary) return noOp(target, "endpoint-already-on-boundary", { side, boundaryRecordId: chosen.boundaryRecordId })
    const start = side === "start" ? chosen.point : freezePoint(target.start)
    const end = side === "end" ? chosen.point : freezePoint(target.end)
    if (distance(start, end) <= PARAMETER_TOLERANCE) return noOp(target, "zero-length-result", { side })
    return planned({
      kind: "extend",
      targetRecordId: target.id,
      targetType: "line",
      side,
      sourceGeometry: geometrySnapshot(target),
      boundaryRecordId: chosen.boundaryRecordId,
      intersectionParameter: chosen.parameter,
      replacement: Object.freeze({
        geometry: Object.freeze({ type: "line", start, end }),
        preserveRecordId: true,
        featureIdentityIntent: Object.freeze({
          start: preserveFeatureIntent(target.start.featureId),
          end: preserveFeatureIntent(target.end.featureId),
        }),
      }),
    })
  }

  function buildExtendedArcGeometry(target, curve, side, chosen) {
    const startParameter = side === "start" ? chosen.parameter : 0
    const endParameter = side === "end" ? chosen.parameter : 1
    const sweep = curve.sweep * (endParameter - startParameter)
    if (!Number.isFinite(sweep) || sweep === 0 || Math.abs(sweep) >= TAU - PARAMETER_TOLERANCE) return null
    return Object.freeze({
      type: "arc",
      center: curve.center,
      radius: curve.radius,
      start: freezePoint(Parameter.pointAt(curve, startParameter)),
      end: freezePoint(Parameter.pointAt(curve, endParameter)),
      sweep,
    })
  }

  function planExtendArcTarget(target, curve, cuttingEdges, pickPoint) {
    const startDistance = distance(pickPoint, target.start), endDistance = distance(pickPoint, target.end)
    const side = startDistance <= endDistance ? "start" : "end"
    const gathered = gatherExtendCandidates(curve, cuttingEdges, side, target.id)
    if (!gathered.candidates.length) return noOp(target, extendNoHitReason(gathered), { side })
    const chosen = gathered.candidates[0]
    if (chosen.alreadyOnBoundary) return noOp(target, "endpoint-already-on-boundary", { side, boundaryRecordId: chosen.boundaryRecordId })
    const geometry = buildExtendedArcGeometry(target, curve, side, chosen)
    if (!geometry) return noOp(target, "invalid-arc-result", { side })
    return planned({
      kind: "extend",
      targetRecordId: target.id,
      targetType: "arc",
      side,
      sourceGeometry: geometrySnapshot(target),
      boundaryRecordId: chosen.boundaryRecordId,
      intersectionParameter: chosen.parameter,
      replacement: Object.freeze({
        geometry,
        preserveRecordId: true,
        featureIdentityIntent: Object.freeze({
          start: preserveFeatureIntent(target.start.featureId),
          end: preserveFeatureIntent(target.end.featureId),
        }),
      }),
    })
  }

  function planExtendPolylineTarget(target, cuttingEdges, pickPoint) {
    if (!Array.isArray(target.vertices)) return invalidTarget(target, "invalid-polyline-vertices")
    if (target.closed) return noOp(target, "closed-polyline-not-extendable")
    const described = Descriptor.polylineSegments(target.vertices, false)
    if (!described.valid) return invalidTarget(target, described.reason)
    const startDistance = distance(pickPoint, target.vertices[0])
    const endDistance = distance(pickPoint, target.vertices[target.vertices.length - 1])
    const side = startDistance <= endDistance ? "start" : "end"
    const segmentIndex = side === "start" ? 0 : described.segments.length - 1
    const segmentCurve = described.segments[segmentIndex]
    const extensionCurve = side === "start"
      ? segmentCurve
      : Object.freeze({ valid: true, kind: "line", start: segmentCurve.start, end: segmentCurve.end })
    const gathered = gatherExtendCandidates(extensionCurve, cuttingEdges, side, target.id)
    if (!gathered.candidates.length) return noOp(target, extendNoHitReason(gathered), { side, affectedSegmentIndex: segmentIndex })
    const chosen = gathered.candidates[0]
    if (chosen.alreadyOnBoundary) return noOp(target, "endpoint-already-on-boundary", { side, affectedSegmentIndex: segmentIndex, boundaryRecordId: chosen.boundaryRecordId })
    const vertices = target.vertices.map(vertex => freezePoint(vertex))
    const endpointIndex = side === "start" ? 0 : vertices.length - 1
    vertices[endpointIndex] = chosen.point
    const intents = target.vertices.map(vertex => preserveFeatureIntent(vertex.featureId))
    return planned({
      kind: "extend",
      targetRecordId: target.id,
      targetType: "polyline",
      side,
      affectedSegmentIndex: segmentIndex,
      sourceGeometry: geometrySnapshot(target),
      boundaryRecordId: chosen.boundaryRecordId,
      intersectionParameter: chosen.parameter,
      replacement: Object.freeze({
        geometry: Object.freeze({ type: "polyline", vertices: Object.freeze(vertices), closed: false }),
        preserveRecordId: true,
        featureIdentityIntent: Object.freeze({ vertices: Object.freeze(intents) }),
      }),
    })
  }

  function planExtend({ target, cuttingEdges, pickPoint } = {}) {
    if (!target || typeof target !== "object") return invalidTarget(target, "missing-target")
    if (!Array.isArray(cuttingEdges) || cuttingEdges.length === 0) return noOp(target, "no-boundaries")
    if (!Number.isFinite(pickPoint?.x) || !Number.isFinite(pickPoint?.y)) return invalidTarget(target, "non-finite-pick-point")
    const described = Descriptor.describe(target)
    if (!described.valid) return invalidTarget(target, described.reason)
    switch (described.kind) {
      case "line": return planExtendLineTarget(target, described, cuttingEdges, pickPoint)
      case "arc": return planExtendArcTarget(target, described, cuttingEdges, pickPoint)
      case "polyline": return planExtendPolylineTarget(target, cuttingEdges, pickPoint)
      case "circle":
      case "ellipse":
        return noOp(target, "closed-curve-not-extendable")
      default: return invalidTarget(target, "unsupported-curve-type")
    }
  }

  window.CaderactExtendPlanner = Object.freeze({ planExtend })
})()
