// DC2: pure conservative joining for connected native Lines/open Polylines.
(() => {
  const TOLERANCE = 1e-8
  const point = value => Object.freeze({ x: value.x, y: value.y, ...(value.featureId ? { featureId: value.featureId } : {}) })
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const failure = (reason, details = {}) => Object.freeze({ status: "invalid", reason, ...details })
  const sameProperties = (a, b) => a.layerId === b.layerId && a.color === b.color && a.linetype === b.linetype && a.lineweight === b.lineweight
  const snapshot = record => Object.freeze(record.type === "line"
    ? { id: record.id, type: "line", start: point(record.start), end: point(record.end) }
    : { id: record.id, type: "polyline", closed: Boolean(record.closed), vertices: Object.freeze(record.vertices.map(point)) })

  function path(record) {
    if (record?.type === "line" && record.start && record.end && distance(record.start, record.end) > TOLERANCE) return { record, vertices: [point(record.start), point(record.end)] }
    if (record?.type === "polyline" && !record.closed && Array.isArray(record.vertices) && record.vertices.length >= 2) return { record, vertices: record.vertices.map(point) }
    return null
  }
  const reverse = value => ({ record: value.record, vertices: [...value.vertices].reverse() })
  function collinearLines(first, second) {
    const a = { x: first.end.x - first.start.x, y: first.end.y - first.start.y }, b = { x: second.end.x - second.start.x, y: second.end.y - second.start.y }
    const scale = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)
    return scale > 0 && Math.abs(a.x * b.y - a.y * b.x) <= TOLERANCE * scale
  }

  function plan({ records } = {}) {
    if (!Array.isArray(records) || records.length < 2) return failure("insufficient-selection")
    if (new Set(records.map(record => record?.id)).size !== records.length) return failure("duplicate-record")
    const paths = records.map(path)
    if (paths.some(value => !value)) return failure("unsupported-geometry")
    if (records.some(record => !sameProperties(records[0], record))) return failure("incompatible-properties")
    if (records.length === 2 && records.every(record => record.type === "line") && !collinearLines(records[0], records[1])) return failure("non-collinear-lines")

    let chain = paths[0], remaining = paths.slice(1)
    while (remaining.length) {
      const head = chain.vertices[0], tail = chain.vertices.at(-1), candidates = []
      remaining.forEach((candidate, index) => {
        const start = candidate.vertices[0], end = candidate.vertices.at(-1)
        if (distance(tail, start) <= TOLERANCE) candidates.push({ index, side: "tail", path: candidate })
        if (distance(tail, end) <= TOLERANCE) candidates.push({ index, side: "tail", path: reverse(candidate) })
        if (distance(head, end) <= TOLERANCE) candidates.push({ index, side: "head", path: candidate })
        if (distance(head, start) <= TOLERANCE) candidates.push({ index, side: "head", path: reverse(candidate) })
      })
      const unique = candidates.filter((value, index, all) => all.findIndex(other => other.index === value.index && other.side === value.side) === index)
      if (unique.length === 0) return failure("disconnected-gap")
      if (unique.length !== 1) return failure("ambiguous-branch")
      const match = unique[0], joined = match.path.vertices
      chain = match.side === "tail"
        ? { record: chain.record, vertices: [...chain.vertices, ...joined.slice(1)] }
        : { record: chain.record, vertices: [...joined.slice(0, -1), ...chain.vertices] }
      remaining = remaining.filter((_, index) => index !== match.index)
    }
    const baseRecordId = records[0].id
    const oriented = chain.vertices
    const geometry = records.every(record => record.type === "line") && oriented.length === 3
      ? Object.freeze({ type: "line", start: point(oriented[0]), end: point(oriented.at(-1)) })
      : Object.freeze({ type: "polyline", vertices: Object.freeze(oriented.map(point)), closed: false })
    return Object.freeze({ status: "planned", operation: "join", baseRecordId, removeRecordIds: Object.freeze(records.map(record => record.id).filter(id => id !== baseRecordId)),
      sourceGeometry: Object.freeze(records.map(snapshot)), geometry, tolerance: TOLERANCE })
  }
  window.CaderactJoinPlanner = Object.freeze({ TOLERANCE, plan })
})()
