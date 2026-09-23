// DC3: pure, renderer/document-free array planning.
(() => {
  const MAX_GENERATED_RECORDS = 500
  const finitePoint = value => Number.isFinite(value?.x) && Number.isFinite(value?.y)
  const invalid = reason => Object.freeze({ status: "invalid", reason })
  const planned = transforms => Object.freeze({ status: "planned", transforms: Object.freeze(transforms), generatedRecordCount: transforms.length })
  function sources(records) { return Array.isArray(records) && records.length && records.every(record => record?.id) }
  function withinLimit(records, positions) { return records.length * positions <= MAX_GENERATED_RECORDS }
  function rectangular({ records, rows, columns, rowSpacing, columnSpacing } = {}) {
    if (!sources(records)) return invalid("empty-selection")
    if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(columns) || columns < 1) return invalid("invalid-count")
    if (!Number.isFinite(rowSpacing) || !Number.isFinite(columnSpacing)) return invalid("invalid-spacing")
    if (rows === 1 && columns === 1) return invalid("no-copies")
    if ((rows > 1 && rowSpacing === 0) || (columns > 1 && columnSpacing === 0)) return invalid("zero-spacing")
    const positions = rows * columns - 1
    if (!withinLimit(records, positions)) return invalid("copy-limit")
    const transforms = []
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      if (row === 0 && column === 0) continue
      for (const record of records) transforms.push(Object.freeze({ recordId: record.id, kind: "translate", dx: column === 0 ? 0 : column * columnSpacing, dy: row === 0 ? 0 : row * rowSpacing }))
    }
    return planned(transforms)
  }
  function polar({ records, center, itemCount, fillAngleDegrees } = {}) {
    if (!sources(records)) return invalid("empty-selection")
    if (!finitePoint(center)) return invalid("invalid-center")
    if (!Number.isInteger(itemCount) || itemCount < 2) return invalid("invalid-count")
    if (!Number.isFinite(fillAngleDegrees) || fillAngleDegrees === 0 || Math.abs(fillAngleDegrees) > 360) return invalid("invalid-angle")
    const positions = itemCount - 1
    if (!withinLimit(records, positions)) return invalid("copy-limit")
    const full = Math.abs(Math.abs(fillAngleDegrees) - 360) <= 1e-9
    const step = fillAngleDegrees / (full ? itemCount : itemCount - 1)
    const transforms = []
    for (let index = 1; index < itemCount; index++) for (const record of records) transforms.push(Object.freeze({ recordId: record.id, kind: "rotate", center: Object.freeze({ x: center.x, y: center.y }), angle: step * index * Math.PI / 180 }))
    return planned(transforms)
  }
  function pathSegments(path) {
    if (path?.type === "line") return [{ start: path.start, end: path.end }]
    if (path?.type === "polyline" && !path.closed && path.vertices?.length >= 2) return path.vertices.slice(1).map((end, index) => ({ start: path.vertices[index], end }))
    return null
  }
  function path({ records, path: pathRecord, basePoint, itemCount, spacing } = {}) {
    if (!sources(records)) return invalid("empty-selection")
    if (!finitePoint(basePoint)) return invalid("invalid-base-point")
    if (!Number.isInteger(itemCount) || itemCount < 2) return invalid("invalid-count")
    if (!Number.isFinite(spacing) || spacing <= 0) return invalid("invalid-spacing")
    const segments = pathSegments(pathRecord)
    if (!segments) return invalid("invalid-path")
    const measured = segments.map(segment => ({ ...segment, length: Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) })).filter(segment => segment.length > 1e-12)
    const length = measured.reduce((sum, segment) => sum + segment.length, 0)
    if (!(length > 0) || spacing * (itemCount - 1) > length + 1e-9) return invalid("path-too-short")
    const positions = itemCount - 1
    if (!withinLimit(records, positions)) return invalid("copy-limit")
    function pointAt(distance) { let remaining = distance; for (const segment of measured) { if (remaining <= segment.length + 1e-12) { const t = Math.min(1, remaining / segment.length); return { x: segment.start.x + (segment.end.x - segment.start.x) * t, y: segment.start.y + (segment.end.y - segment.start.y) * t } } remaining -= segment.length } return measured.at(-1).end }
    const transforms = []
    for (let index = 1; index < itemCount; index++) { const target = pointAt(index * spacing); for (const record of records) transforms.push(Object.freeze({ recordId: record.id, kind: "translate", dx: target.x - basePoint.x, dy: target.y - basePoint.y })) }
    return planned(transforms)
  }
  window.CaderactArrayPlanner = Object.freeze({ rectangular, polar, path, MAX_GENERATED_RECORDS })
})()
