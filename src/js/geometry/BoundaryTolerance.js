// R1: operation-scoped, model-space topology tolerance for boundary work.
(() => {
  const ABSOLUTE_FLOOR=1e-9,RELATIVE_FACTOR=1e-12,ULP_FACTOR=32
  function create(points=[]){
    const finite=Array.from(points||[]).filter(point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y))
    let minX=0,minY=0,maxX=0,maxY=0,maxCoordinate=1
    if(finite.length){minX=maxX=finite[0].x;minY=maxY=finite[0].y;for(const point of finite){minX=Math.min(minX,point.x);minY=Math.min(minY,point.y);maxX=Math.max(maxX,point.x);maxY=Math.max(maxY,point.y);maxCoordinate=Math.max(maxCoordinate,Math.abs(point.x),Math.abs(point.y))}}
    const extent=Math.hypot(maxX-minX,maxY-minY),linear=Math.max(ABSOLUTE_FLOOR,RELATIVE_FACTOR*Math.max(1,extent),ULP_FACTOR*Number.EPSILON*maxCoordinate)
    return Object.freeze({linear,parameter:Math.max(1e-12,linear/Math.max(1,extent)),area:linear*Math.max(1,extent),extent,maxCoordinate})
  }
  function samePoint(a,b,tolerance){return Number.isFinite(a?.x)&&Number.isFinite(a?.y)&&Number.isFinite(b?.x)&&Number.isFinite(b?.y)&&Math.hypot(a.x-b.x,a.y-b.y)<=tolerance.linear}
  window.CaderactBoundaryTolerance=Object.freeze({create,samePoint,ABSOLUTE_FLOOR,RELATIVE_FACTOR,ULP_FACTOR})
})()
