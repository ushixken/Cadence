// DC2: pure one-point Split and two-point Break planning.
(() => {
  const TOLERANCE = 1e-8
  const point = value => Object.freeze({ x: value.x, y: value.y, ...(value.featureId ? { featureId: value.featureId } : {}) })
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const failure = reason => Object.freeze({ status: "invalid", reason })
  const snapshot = record => Object.freeze(record.type === "line"
    ? { id: record.id, type: "line", start: point(record.start), end: point(record.end) }
    : { id: record.id, type: "polyline", closed: Boolean(record.closed), vertices: Object.freeze(record.vertices.map(point)) })
  function segmentParameter(start, end, candidate) {
    const dx = end.x - start.x, dy = end.y - start.y, denominator = dx * dx + dy * dy
    if (!(denominator > TOLERANCE * TOLERANCE)) return null
    const parameter = ((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / denominator
    const projected = { x: start.x + dx * parameter, y: start.y + dy * parameter }
    if (distance(projected, candidate) > TOLERANCE) return null
    return { parameter, point: point(projected) }
  }
  const intent = (value, role = "preserve") => Object.freeze(role === "preserve" ? { role, featureId: value.featureId } : { role: "allocate" })
  const linePiece = (start, end, startIntent, endIntent) => Object.freeze({ geometry: Object.freeze({ type: "line", start: point(start), end: point(end) }), vertexIntents: Object.freeze([startIntent, endIntent]) })
  const polylinePiece = (vertices, intents) => Object.freeze({ geometry: Object.freeze({ type: "polyline", vertices: Object.freeze(vertices.map(point)), closed: false }), vertexIntents: Object.freeze(intents) })

  function splitLine(record, candidate) {
    const located = segmentParameter(record.start, record.end, candidate)
    if (!located) return failure("point-off-entity")
    if (located.parameter <= TOLERANCE || located.parameter >= 1 - TOLERANCE) return failure("endpoint-split")
    return [linePiece(record.start, located.point, intent(record.start), intent(null, "allocate")), linePiece(located.point, record.end, intent(null, "allocate"), intent(record.end))]
  }
  function locatePolyline(record, candidate) {
    if (record.closed || !Array.isArray(record.vertices) || record.vertices.length < 2) return failure("unsupported-geometry")
    const hits = []
    for (let index = 0; index < record.vertices.length - 1; index++) {
      const located = segmentParameter(record.vertices[index], record.vertices[index + 1], candidate)
      if (located && located.parameter >= -TOLERANCE && located.parameter <= 1 + TOLERANCE) hits.push({ ...located, index })
    }
    if (hits.length !== 1) return failure(hits.length ? "ambiguous-point" : "point-off-entity")
    const hit = hits[0]
    if (hit.parameter <= TOLERANCE || hit.parameter >= 1 - TOLERANCE) return failure("vertex-split")
    return hit
  }
  function splitPolyline(record, candidate) {
    const hit = locatePolyline(record, candidate)
    if (hit.status === "invalid") return hit
    const before = [...record.vertices.slice(0, hit.index + 1), hit.point], after = [hit.point, ...record.vertices.slice(hit.index + 1)]
    return [polylinePiece(before, [...record.vertices.slice(0, hit.index + 1).map(intent), intent(null, "allocate")]),
      polylinePiece(after, [intent(null, "allocate"), ...record.vertices.slice(hit.index + 1).map(intent)])]
  }
  function planSplit({ record, point: candidate } = {}) {
    if (!record || !candidate || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) return failure("invalid-input")
    const pieces = record.type === "line" ? splitLine(record, candidate) : record.type === "polyline" ? splitPolyline(record, candidate) : failure("unsupported-geometry")
    if (!Array.isArray(pieces)) return pieces
    return Object.freeze({ status: "planned", operation: "split", sourceGeometry: snapshot(record), targetRecordId: record.id, replacement: pieces[0], creates: Object.freeze(pieces.slice(1)) })
  }
  function planBreak({ record, firstPoint, secondPoint } = {}) {
    if (record?.type !== "line") return failure("unsupported-break-geometry")
    const first = segmentParameter(record.start, record.end, firstPoint), second = segmentParameter(record.start, record.end, secondPoint)
    if (!first || !second) return failure("point-off-entity")
    let low = first, high = second
    if (low.parameter > high.parameter) [low, high] = [high, low]
    if (low.parameter <= TOLERANCE || high.parameter >= 1 - TOLERANCE) return failure("endpoint-break")
    if (high.parameter - low.parameter <= TOLERANCE) return failure("degenerate-break")
    const pieces = [linePiece(record.start, low.point, intent(record.start), intent(null, "allocate")), linePiece(high.point, record.end, intent(null, "allocate"), intent(record.end))]
    return Object.freeze({ status: "planned", operation: "break", sourceGeometry: snapshot(record), targetRecordId: record.id, replacement: pieces[0], creates: Object.freeze(pieces.slice(1)) })
  }
  window.CaderactSplitBreakPlanner = Object.freeze({ TOLERANCE, planSplit, planBreak })
})()
