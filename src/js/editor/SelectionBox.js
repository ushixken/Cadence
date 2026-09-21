// D3A: pure screen-space Window/Crossing geometry queries and transient drag state.
(() => {
  const DRAG_THRESHOLD_PX = 4, EPSILON = 1e-5, CURVE_ERROR_PX = 0.25
  const normalizeRect = (a,b) => Object.freeze({ left:Math.min(a.x,b.x), right:Math.max(a.x,b.x),
    top:Math.min(a.y,b.y), bottom:Math.max(a.y,b.y) })
  const pointInRect = (point,rect) => point.x>=rect.left-EPSILON&&point.x<=rect.right+EPSILON&&point.y>=rect.top-EPSILON&&point.y<=rect.bottom+EPSILON
  function segmentIntersectsRect(a,b,rect){
    if(pointInRect(a,rect)||pointInRect(b,rect))return true
    const dx=b.x-a.x,dy=b.y-a.y
    let t0=0,t1=1
    for(const [p,q] of [[-dx,a.x-rect.left],[dx,rect.right-a.x],[-dy,a.y-rect.top],[dy,rect.bottom-a.y]]){
      if(Math.abs(p)<=EPSILON){if(q < -EPSILON)return false;continue}
      const t=q/p
      if(p<0){if(t>t1+EPSILON)return false;t0=Math.max(t0,t)}else{if(t<t0-EPSILON)return false;t1=Math.min(t1,t)}
    }
    return t0<=t1+EPSILON
  }
  function segmentsContained(segments,rect){
    if(!segments.length)return false
    for(let i=0;i<segments.length;i+=4)if(!pointInRect({x:segments[i],y:segments[i+1]},rect)||!pointInRect({x:segments[i+2],y:segments[i+3]},rect))return false
    return true
  }
  function segmentsCross(segments,rect){for(let i=0;i<segments.length;i+=4)if(segmentIntersectsRect({x:segments[i],y:segments[i+1]},{x:segments[i+2],y:segments[i+3]},rect))return true;return false}
  function projectedArc(record,worldToScreen){
    const center=worldToScreen(record.center.x,record.center.y),start=worldToScreen(record.start.x,record.start.y)
    return {center,radius:Math.hypot(start.x-center.x,start.y-center.y),startAngle:Math.atan2(start.y-center.y,start.x-center.x),sweep:-record.sweep}
  }
  function projectedEllipse(record,worldToScreen){
    const center=worldToScreen(record.center.x,record.center.y),axis=worldToScreen(record.center.x+record.majorAxis.x,record.center.y+record.majorAxis.y)
    return {center,radiusX:Math.hypot(axis.x-center.x,axis.y-center.y),radiusY:record.minorRadius*Math.hypot(axis.x-center.x,axis.y-center.y)/Math.hypot(record.majorAxis.x,record.majorAxis.y),rotation:Math.atan2(axis.y-center.y,axis.x-center.x)}
  }
  function recordMatches(record,rect,mode,worldToScreen){
    if(record?.type==="line"){
      const a=worldToScreen(record.start.x,record.start.y),b=worldToScreen(record.end.x,record.end.y)
      return mode==="window"?pointInRect(a,rect)&&pointInRect(b,rect):segmentIntersectsRect(a,b,rect)
    }
    if(record?.type==="polyline"){
      const vertices=record.vertices.map(vertex=>worldToScreen(vertex.x,vertex.y)),count=record.closed?vertices.length:vertices.length-1
      if(mode==="window")return vertices.every(vertex=>pointInRect(vertex,rect))
      for(let index=0;index<count;index++)if(segmentIntersectsRect(vertices[index],vertices[(index+1)%vertices.length],rect))return true
      return false
    }
    if(record?.type==="circle"){
      const center=worldToScreen(record.center.x,record.center.y),edge=worldToScreen(record.center.x+record.radius,record.center.y)
      const radius=Math.hypot(edge.x-center.x,edge.y-center.y)
      const contained=center.x-radius>=rect.left-EPSILON&&center.x+radius<=rect.right+EPSILON&&center.y-radius>=rect.top-EPSILON&&center.y+radius<=rect.bottom+EPSILON
      if(mode==="window"||contained)return contained
      const nearestX=Math.max(rect.left,Math.min(center.x,rect.right)),nearestY=Math.max(rect.top,Math.min(center.y,rect.bottom))
      const nearest=Math.hypot(nearestX-center.x,nearestY-center.y)
      const farthest=Math.max(...[[rect.left,rect.top],[rect.right,rect.top],[rect.right,rect.bottom],[rect.left,rect.bottom]].map(([x,y])=>Math.hypot(x-center.x,y-center.y)))
      return nearest<=radius+EPSILON&&farthest>=radius-EPSILON
    }
    if(record?.type==="text"){
      const corners=window.CaderactAnnotationGeometry.projectedCorners(record,worldToScreen);if(!corners.length)return false;const contained=corners.every(point=>pointInRect(point,rect));if(mode==="window"||contained)return contained;for(let index=0;index<4;index++)if(segmentIntersectsRect(corners[index],corners[(index+1)%4],rect))return true;return false
    }
    if(record?.type==="region"||record?.type==="hatch"){
      const values=[];for(const loop of record.loops)for(const edge of loop.edges){const points=window.CaderactRegionGeometry.sampleEdge(edge).map(world=>worldToScreen(world.x,world.y));for(let i=1;i<points.length;i++)values.push(points[i-1].x,points[i-1].y,points[i].x,points[i].y)}const segments=new Float32Array(values),contained=segmentsContained(segments,rect);return mode==="window"?contained:contained||segmentsCross(segments,rect)
    }
    if(record?.type?.startsWith("dimension-")){
      const presentation=window.CaderactDimensionGeometry.derive(record,window.caderactDocumentSession?.reader.resolveDimensionStyle(record)||window.CaderactDocument.DEFAULT_DIMENSION_STYLE,window.caderactDocumentSession?.reader.units()||{length:"mm"})
      if(!presentation.supported)return false
      const values=[]
      for(const [a,b] of presentation.lines){const start=worldToScreen(a.x,a.y),end=worldToScreen(b.x,b.y);values.push(start.x,start.y,end.x,end.y)}
      for(const arc of presentation.arcs||[]){const center=worldToScreen(arc.center.x,arc.center.y),start=worldToScreen(arc.start.x,arc.start.y),projected={center,radius:Math.hypot(start.x-center.x,start.y-center.y),startAngle:Math.atan2(start.y-center.y,start.x-center.x),sweep:-arc.sweep};values.push(...window.CaderactCircleTessellation.createArcSegments(projected))}
      for(const triangle of presentation.triangles)for(let index=0;index<3;index++){const a=worldToScreen(triangle[index].x,triangle[index].y),b=worldToScreen(triangle[(index+1)%3].x,triangle[(index+1)%3].y);values.push(a.x,a.y,b.x,b.y)}
      const anchor=worldToScreen(presentation.text.point.x,presentation.text.point.y),unit=worldToScreen(presentation.text.point.x+1,presentation.text.point.y),scale=Math.hypot(unit.x-anchor.x,unit.y-anchor.y),halfWidth=presentation.text.value.length*presentation.text.height*scale*.3,halfHeight=presentation.text.height*scale*.55,cosine=Math.cos(-presentation.text.rotation),sine=Math.sin(-presentation.text.rotation),corners=[[-halfWidth,-halfHeight],[halfWidth,-halfHeight],[halfWidth,halfHeight],[-halfWidth,halfHeight]].map(([x,y])=>({x:anchor.x+x*cosine-y*sine,y:anchor.y+x*sine+y*cosine}));for(let index=0;index<4;index++){const a=corners[index],b=corners[(index+1)%4];values.push(a.x,a.y,b.x,b.y)}
      const dimensionSegments=new Float32Array(values),contained=segmentsContained(dimensionSegments,rect)
      return mode==="window"?contained:contained||segmentsCross(dimensionSegments,rect)
    }
    let segments
    if(record?.type==="arc")segments=window.CaderactCircleTessellation.createArcSegments(projectedArc(record,worldToScreen))
    else if(record?.type==="ellipse")segments=window.CaderactEllipseTessellation.createSegments(projectedEllipse(record,worldToScreen),CURVE_ERROR_PX)
    else return false
    const contained=segmentsContained(segments,rect)
    return mode==="window"?contained:contained||segmentsCross(segments,rect)
  }
  function query({start,current,records=[],worldToScreen}){
    const rect=normalizeRect(start,current),mode=current.x>=start.x?"window":"crossing"
    const grouped=new Map();for(const record of records){const matches=recordMatches(record,rect,mode,worldToScreen),state=grouped.get(record.id)||{all:true,any:false};state.all=state.all&&matches;state.any=state.any||matches;grouped.set(record.id,state)}
    const recordIds=Array.from(grouped).filter(([,state])=>mode==="window"?state.all:state.any).map(([id])=>id).sort()
    return Object.freeze({mode,rect,recordIds:Object.freeze(recordIds)})
  }
  function createInteraction(){
    let state=null
    function begin(start,pointerId,modifier){state={start:Object.freeze({...start}),current:Object.freeze({...start}),pointerId,modifier:Boolean(modifier),active:false,mode:"window"};return snapshot()}
    function update(current){if(!state)return null;state.current=Object.freeze({...current});state.mode=current.x>=state.start.x?"window":"crossing";if(Math.hypot(current.x-state.start.x,current.y-state.start.y)>=DRAG_THRESHOLD_PX)state.active=true;return snapshot()}
    function clear(){const prior=snapshot();state=null;return prior}
    function snapshot(){return state?Object.freeze({start:state.start,current:state.current,pointerId:state.pointerId,modifier:state.modifier,active:state.active,mode:state.mode}):null}
    return Object.freeze({begin,update,clear,snapshot,get isPending(){return state!==null},get isActive(){return state?.active||false}})
  }
  window.CaderactSelectionBox=Object.freeze({createInteraction,query,normalizeRect,pointInRect,segmentIntersectsRect,recordMatches,DRAG_THRESHOLD_PX,EPSILON,CURVE_ERROR_PX})
})()
