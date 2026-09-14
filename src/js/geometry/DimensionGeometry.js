// Pure native-dimension measurement and renderer-neutral presentation geometry.
(() => {
  const point = value => Object.freeze({ x: value.x, y: value.y })
  function measure(record) {
    if (record.type === "dimension-linear") {
      const dx=record.secondPoint.x-record.firstPoint.x,dy=record.secondPoint.y-record.firstPoint.y
      return Object.freeze({kind:"linear",value:record.mode==="horizontal"?Math.abs(dx):record.mode==="vertical"?Math.abs(dy):Math.hypot(dx,dy)})
    }
    if (record.type === "dimension-angular") {
      const a=Math.atan2(record.firstRayPoint.y-record.vertex.y,record.firstRayPoint.x-record.vertex.x),b=Math.atan2(record.secondRayPoint.y-record.vertex.y,record.secondRayPoint.x-record.vertex.x)
      let value=(b-a)%(Math.PI*2);if(value<0)value+=Math.PI*2;if(value>Math.PI)value=Math.PI*2-value
      return Object.freeze({kind:"angular",value})
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
  function derive(record, style, units) {
    if(record.type==="dimension-linear")return linear(record,style,units)
    return Object.freeze({supported:false,measurement:measure(record),reason:"presentation-deferred"})
  }
  window.CaderactDimensionGeometry=Object.freeze({measure,derive})
})()
