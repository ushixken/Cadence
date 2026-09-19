// M1: pure record translation preserving persistent object and topology identity.
(() => {
  const point = (value, dx, dy) => ({ ...value, x: value.x + dx, y: value.y + dy })
  const dimensionPointKeys=record=>record.type==="dimension-linear"?["firstPoint","secondPoint","dimensionLinePoint"]:record.type==="dimension-angular"?["firstRayPoint","vertex","secondRayPoint","dimensionArcPoint"]:record.type==="dimension-radial"?["centerPoint","dimensionPoint","leaderPoint"]:null
  function transformDimension(record,transform){const keys=dimensionPointKeys(record);if(!keys)return null;const result={...record};for(const key of keys)result[key]=transform(record[key]);return Object.freeze(result)}
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
    if(record.type.startsWith("dimension-"))return transformDimension(record,value=>Object.freeze(point(value,dx,dy)))
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
    if(record.type.startsWith("dimension-"))return transformDimension(record,value=>rotatePoint(value,center,normalized))
    throw new Error(`Unsupported geometry type: ${record.type}`)
  }
  function scalePoint(value, base, factor) {
    if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||!Number.isFinite(base?.x)||!Number.isFinite(base?.y)||!Number.isFinite(factor)||factor<=0)throw new Error("Invalid scale")
    const x=base.x+factor*(value.x-base.x),y=base.y+factor*(value.y-base.y)
    if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error("Invalid scale result")
    return Object.freeze({...value,x,y})
  }
  function scaleVector(value, factor) {
    if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||!Number.isFinite(factor)||factor<=0)throw new Error("Invalid scale")
    const x=value.x*factor,y=value.y*factor
    if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error("Invalid scale result")
    return Object.freeze({...value,x,y})
  }
  function scaleRecord(record, base, factor) {
    if(!record||!Number.isFinite(base?.x)||!Number.isFinite(base?.y)||!Number.isFinite(factor)||factor<=0)throw new Error("Invalid scale")
    if(record.type==="line")return Object.freeze({...record,start:scalePoint(record.start,base,factor),end:scalePoint(record.end,base,factor)})
    if(record.type==="circle"){const radius=record.radius*factor;if(!Number.isFinite(radius)||radius<=0)throw new Error("Invalid scale result");return Object.freeze({...record,center:scalePoint(record.center,base,factor),radius})}
    if(record.type==="arc"){const radius=record.radius*factor;if(!Number.isFinite(radius)||radius<=0)throw new Error("Invalid scale result");return Object.freeze({...record,center:scalePoint(record.center,base,factor),start:scalePoint(record.start,base,factor),end:scalePoint(record.end,base,factor),radius})}
    if(record.type==="ellipse"){const minorRadius=record.minorRadius*factor;if(!Number.isFinite(minorRadius)||minorRadius<=0)throw new Error("Invalid scale result");return Object.freeze({...record,center:scalePoint(record.center,base,factor),majorAxis:scaleVector(record.majorAxis,factor),minorRadius})}
    if(record.type==="polyline")return Object.freeze({...record,vertices:Object.freeze(record.vertices.map(vertex=>scalePoint(vertex,base,factor)))})
    if(record.type.startsWith("dimension-"))return transformDimension(record,value=>scalePoint(value,base,factor))
    throw new Error(`Unsupported geometry type: ${record.type}`)
  }
  function mirrorAxis(axisA, axisB) {
    const dx=axisB?.x-axisA?.x,dy=axisB?.y-axisA?.y,lengthSquared=dx*dx+dy*dy
    if(!Number.isFinite(axisA?.x)||!Number.isFinite(axisA?.y)||!Number.isFinite(dx)||!Number.isFinite(dy)||!(lengthSquared>1e-16))throw new Error("Invalid mirror axis")
    return Object.freeze({axisA:Object.freeze({x:axisA.x,y:axisA.y}),dx,dy,lengthSquared})
  }
  function mirrorPoint(value, axisA, axisB) {
    const axis=mirrorAxis(axisA,axisB);if(!Number.isFinite(value?.x)||!Number.isFinite(value?.y))throw new Error("Invalid mirror point")
    const px=value.x-axis.axisA.x,py=value.y-axis.axisA.y,t=(px*axis.dx+py*axis.dy)/axis.lengthSquared
    // P' = 2 * (A + t(B - A)) - P.  Both coordinates of A are part of
    // the projected point; omitting one made every non-origin axis rebase
    // incorrectly toward the source geometry.
    const x=2*axis.axisA.x+2*t*axis.dx-value.x,y=2*axis.axisA.y+2*t*axis.dy-value.y
    if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error("Invalid mirror result")
    return Object.freeze({...value,x,y})
  }
  function mirrorVector(value, axisA, axisB) {
    const axis=mirrorAxis(axisA,axisB);if(!Number.isFinite(value?.x)||!Number.isFinite(value?.y))throw new Error("Invalid mirror vector")
    const t=(value.x*axis.dx+value.y*axis.dy)/axis.lengthSquared,x=2*t*axis.dx-value.x,y=2*t*axis.dy-value.y
    if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error("Invalid mirror result")
    return Object.freeze({...value,x,y})
  }
  function mirrorRecord(record, axisA, axisB) {
    mirrorAxis(axisA,axisB);if(!record)throw new Error("Invalid mirror record")
    if(record.type==="line")return Object.freeze({...record,start:mirrorPoint(record.start,axisA,axisB),end:mirrorPoint(record.end,axisA,axisB)})
    if(record.type==="circle")return Object.freeze({...record,center:mirrorPoint(record.center,axisA,axisB)})
    if(record.type==="arc")return Object.freeze({...record,center:mirrorPoint(record.center,axisA,axisB),start:mirrorPoint(record.start,axisA,axisB),end:mirrorPoint(record.end,axisA,axisB),sweep:-record.sweep})
    if(record.type==="ellipse")return Object.freeze({...record,center:mirrorPoint(record.center,axisA,axisB),majorAxis:mirrorVector(record.majorAxis,axisA,axisB)})
    if(record.type==="polyline")return Object.freeze({...record,vertices:Object.freeze(record.vertices.map(vertex=>mirrorPoint(vertex,axisA,axisB)))})
    if(record.type.startsWith("dimension-"))return transformDimension(record,value=>mirrorPoint(value,axisA,axisB))
    throw new Error(`Unsupported geometry type: ${record.type}`)
  }
  window.CaderactGeometryTransform = Object.freeze({ translateRecord, rotatePoint, rotateRecord, normalizeAngle, scalePoint, scaleRecord, mirrorPoint, mirrorRecord })
})()
