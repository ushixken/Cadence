// M6P3: pure Trim RESULT PLANNING layer sitting between the Phase 2 geometry
// engine (CurveDescriptor/CurveParameter/CurveIntersection/IntersectionClassifier/
// TrimIntervals) and the later transaction-publication phase. Consumes
// committed record-shaped geometry, a target record, a model-space pick point,
// and cutting-edge records; produces a deterministic plain-data TRIM PLAN (or
// an explicit no-op/unsupported result) WITHOUT mutating any document, WITHOUT
// allocating persistent IDs, and WITHOUT any Viewport/DOM/Canvas2D/WebGPU/
// CommandRouter/renderer/SnapResolver/SelectionManager/DocumentController
// dependency of any kind.
(() => {
  const Descriptor = window.CaderactCurveDescriptor
  const Parameter = window.CaderactCurveParameter
  const Intersection = window.CaderactCurveIntersection
  const Classifier = window.CaderactIntersectionClassifier
  const Intervals = window.CaderactTrimIntervals
  const { normalizeAngle, TAU } = window.CaderactArcGeometry
  const { PARAMETER_TOLERANCE } = Classifier

  const freezePoint = point => Object.freeze({ x: point.x, y: point.y })
  const near = (a, b, epsilon = PARAMETER_TOLERANCE) => Math.abs(a - b) <= epsilon
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

  // --- identity intent markers -------------------------------------------
  // Explicit semantic markers -- never fabricated ID strings -- describing
  // what the later publication phase must do for a given endpoint/vertex.
  function preserveFeatureIntent(featureId) {
    return Object.freeze({ role: "preserve-existing-feature", featureId })
  }
  function allocateFeatureIntent() {
    return Object.freeze({ role: "allocate-new-feature" })
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

  // --- shared intersection gathering --------------------------------------
  // Intersects one ATOMIC target curve against every cutting-edge record
  // (each of which may itself decompose into several atomic curves, e.g. a
  // Polyline cutting edge). Returns only actionable, non-tangent target
  // parameters -- the discrete cut points Trim is allowed to act on -- plus
  // enough signal to distinguish *why* zero cuts were found.
  function gatherCutParameters(targetCurve, cuttingEdges) {
    const parameters = []
    let sawAnyHit = false
    let sawNonTangentHit = false
    let sawCoincident = false
    for (const cuttingRecord of cuttingEdges ?? []) {
      const atomic = Descriptor.atomicCurves(cuttingRecord)
      if (!atomic.valid) continue
      for (const cuttingCurve of atomic.curves) {
        if (Classifier.isCoincident(targetCurve, cuttingCurve)) { sawCoincident = true; continue }
        const raw = Intersection.intersectAtomic(targetCurve, cuttingCurve)
        if (!raw.valid) continue
        for (const classifiedHit of Classifier.classify(targetCurve, cuttingCurve, raw.hits)) {
          if (!classifiedHit.actionable) continue
          sawAnyHit = true
          if (classifiedHit.tangent) continue
          sawNonTangentHit = true
          parameters.push(classifiedHit.parameterA)
        }
      }
    }
    return { parameters, sawAnyHit, sawNonTangentHit, sawCoincident }
  }

  // --- Extend planning ----------------------------------------------------
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

  // Maps the "no usable cut parameters" case onto the most specific no-op
  // reason the gathered signal supports, per the M6 v1 no-op conditions.
  function noCutReason({ sawAnyHit, sawNonTangentHit, sawCoincident }) {
    if (sawCoincident) return "coincident-overlap"
    if (sawAnyHit && !sawNonTangentHit) return "tangent-only"
    return "no-intersection"
  }

  // --- open-curve (Line / Arc) survivor construction ----------------------
  function openEndpointIntent(target, interval) {
    const startIntent = near(interval.start, 0) ? preserveFeatureIntent(target.start?.featureId) : allocateFeatureIntent()
    const endIntent = near(interval.end, 1) ? preserveFeatureIntent(target.end?.featureId) : allocateFeatureIntent()
    return Object.freeze({ start: startIntent, end: endIntent })
  }

  function buildLineSurvivor(target, curve, interval) {
    const start = freezePoint(Parameter.pointAt(curve, interval.start))
    const end = freezePoint(Parameter.pointAt(curve, interval.end))
    return Object.freeze({
      interval,
      geometry: Object.freeze({ type: "line", start, end }),
      featureIdentityIntent: openEndpointIntent(target, interval),
    })
  }

  function buildArcSurvivor(target, curve, interval) {
    const start = freezePoint(Parameter.pointAt(curve, interval.start))
    const end = freezePoint(Parameter.pointAt(curve, interval.end))
    const sweep = curve.sweep * (interval.end - interval.start)
    return Object.freeze({
      interval,
      geometry: Object.freeze({ type: "arc", center: curve.center, radius: curve.radius, start, end, sweep }),
      featureIdentityIntent: openEndpointIntent(target, interval),
    })
  }

  // Assigns exactly one survivor as the "replacement" (preserves the
  // original record ID) per the deterministic ORIGINAL RECORD ID POLICY: the
  // survivor containing the original curve's topological start (parameter 0)
  // wins; if that survivor was the one removed, the remaining survivor
  // inherits the original ID instead. Never chosen by fragment length.
  function assignReplacement(survivors) {
    let replacementIndex = survivors.findIndex(survivor => near(survivor.interval.start, 0))
    if (replacementIndex === -1) replacementIndex = 0
    const replacement = survivors[replacementIndex]
    const creates = survivors.filter((_, index) => index !== replacementIndex)
    return { replacement, creates }
  }

  function planOpenAtomicTarget(target, curve, cuttingEdges, pickPoint, buildSurvivor) {
    const gathered = gatherCutParameters(curve, cuttingEdges)
    if (gathered.parameters.length === 0) return noOp(target, noCutReason(gathered))

    const sortedUnique = Intervals.sortedUniqueParameters(curve, gathered.parameters)
    if (sortedUnique.length === 0) return noOp(target, "no-intersection")

    const clicked = Parameter.nearestParameter(curve, pickPoint)
    if (!clicked.valid) return noOp(target, "unresolvable-pick")

    const allIntervals = Intervals.buildIntervals(curve, sortedUnique)
    if (allIntervals.length === 0) return noOp(target, "no-intersection")

    const containingIndex = Intervals.findContainingInterval(curve, allIntervals, clicked.parameter)
    if (containingIndex === -1) return noOp(target, "ambiguous-pick")

    const survivorIntervals = Intervals.survivingIntervals(allIntervals, containingIndex)
      .filter(interval => interval.end - interval.start > PARAMETER_TOLERANCE)
    if (survivorIntervals.length === 0) return noOp(target, "zero-length-result")

    const survivors = survivorIntervals.map(interval => buildSurvivor(target, curve, interval))
    const { replacement, creates } = assignReplacement(survivors)

    return planned({
      targetRecordId: target.id,
      targetType: target.type,
      intersectionParameters: sortedUnique,
      removedInterval: allIntervals[containingIndex],
      replacement: Object.freeze({ geometry: replacement.geometry, preserveRecordId: true, featureIdentityIntent: replacement.featureIdentityIntent }),
      creates: Object.freeze(creates.map(survivor => Object.freeze({ geometry: survivor.geometry, featureIdentityIntent: survivor.featureIdentityIntent }))),
    })
  }

  // --- closed-curve (Circle / Ellipse) survivor construction --------------
  // A closed curve's cut parameters always partition it into intervals whose
  // complement (after removing exactly the clicked interval) is a SINGLE
  // connected arc -- there is never more than one closed-curve survivor.
  function planClosedAtomicTarget(target, curve, cuttingEdges, pickPoint) {
    const gathered = gatherCutParameters(curve, cuttingEdges)
    if (gathered.parameters.length === 0) return noOp(target, noCutReason(gathered))

    const sortedUnique = Intervals.sortedUniqueParameters(curve, gathered.parameters)
    if (sortedUnique.length < 2) return noOp(target, "insufficient-intersections")

    const clicked = Parameter.nearestParameter(curve, pickPoint)
    if (!clicked.valid) return noOp(target, "unresolvable-pick")

    const allIntervals = Intervals.buildIntervals(curve, sortedUnique)
    const containingIndex = Intervals.findContainingInterval(curve, allIntervals, clicked.parameter)
    if (containingIndex === -1) return noOp(target, "ambiguous-pick")

    const removed = allIntervals[containingIndex]
    const survivorSweep = TAU - (removed.end - removed.start)
    if (survivorSweep <= PARAMETER_TOLERANCE || survivorSweep >= TAU - PARAMETER_TOLERANCE) return noOp(target, "zero-length-result")

    const survivorStartAngle = normalizeAngle(removed.end)
    const start = freezePoint(Parameter.pointAt(curve, survivorStartAngle))
    const end = freezePoint(Parameter.pointAt(curve, survivorStartAngle + survivorSweep))
    const geometry = Object.freeze({ type: "arc", center: curve.center, radius: curve.radius, start, end, sweep: survivorSweep })
    const featureIdentityIntent = Object.freeze({ start: allocateFeatureIntent(), end: allocateFeatureIntent() })

    if (target.type === "ellipse") {
      // Phase 1: no persistent partial-ellipse representation exists. A
      // genuinely removable interval was found, but the surviving result
      // cannot be persisted -- explicit unsupported result, never a silent
      // Polyline/EllipseArc conversion and never a schema change.
      return Object.freeze({
        status: "unsupported-target-result",
        reason: "partial-ellipse-not-persistable",
        targetRecordId: target.id,
        intersectionParameters: sortedUnique,
        removedInterval: removed,
      })
    }

    return planned({
      targetRecordId: target.id,
      targetType: target.type,
      intersectionParameters: sortedUnique,
      removedInterval: removed,
      replacement: Object.freeze({ geometry, preserveRecordId: true, featureIdentityIntent }),
      creates: Object.freeze([]),
    })
  }

  // --- Polyline target ------------------------------------------------------
  const existingVertex = vertex => Object.freeze({ point: freezePoint(vertex), intent: preserveFeatureIntent(vertex.featureId) })
  const cutVertex = point => Object.freeze({ point: freezePoint(point), intent: allocateFeatureIntent() })

  function toPieceRecord(entries) {
    return Object.freeze({
      geometry: Object.freeze({ type: "polyline", vertices: Object.freeze(entries.map(entry => entry.point)), closed: false }),
      featureIdentityIntent: Object.freeze({ vertices: Object.freeze(entries.map(entry => entry.intent)) }),
    })
  }

  // Open Polyline: only the affected segment is cut; every other segment is
  // structurally untouched. A single one-sided cut can orphan the vertices on
  // the far side of the segment into their own sibling; a middle (two-sided)
  // cut on the segment always produces exactly two pieces.
  function buildOpenPolylinePieces(vertices, segmentIndex, survivorIntervals, segmentCurve) {
    const beforeChain = vertices.slice(0, segmentIndex + 1).map(existingVertex)
    const afterChain = vertices.slice(segmentIndex + 1).map(existingVertex)
    const cutPoint = parameter => cutVertex(Parameter.pointAt(segmentCurve, parameter))

    if (survivorIntervals.length === 2) {
      const [startSide, endSide] = survivorIntervals
      const first = [...beforeChain, cutPoint(startSide.end)]
      const second = [cutPoint(endSide.start), ...afterChain]
      return [{ entries: first, containsOriginalStart: true }, { entries: second, containsOriginalStart: false }]
    }

    const [interval] = survivorIntervals
    const pieces = []
    if (near(interval.start, 0)) {
      pieces.push({ entries: [...beforeChain, cutPoint(interval.end)], containsOriginalStart: true })
      if (afterChain.length >= 2) pieces.push({ entries: afterChain, containsOriginalStart: false })
    } else if (near(interval.end, 1)) {
      if (beforeChain.length >= 2) pieces.push({ entries: beforeChain, containsOriginalStart: true })
      pieces.push({ entries: [cutPoint(interval.start), ...afterChain], containsOriginalStart: false })
    }
    return pieces
  }

  // Closed Polyline: cutting one segment always opens the ring into exactly
  // one surviving chain (the ring's complement of the removed gap), just like
  // Circle -> Arc. No duplicate seam vertex is ever introduced.
  function buildClosedPolylinePiece(vertices, segmentIndex, survivorIntervals, containingInterval, segmentCurve) {
    const n = vertices.length
    const cutPoint = parameter => cutVertex(Parameter.pointAt(segmentCurve, parameter))
    const ring = []
    for (let step = 1; step <= n; step++) ring.push(existingVertex(vertices[(segmentIndex + step) % n]))
    // `ring` runs forward from the vertex right after the segment (segEnd)
    // through to the segment's own start vertex (segStart), i.e. every other
    // vertex exactly once, in native order, seam-safe by construction.

    if (survivorIntervals.length === 2) {
      const [startSide, endSide] = survivorIntervals
      return [cutPoint(endSide.start), ...ring, cutPoint(startSide.end)]
    }
    const [interval] = survivorIntervals
    if (near(interval.start, 0)) return [cutPoint(interval.end), ...ring]
    return [...ring, cutPoint(interval.start)]
  }

  function planPolylineTarget(target, cuttingEdges, pickPoint) {
    if (!Array.isArray(target.vertices)) return invalidTarget(target, "invalid-polyline-vertices")
    const described = Descriptor.polylineSegments(target.vertices, target.closed)
    if (!described.valid) return invalidTarget(target, described.reason)

    const located = Parameter.locatePolylineSegment(described.segments, pickPoint)
    if (!located || located.valid === false) return noOp(target, "unresolvable-pick")

    const segmentIndex = located.segmentIndex
    const segmentCurve = described.segments[segmentIndex]

    const gathered = gatherCutParameters(segmentCurve, cuttingEdges)
    if (gathered.parameters.length === 0) return noOp(target, noCutReason(gathered))

    const sortedUnique = Intervals.sortedUniqueParameters(segmentCurve, gathered.parameters)
    if (sortedUnique.length === 0) return noOp(target, "no-intersection")

    const allIntervals = Intervals.buildIntervals(segmentCurve, sortedUnique)
    if (allIntervals.length === 0) return noOp(target, "no-intersection")

    const containingIndex = Intervals.findContainingInterval(segmentCurve, allIntervals, located.localParameter)
    if (containingIndex === -1) return noOp(target, "ambiguous-pick")

    const survivorIntervals = Intervals.survivingIntervals(allIntervals, containingIndex)
      .filter(interval => interval.end - interval.start > PARAMETER_TOLERANCE)
    if (survivorIntervals.length === 0) return noOp(target, "zero-length-result")

    const sharedFields = {
      targetRecordId: target.id,
      targetType: "polyline",
      intersectionParameters: sortedUnique,
      removedInterval: allIntervals[containingIndex],
      affectedSegmentIndex: segmentIndex,
    }

    if (target.closed) {
      const entries = buildClosedPolylinePiece(target.vertices, segmentIndex, survivorIntervals, allIntervals[containingIndex], segmentCurve)
      const piece = toPieceRecord(entries)
      return planned({
        ...sharedFields,
        replacement: Object.freeze({ geometry: piece.geometry, preserveRecordId: true, featureIdentityIntent: piece.featureIdentityIntent }),
        creates: Object.freeze([]),
      })
    }

    const rawPieces = buildOpenPolylinePieces(target.vertices, segmentIndex, survivorIntervals, segmentCurve)
    if (rawPieces.length === 0) return noOp(target, "zero-length-result")

    let replacementIndex = rawPieces.findIndex(piece => piece.containsOriginalStart)
    if (replacementIndex === -1) replacementIndex = 0
    const replacementPiece = toPieceRecord(rawPieces[replacementIndex].entries)
    const createPieces = rawPieces.filter((_, index) => index !== replacementIndex).map(piece => toPieceRecord(piece.entries))

    return planned({
      ...sharedFields,
      replacement: Object.freeze({ geometry: replacementPiece.geometry, preserveRecordId: true, featureIdentityIntent: replacementPiece.featureIdentityIntent }),
      creates: Object.freeze(createPieces.map(piece => Object.freeze({ geometry: piece.geometry, featureIdentityIntent: piece.featureIdentityIntent }))),
    })
  }

  // --- entry point ---------------------------------------------------------
  function planTrim({ target, cuttingEdges, pickPoint } = {}) {
    if (!target || typeof target !== "object") return invalidTarget(target, "missing-target")
    if (!Number.isFinite(pickPoint?.x) || !Number.isFinite(pickPoint?.y)) return invalidTarget(target, "non-finite-pick-point")

    const described = Descriptor.describe(target)
    if (!described.valid) return invalidTarget(target, described.reason)

    switch (described.kind) {
      case "line": return planOpenAtomicTarget(target, described, cuttingEdges, pickPoint, buildLineSurvivor)
      case "arc": return planOpenAtomicTarget(target, described, cuttingEdges, pickPoint, buildArcSurvivor)
      case "circle": return planClosedAtomicTarget(target, described, cuttingEdges, pickPoint)
      case "ellipse": return planClosedAtomicTarget(target, described, cuttingEdges, pickPoint)
      case "polyline": return planPolylineTarget(target, cuttingEdges, pickPoint)
      default: return invalidTarget(target, "unsupported-curve-type")
    }
  }

  window.CaderactTrimPlanner = Object.freeze({
    planTrim, planExtend, preserveFeatureIntent, allocateFeatureIntent,
  })
})()
