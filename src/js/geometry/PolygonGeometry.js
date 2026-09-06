// D8: pure regular inscribed Polygon geometry.
(() => {
  const MIN_SIDES=3,MAX_SIDES=1024,DEFAULT_SIDES=4,TAU=Math.PI*2
  const point=value=>Object.freeze({x:value.x,y:value.y})
  function parseSideCount(value){
    const text=String(value??"").trim()
    if(text==="")return Object.freeze({valid:true,value:DEFAULT_SIDES,usedDefault:true})
    if(!/^[+]?[0-9]+$/.test(text))return Object.freeze({valid:false,reason:"integer-required"})
    const count=Number(text)
    if(!Number.isSafeInteger(count)||count<MIN_SIDES||count>MAX_SIDES)return Object.freeze({valid:false,reason:"side-count-out-of-range"})
    return Object.freeze({valid:true,value:count,usedDefault:false})
  }
  function derive(center,radiusPoint,sideCount){
    if(!Number.isInteger(sideCount)||sideCount<MIN_SIDES||sideCount>MAX_SIDES||
      !Number.isFinite(center?.x)||!Number.isFinite(center?.y)||!Number.isFinite(radiusPoint?.x)||!Number.isFinite(radiusPoint?.y))return null
    const radius=Math.hypot(radiusPoint.x-center.x,radiusPoint.y-center.y)
    if(!Number.isFinite(radius)||radius<=0)return null
    const angle0=Math.atan2(radiusPoint.y-center.y,radiusPoint.x-center.x),vertices=[]
    for(let index=0;index<sideCount;index++)vertices.push(point(index===0?radiusPoint:{
      x:center.x+radius*Math.cos(angle0+index*TAU/sideCount),y:center.y+radius*Math.sin(angle0+index*TAU/sideCount)}))
    const frozenVertices=Object.freeze(vertices)
    const edges=Object.freeze(vertices.map((start,index)=>Object.freeze({start,end:vertices[(index+1)%sideCount]})))
    return Object.freeze({sideCount,center:point(center),radiusPoint:point(radiusPoint),radius,angle0,vertices:frozenVertices,edges})
  }
  window.CaderactPolygonGeometry=Object.freeze({parseSideCount,derive,MIN_SIDES,MAX_SIDES,DEFAULT_SIDES})
})()
