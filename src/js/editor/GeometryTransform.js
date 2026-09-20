// M1: pure record translation preserving persistent object and topology identity.
(() => {
  const point = (value, dx, dy) => ({ ...value, x: value.x + dx, y: value.y + dy })
  const dimensionPointKeys=record=>record.type==="dimension-linear"?["firstPoint","secondPoint","dimensionLinePoint"]:record.type==="dimension-angular"?["firstRayPoint","vertex","secondRayPoint","dimensionArcPoint"]:record.type==="dimension-radial"?["centerPoint","dimensionPoint","leaderPoint"]:null
  function hatchPattern(record,transformPoint,{angleDelta=0,scale=1,mirrorVector=null}={}){if(record.type!=="hatch"||record.pattern.kind!=="named")return record.pattern;let angle=record.pattern.angle+angleDelta;if(mirrorVector){const direction=mirrorVector({x:Math.cos(record.pattern.angle),y:Math.sin(record.pattern.angle)});angle=Math.atan2(direction.y,direction.x)}return Object.freeze({...record.pattern,origin:transformPoint(record.pattern.origin),angle:normalizeAngle(angle),scale:record.pattern.scale*scale})}
  function transformRegion(record,transformPoint,transformVector=value=>value,scale=1,reverse=false){const edgeTransform=edge=>{let result={...edge};for(const key of ["start","end","center"])if(edge[key])result[key]=transformPoint(edge[key]);if(edge.majorAxis)result.majorAxis=transformVector(edge.majorAxis);if(edge.radius!==undefined)result.radius=edge.radius*scale;if(edge.minorRadius!==undefined)result.minorRadius=edge.minorRadius*scale;if(reverse){if(result.start&&result.end)[result.start,result.end]=[result.end,result.start];if(result.sweep!==undefined)result.sweep=-result.sweep;if(result.clockwise!==undefined)result.clockwise=!result.clockwise}return Object.freeze(result)};return Object.freeze({...record,loops:Object.freeze(record.loops.map(loop=>Object.freeze({...loop,edges:Object.freeze((reverse?[...loop.edges].reverse():loop.edges).map(edgeTransform))})))})}
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
    if(record.type==="text")return Object.freeze({...record,insertionPoint:Object.freeze(point(record.insertionPoint,dx,dy))})
    if(record.type==="region"||record.type==="hatch"){const transform=value=>Object.freeze(point(value,dx,dy)),result=transformRegion(record,transform);return record.type==="hatch"?Object.freeze({...result,pattern:hatchPattern(record,transform)}):result}
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
    if(record.type==="text")return Object.freeze({...record,insertionPoint:rotatePoint(record.insertionPoint,center,normalized),rotation:window.CaderactAnnotationGeometry.normalizeRotation(record.rotation+normalized)})
    if(record.type==="region"||record.type==="hatch"){const transform=value=>rotatePoint(value,center,normalized),result=transformRegion(record,transform,value=>rotateVector(value,normalized));return record.type==="hatch"?Object.freeze({...result,pattern:hatchPattern(record,transform,{angleDelta:normalized})}):result}
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
    if(record.type==="text")return Object.freeze({...record,insertionPoint:scalePoint(record.insertionPoint,base,factor),height:record.height*factor})
    if(record.type==="region"||record.type==="hatch"){const transform=value=>scalePoint(value,base,factor),result=transformRegion(record,transform,value=>scaleVector(value,factor),factor);return record.type==="hatch"?Object.freeze({...result,pattern:hatchPattern(record,transform,{scale:factor})}):result}
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
    if(record.type==="text"){const insertionPoint=mirrorPoint(record.insertionPoint,axisA,axisB),direction=mirrorVector({x:Math.cos(record.rotation),y:Math.sin(record.rotation)},axisA,axisB);return Object.freeze({...record,insertionPoint,rotation:window.CaderactAnnotationGeometry.normalizeRotation(Math.atan2(direction.y,direction.x))})}
    if(record.type==="region"||record.type==="hatch"){const transform=value=>mirrorPoint(value,axisA,axisB),vector=value=>mirrorVector(value,axisA,axisB),result=transformRegion(record,transform,vector,1,true);return record.type==="hatch"?Object.freeze({...result,pattern:hatchPattern(record,transform,{mirrorVector:vector})}):result}
    if(record.type.startsWith("dimension-"))return transformDimension(record,value=>mirrorPoint(value,axisA,axisB))
    throw new Error(`Unsupported geometry type: ${record.type}`)
  }
  window.CaderactGeometryTransform = Object.freeze({ translateRecord, rotatePoint, rotateRecord, normalizeAngle, scalePoint, scaleRecord, mirrorPoint, mirrorRecord })
})()
