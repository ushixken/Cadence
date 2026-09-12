// M8: pure native 2D offset planning.  This module accepts only geometry and
// produces only geometry; record identity, transactions, UI, and rendering are
// deliberately owned by their existing boundaries.
(() => {
  const EPSILON = 1e-8
  const MITER_LIMIT = 1000
  const point = (x, y) => Object.freeze({ x, y })
  const finite = p => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y })
  const cross = (a, b) => a.x * b.y - a.y * b.x
  const length = v => Math.hypot(v.x, v.y)
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= EPSILON
  const invalid = reason => Object.freeze({ status: "invalid", reason })
  const planned = geometry => Object.freeze({ status: "planned", geometry: Object.freeze(geometry) })

  function normalFor(a, b, side) {
    const vector = sub(b, a), magnitude = length(vector)
    if (!(magnitude > EPSILON)) return null
    return { x: -vector.y / magnitude * side, y: vector.x / magnitude * side }
  }
  function lineIntersection(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c), denominator = cross(r, s)
    if (Math.abs(denominator) <= EPSILON) return null
    const t = cross(sub(c, a), s) / denominator
    const result = point(a.x + t * r.x, a.y + t * r.y)
    return finite(result) ? result : null
  }
  function sideForLine(a, b, pick) {
    const value = cross(sub(b, a), sub(pick, a))
    return value < 0 ? -1 : 1
  }
  function nearestSegmentSide(vertices, closed, pick) {
    let winner = null
    const count = closed ? vertices.length : vertices.length - 1
    for (let index = 0; index < count; index++) {
      const a = vertices[index], b = vertices[(index + 1) % vertices.length], v = sub(b, a)
      const squared = v.x * v.x + v.y * v.y
      if (!(squared > EPSILON)) return null
      const t = Math.max(0, Math.min(1, (sub(pick, a).x * v.x + sub(pick, a).y * v.y) / squared))
      const projected = point(a.x + t * v.x, a.y + t * v.y)
      const distance = Math.hypot(pick.x - projected.x, pick.y - projected.y)
      if (!winner || distance < winner.distance) winner = { a, b, distance }
    }
    return winner ? sideForLine(winner.a, winner.b, pick) : null
  }
  function offsetLine(start, end, distance, side) {
    const normal = normalFor(start, end, side)
    if (!normal) return invalid("degenerate-line")
    return planned({ type: "line", start: point(start.x + normal.x * distance, start.y + normal.y * distance), end: point(end.x + normal.x * distance, end.y + normal.y * distance) })
  }
  function offsetCircle(record, distance, side) {
    const radius = record.radius + side * distance
    if (!(radius > EPSILON) || !Number.isFinite(radius)) return invalid("collapsed-inner-radius")
    return planned({ type: "circle", center: point(record.center.x, record.center.y), radius })
  }
  function offsetArc(record, distance, side) {
    const radius = record.radius + side * distance
    if (!(radius > EPSILON) || !Number.isFinite(radius)) return invalid("collapsed-inner-radius")
    const startAngle = Math.atan2(record.start.y - record.center.y, record.start.x - record.center.x)
    const endAngle = Math.atan2(record.end.y - record.center.y, record.end.x - record.center.x)
    return planned({ type: "arc", center: point(record.center.x, record.center.y), radius,
      start: point(record.center.x + Math.cos(startAngle) * radius, record.center.y + Math.sin(startAngle) * radius),
      end: point(record.center.x + Math.cos(endAngle) * radius, record.center.y + Math.sin(endAngle) * radius), sweep: record.sweep })
  }
  function offsetPolyline(record, distance, side) {
    const vertices = record.vertices
    if (!Array.isArray(vertices) || vertices.length < 2 || !vertices.every(finite)) return invalid("invalid-polyline")
    const closed = Boolean(record.closed), count = closed ? vertices.length : vertices.length - 1
    const shifted = []
    for (let index = 0; index < count; index++) {
      const a = vertices[index], b = vertices[(index + 1) % vertices.length], normal = normalFor(a, b, side)
      if (!normal) return invalid("degenerate-segment")
      shifted.push({ a: point(a.x + normal.x * distance, a.y + normal.y * distance), b: point(b.x + normal.x * distance, b.y + normal.y * distance) })
    }
    const result = []
    if (!closed) result.push(shifted[0].a)
    const first = closed ? 0 : 1, last = closed ? count : vertices.length - 1
    for (let index = first; index < last; index++) {
      const previous = shifted[(index - 1 + count) % count], next = shifted[index % count]
      const joined = lineIntersection(previous.a, previous.b, next.a, next.b)
      if (!joined || Math.hypot(joined.x - vertices[index % vertices.length].x, joined.y - vertices[index % vertices.length].y) > distance * MITER_LIMIT + EPSILON) return invalid("unsafe-miter")
      result.push(joined)
    }
    if (!closed) result.push(shifted.at(-1).b)
    if (result.length !== vertices.length || result.some((vertex, index) => near(vertex, result[(index + 1) % result.length]) && (closed || index < result.length - 1))) return invalid("collapsed-offset")
    return planned({ type: "polyline", vertices: Object.freeze(result), closed })
  }
  function offset(record, distance, pickPoint) {
    if (!(Number.isFinite(distance) && distance > 0) || !finite(pickPoint)) return invalid("invalid-offset-input")
    if (!record || !finite(record.center || record.start || record.vertices?.[0])) return invalid("invalid-record")
    if (record.type === "ellipse") return invalid("unsupported-ellipse")
    if (record.type === "line") return offsetLine(record.start, record.end, distance, sideForLine(record.start, record.end, pickPoint))
    if (record.type === "circle") return offsetCircle(record, distance, Math.hypot(pickPoint.x-record.center.x,pickPoint.y-record.center.y) >= record.radius ? 1 : -1)
    if (record.type === "arc") return offsetArc(record, distance, Math.hypot(pickPoint.x-record.center.x,pickPoint.y-record.center.y) >= record.radius ? 1 : -1)
    if (record.type === "polyline") { const side = nearestSegmentSide(record.vertices, Boolean(record.closed), pickPoint); return side ? offsetPolyline(record, distance, side) : invalid("invalid-polyline") }
    return invalid("unsupported-curve-type")
  }
  window.CaderactOffsetGeometry = Object.freeze({ offset, offsetLine, offsetCircle, offsetArc, offsetPolyline, EPSILON, MITER_LIMIT })
})()
