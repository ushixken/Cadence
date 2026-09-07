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
  function normalizeAngle(angle) {
    if (!Number.isFinite(angle)) throw new Error("Invalid rotation angle")
    let normalized=((angle+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI
    if(normalized<=-Math.PI)normalized=Math.PI
    return normalized
  }
  function rotatePoint(value, center, angle) {
    const cosine=Math.cos(angle),sine=Math.sin(angle),x=value.x-center.x,y=value.y-center.y
    return Object.freeze({...value,x:center.x+x*cosine-y*sine,y:center.y+x*sine+y*cosine})
  }
  function rotateVector(value, angle) {
    const cosine=Math.cos(angle),sine=Math.sin(angle)
    return Object.freeze({...value,x:value.x*cosine-value.y*sine,y:value.x*sine+value.y*cosine})
  }
  function rotateRecord(record, center, angle) {
    const normalized=normalizeAngle(angle)
    if(!record||!Number.isFinite(center?.x)||!Number.isFinite(center?.y))throw new Error("Invalid rotation")
    if(record.type==="line")return Object.freeze({...record,start:rotatePoint(record.start,center,normalized),end:rotatePoint(record.end,center,normalized)})
    if(record.type==="circle")return Object.freeze({...record,center:rotatePoint(record.center,center,normalized)})
    if(record.type==="arc")return Object.freeze({...record,center:rotatePoint(record.center,center,normalized),start:rotatePoint(record.start,center,normalized),end:rotatePoint(record.end,center,normalized)})
    if(record.type==="ellipse")return Object.freeze({...record,center:rotatePoint(record.center,center,normalized),majorAxis:rotateVector(record.majorAxis,normalized)})
    if(record.type==="polyline")return Object.freeze({...record,vertices:Object.freeze(record.vertices.map(vertex=>rotatePoint(vertex,center,normalized)) )})
    throw new Error(`Unsupported geometry type: ${record.type}`)
  }
  window.CaderactGeometryTransform = Object.freeze({ translateRecord, rotatePoint, rotateRecord, normalizeAngle })
})()
