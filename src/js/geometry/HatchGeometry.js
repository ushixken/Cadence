// R5: pure semantic Solid Hatch validation, flattening and deterministic triangulation.
(() => {
  const MAX_VERTICES=100000,MAX_TRIANGLES=250000,TAU=Math.PI*2
  const point=value=>Object.freeze({x:value.x,y:value.y})
  function validate(record){const errors=[];for(const error of window.CaderactHatchPatterns.validate(record?.pattern))errors.push(`Hatch: ${error}`);for(const error of window.CaderactRegionGeometry.validate(record))errors.push(error.replace(/^Region:/,"Hatch:"));return errors}
  function flatten(record,{tolerance}={}){
    if(validate(record).length)return Object.freeze({valid:false,reason:"invalid-boundary"})
    const bounds=window.CaderactRegionGeometry.bounds(record),span=Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY,1),error=Number.isFinite(tolerance)&&tolerance>0?tolerance:span/4096,contours=[]
    let vertexCount=0
    for(const loop of record.loops){const points=[];for(const edge of loop.edges){let segments=1;if(edge.kind!=="line"){const radius=edge.kind==="ellipse"?Math.max(Math.hypot(edge.majorAxis.x,edge.majorAxis.y),edge.minorRadius):edge.radius,angle=edge.kind==="arc"?Math.abs(edge.sweep):TAU,step=2*Math.acos(Math.max(-1,Math.min(1,1-error/Math.max(radius,error))));segments=Math.max(4,Math.ceil(angle/Math.max(step,1e-12)))}if(vertexCount+points.length+segments>MAX_VERTICES)return Object.freeze({valid:false,reason:"vertex-limit"});for(let i=0;i<segments;i++){const parameter=(edge.kind==="circle"||edge.kind==="ellipse"?TAU:1)*i/segments,p=window.CaderactBoundaryGeometry.evaluate(edge,parameter);if(!points.length||p.x!==points.at(-1).x||p.y!==points.at(-1).y)points.push(point(p))}}vertexCount+=points.length;contours.push(Object.freeze({depth:loop.depth,parentIndex:loop.parentIndex,points:Object.freeze(points)}))}
    return Object.freeze({valid:true,contours:Object.freeze(contours),tolerance:error,vertexCount})
  }
  // Horizontal monotone-band decomposition. Between consecutive vertex Y values
  // every flattened edge is linear and parity is constant, so paired crossings
  // form deterministic trapezoids that naturally preserve holes and islands.
  function triangulate(record,options={}){
    const flat=flatten(record,options);if(!flat.valid)return flat
    const edges=[],ys=[];for(const contour of flat.contours){const p=contour.points;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];ys.push(a.y);if(a.y!==b.y)edges.push({a,b,key:`${Math.min(a.x,b.x)},${Math.min(a.y,b.y)},${Math.max(a.x,b.x)},${Math.max(a.y,b.y)}`})}}
    const levels=Array.from(new Set(ys)).sort((a,b)=>a-b),triangles=[]
    for(let band=1;band<levels.length;band++){const y0=levels[band-1],y1=levels[band];if(!(y1>y0))continue;const ym=(y0+y1)/2,active=edges.filter(edge=>(edge.a.y<=ym&&edge.b.y>ym)||(edge.b.y<=ym&&edge.a.y>ym)).map(edge=>{const x=y=>edge.a.x+(edge.b.x-edge.a.x)*(y-edge.a.y)/(edge.b.y-edge.a.y);return{edge,xm:x(ym),x0:x(y0),x1:x(y1)}}).sort((a,b)=>a.xm-b.xm||a.edge.key.localeCompare(b.edge.key));if(active.length%2)return Object.freeze({valid:false,reason:"triangulation-parity"});for(let i=0;i<active.length;i+=2){const left=active[i],right=active[i+1],a=point({x:left.x0,y:y0}),b=point({x:right.x0,y:y0}),c=point({x:right.x1,y:y1}),d=point({x:left.x1,y:y1}),candidates=[[a,b,c],[a,c,d]];for(const values of candidates){const area=Math.abs((values[1].x-values[0].x)*(values[2].y-values[0].y)-(values[1].y-values[0].y)*(values[2].x-values[0].x))/2;if(area>Number.EPSILON*spanOf(values)){triangles.push(Object.freeze(values));if(triangles.length>MAX_TRIANGLES)return Object.freeze({valid:false,reason:"triangle-limit"})}}}}
    return triangles.length?Object.freeze({valid:true,triangles:Object.freeze(triangles),contours:flat.contours,tolerance:flat.tolerance}):Object.freeze({valid:false,reason:"triangulation-empty"})
  }
  function spanOf(points){return Math.max(1,...points.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]))}
  const classifyPoint=(record,value)=>window.CaderactRegionGeometry.classifyPoint(record,value)
  const measure=record=>window.CaderactRegionGeometry.measure(record)
  const centroid=record=>window.CaderactRegionGeometry.centroid(record)
  const generatePattern=record=>window.CaderactHatchPatterns.generate(record)
  window.CaderactHatchGeometry=Object.freeze({MAX_VERTICES,MAX_TRIANGLES,validate,flatten,triangulate,generatePattern,classifyPoint,measure,centroid})
})()
