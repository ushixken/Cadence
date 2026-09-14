// Pure native-dimension measurement and renderer-neutral presentation geometry.
(() => {
  const point = value => Object.freeze({ x: value.x, y: value.y })
  function measure(record) {
    if (record.type === "dimension-linear") {
      const dx=record.secondPoint.x-record.firstPoint.x,dy=record.secondPoint.y-record.firstPoint.y
      return Object.freeze({kind:"linear",value:record.mode==="horizontal"?Math.abs(dx):record.mode==="vertical"?Math.abs(dy):Math.hypot(dx,dy)})
    }
    if (record.type === "dimension-angular") {
      const result=window.CaderactMeasurement.measureIncludedAngle(record.firstRayPoint,record.vertex,record.secondRayPoint)
      return result.valid?Object.freeze({kind:"angular",value:result.angleRadians}):Object.freeze({kind:"angular",value:0,valid:false,reason:result.reason})
    }
    if (record.type === "dimension-radial") {
      const radius=Math.hypot(record.dimensionPoint.x-record.centerPoint.x,record.dimensionPoint.y-record.centerPoint.y)
      return Object.freeze({kind:"linear",value:record.mode==="diameter"?radius*2:radius})
    }
    return null
  }
  function arrow(tip, toward, size) {
    const dx=toward.x-tip.x,dy=toward.y-tip.y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,px=-uy,py=ux
    return Object.freeze([point(tip),point({x:tip.x+ux*size+px*size*.38,y:tip.y+uy*size+py*size*.38}),point({x:tip.x+ux*size-px*size*.38,y:tip.y+uy*size-py*size*.38})])
  }
  function linear(record, style, units) {
    const a=record.firstPoint,b=record.secondPoint,d=record.dimensionLinePoint
    let q1,q2
    if(record.mode==="horizontal"){q1={x:a.x,y:d.y};q2={x:b.x,y:d.y}}
    else if(record.mode==="vertical"){q1={x:d.x,y:a.y};q2={x:d.x,y:b.y}}
    else {const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy),nx=-dy/l,ny=dx/l,offset=(d.x-a.x)*nx+(d.y-a.y)*ny;q1={x:a.x+nx*offset,y:a.y+ny*offset};q2={x:b.x+nx*offset,y:b.y+ny*offset}}
    const ux=(q2.x-q1.x)/(Math.hypot(q2.x-q1.x,q2.y-q1.y)||1),uy=(q2.y-q1.y)/(Math.hypot(q2.x-q1.x,q2.y-q1.y)||1)
    const ext=style.extensionBeyond
    return Object.freeze({supported:true,measurement:measure(record),lines:Object.freeze([[point(a),point({x:q1.x-uy*ext,y:q1.y+ux*ext})],[point(b),point({x:q2.x-uy*ext,y:q2.y+ux*ext})],[point(q1),point(q2)]]),triangles:Object.freeze([arrow(q1,q2,style.arrowSize),arrow(q2,q1,style.arrowSize)]),text:Object.freeze({point:point({x:(q1.x+q2.x)/2,y:(q1.y+q2.y)/2}),rotation:Math.atan2(q2.y-q1.y,q2.x-q1.x),value:window.CaderactDimensionFormatter.format(measure(record),style,units,record.textOverride),height:style.textHeight})})
  }
  function normalize(value){const turn=Math.PI*2;return(value%turn+turn)%turn}
  function readableRotation(value){let result=normalize(value);if(result>Math.PI/2&&result<Math.PI*1.5)result=normalize(result+Math.PI);return result>Math.PI?result-Math.PI*2:result}
  function angular(record,style,units){
    const measurement=measure(record),v=record.vertex,a=record.firstRayPoint,b=record.secondRayPoint,d=record.dimensionArcPoint,radius=Math.hypot(d.x-v.x,d.y-v.y)
    if(measurement.valid===false||!(radius>0&&Number.isFinite(radius))||measurement.value<=0||measurement.value>=Math.PI)return Object.freeze({supported:false,measurement,reason:"degenerate-angular-geometry"})
    const angleA=normalize(Math.atan2(a.y-v.y,a.x-v.x)),angleB=normalize(Math.atan2(b.y-v.y,b.x-v.x)),ccw=normalize(angleB-angleA),startAngle=ccw<=Math.PI?angleA:angleB,sweep=ccw<=Math.PI?ccw:Math.PI*2-ccw
    const start=point({x:v.x+Math.cos(startAngle)*radius,y:v.y+Math.sin(startAngle)*radius}),endAngle=startAngle+sweep,end=point({x:v.x+Math.cos(endAngle)*radius,y:v.y+Math.sin(endAngle)*radius}),rayEndDistance=radius+style.extensionBeyond
    const ray=(sourceAngle)=>{const ux=Math.cos(sourceAngle),uy=Math.sin(sourceAngle);return Object.freeze([point({x:v.x+ux*style.extensionGap,y:v.y+uy*style.extensionGap}),point({x:v.x+ux*rayEndDistance,y:v.y+uy*rayEndDistance})])}
    const startTangent={x:start.x-Math.sin(startAngle),y:start.y+Math.cos(startAngle)},endTangent={x:end.x+Math.sin(endAngle),y:end.y-Math.cos(endAngle)},midAngle=startAngle+sweep/2,textRadius=radius+style.textGap,textPoint=point({x:v.x+Math.cos(midAngle)*textRadius,y:v.y+Math.sin(midAngle)*textRadius}),arc=Object.freeze({center:point(v),start,radius,startAngle,sweep})
    const lines=Object.freeze([ray(startAngle),ray(endAngle)]),triangles=Object.freeze([arrow(start,startTangent,style.arrowSize),arrow(end,endTangent,style.arrowSize)]),grips=Object.freeze(["firstRayPoint","vertex","secondRayPoint","dimensionArcPoint"].map(kind=>Object.freeze({kind,point:point(record[kind]),featureId:record[kind].featureId||null})))
    return Object.freeze({supported:true,measurement,lines,arcs:Object.freeze([arc]),triangles,text:Object.freeze({point:textPoint,rotation:readableRotation(midAngle+Math.PI/2),value:window.CaderactDimensionFormatter.format(measurement,style,units,record.textOverride),height:style.textHeight}),hitPrimitives:Object.freeze({lines,arcs:Object.freeze([arc])}),bounds:Object.freeze({minX:v.x-radius-style.extensionBeyond,minY:v.y-radius-style.extensionBeyond,maxX:v.x+radius+style.extensionBeyond,maxY:v.y+radius+style.extensionBeyond}),grips})
  }
  function derive(record, style, units) {
    if(record.type==="dimension-linear")return linear(record,style,units)
    if(record.type==="dimension-angular")return angular(record,style,units)
    return Object.freeze({supported:false,measurement:measure(record),reason:"presentation-deferred"})
  }
  window.CaderactDimensionGeometry=Object.freeze({measure,derive})
})()
