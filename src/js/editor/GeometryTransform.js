// M1: pure record translation preserving persistent object and topology identity.
(() => {
  const point = (value, dx, dy) => ({ ...value, x: value.x + dx, y: value.y + dy })
  function translateRecord(record, dx, dy) {
    if (!record || !Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error("Invalid translation")
    if (record.type === "line") return Object.freeze({ ...record,
      start: Object.freeze(point(record.start, dx, dy)), end: Object.freeze(point(record.end, dx, dy)) })
    if (record.type === "circle") return Object.freeze({ ...record, center: Object.freeze(point(record.center, dx, dy)) })
    if (record.type === "arc") return Object.freeze({ ...record, center: Object.freeze(point(record.center, dx, dy)),
      start: Object.freeze(point(record.start, dx, dy)), end: Object.freeze(point(record.end, dx, dy)) })
    if (record.type === "ellipse") return Object.freeze({ ...record, center: Object.freeze(point(record.center, dx, dy)) })
    if (record.type === "polyline") return Object.freeze({ ...record,
      vertices: Object.freeze(record.vertices.map(vertex => Object.freeze(point(vertex, dx, dy)))) })
    throw new Error(`Unsupported geometry type: ${record.type}`)
  }
  window.CaderactGeometryTransform = Object.freeze({ translateRecord })
})()
