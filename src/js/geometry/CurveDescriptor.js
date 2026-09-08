// M6P2: pure, renderer-neutral adapter from record-shaped geometry (or already
// normalized descriptors) into small curve descriptors consumed by
// CurveParameter/CurveIntersection/TrimIntervals. No Viewport/DOM/renderer/
// document/command dependency of any kind.
(() => {
  const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y)
  const freezePoint = point => Object.freeze({ x: point.x, y: point.y })
  const invalid = reason => Object.freeze({ valid: false, reason })

  function describeLine(start, end) {
    if (!finitePoint(start) || !finitePoint(end)) return invalid("non-finite-point")
    if (start.x === end.x && start.y === end.y) return invalid("zero-length-line")
    return Object.freeze({ valid: true, kind: "line", start: freezePoint(start), end: freezePoint(end) })
  }

  function describeCircle(center, radius) {
    if (!finitePoint(center) || !Number.isFinite(radius)) return invalid("non-finite-input")
    if (!(radius > 0)) return invalid("non-positive-radius")
    return Object.freeze({ valid: true, kind: "circle", center: freezePoint(center), radius })
  }

  function describeArc(center, radius, start, sweep) {
    if (!finitePoint(center) || !finitePoint(start) || !Number.isFinite(radius) || !Number.isFinite(sweep)) {
      return invalid("non-finite-input")
    }
    if (!(radius > 0)) return invalid("non-positive-radius")
    if (sweep === 0 || Math.abs(sweep) >= window.CaderactArcGeometry.TAU) return invalid("invalid-sweep")
    const startAngle = window.CaderactArcGeometry.normalizeAngle(Math.atan2(start.y - center.y, start.x - center.x))
    return Object.freeze({ valid: true, kind: "arc", center: freezePoint(center), radius, startAngle, sweep })
  }

  function describeEllipse(center, majorAxis, minorRadius) {
    if (!finitePoint(center) || !finitePoint(majorAxis) || !Number.isFinite(minorRadius)) return invalid("non-finite-input")
    const majorRadius = Math.hypot(majorAxis.x, majorAxis.y)
    if (!(majorRadius > 0) || !(minorRadius > 0)) return invalid("degenerate-axis")
    return Object.freeze({ valid: true, kind: "ellipse", center: freezePoint(center),
      majorAxis: freezePoint(majorAxis), minorRadius, majorRadius })
  }

  // Native Polyline persists as ordered finite Line segments; a closed
  // Polyline adds the implicit closing segment from the last vertex back to
  // the first. Returns the ordered list of per-segment Line descriptors.
  function polylineSegments(vertices, closed) {
    if (!Array.isArray(vertices) || vertices.length < 2) return invalid("insufficient-vertices")
    const segmentCount = closed ? vertices.length : vertices.length - 1
    if (segmentCount < 1) return invalid("insufficient-vertices")
    const segments = []
    for (let index = 0; index < segmentCount; index++) {
      const start = vertices[index], end = vertices[(index + 1) % vertices.length]
      const segment = describeLine(start, end)
      if (!segment.valid) return invalid("degenerate-segment")
      segments.push(Object.freeze({ ...segment, segmentIndex: index }))
    }
    return Object.freeze({ valid: true, kind: "polyline", closed: Boolean(closed), segments: Object.freeze(segments) })
  }

  // Accepts either a persisted document record (type: "line"|"circle"|"arc"|
  // "ellipse"|"polyline") or an already plain-shaped geometry object. Never
  // reads record.id/layerId/featureId; purely geometric fields are consumed.
  function describe(record) {
    if (!record || typeof record !== "object") return invalid("missing-record")
    switch (record.type ?? record.kind) {
      case "line": return describeLine(record.start, record.end)
      case "circle": return describeCircle(record.center, record.radius)
      case "arc": return describeArc(record.center, record.radius, record.start, record.sweep)
      case "ellipse": return describeEllipse(record.center, record.majorAxis, record.minorRadius)
      case "polyline": return polylineSegments(record.vertices, record.closed)
      default: return invalid("unsupported-curve-type")
    }
  }

  // Flattens any supported curve into an array of atomic (non-polyline)
  // descriptors participating in intersection/parameterization: a Polyline
  // becomes its finite Line segments, everything else is a single-element list.
  function atomicCurves(record) {
    const described = describe(record)
    if (!described.valid) return described
    if (described.kind !== "polyline") return Object.freeze({ valid: true, curves: Object.freeze([described]) })
    return Object.freeze({ valid: true, curves: described.segments })
  }

  window.CaderactCurveDescriptor = Object.freeze({
    describe, describeLine, describeCircle, describeArc, describeEllipse, polylineSegments, atomicCurves,
  })
})()
