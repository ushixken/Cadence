// ME1: pure model-space point measurement and presentation boundary.
(() => {
  const freezePoint=value=>Object.freeze({x:value.x,y:value.y})
  function pointToPoint(start,end){
    if(!Number.isFinite(start?.x)||!Number.isFinite(start?.y)||!Number.isFinite(end?.x)||!Number.isFinite(end?.y))throw new Error("Measurement points must be finite")
    const deltaX=end.x-start.x,deltaY=end.y-start.y,distance=Math.hypot(deltaX,deltaY)
    const raw=distance===0?null:Math.atan2(deltaY,deltaX),angleRadians=raw===null?null:(raw<0?raw+Math.PI*2:raw)
    return Object.freeze({start:freezePoint(start),end:freezePoint(end),deltaX,deltaY,distance,angleRadians,angleDegrees:angleRadians===null?null:angleRadians*180/Math.PI})
  }
  function format(result,unit,precision=3){const length=value=>window.CaderactUnits.format(value,unit,precision),angle=result.angleDegrees===null?"—":`${result.angleDegrees.toFixed(precision)}°`;return Object.freeze({distance:length(result.distance),deltaX:length(result.deltaX),deltaY:length(result.deltaY),angle,start:`${length(result.start.x)}, ${length(result.start.y)}`,end:`${length(result.end.x)}, ${length(result.end.y)}`,summary:`Distance = ${length(result.distance)}; ΔX = ${length(result.deltaX)}; ΔY = ${length(result.deltaY)}; Angle = ${angle}`})}
  function measureRecord(record){
    if(!record||typeof record!=="object")return null
    if(record.type==="line")return Object.freeze({type:"line",length:Math.hypot(record.end.x-record.start.x,record.end.y-record.start.y)})
    if(record.type==="circle"){const circumference=Math.PI*2*record.radius;return Object.freeze({type:"circle",radius:record.radius,diameter:record.radius*2,circumference,perimeter:circumference,area:Math.PI*record.radius*record.radius})}
    if(record.type==="arc"){const sweepRadians=record.sweep,sweepDegrees=sweepRadians*180/Math.PI;return Object.freeze({type:"arc",radius:record.radius,diameter:record.radius*2,sweepRadians,sweepDegrees,arcLength:Math.abs(sweepRadians)*record.radius})}
    if(record.type==="polyline"){let length=0;const count=record.closed?record.vertices.length:Math.max(0,record.vertices.length-1);for(let index=0;index<count;index++){const a=record.vertices[index],b=record.vertices[(index+1)%record.vertices.length];length+=Math.hypot(b.x-a.x,b.y-a.y)}const base={type:"polyline",length,vertexCount:record.vertices.length,closed:Boolean(record.closed)};if(!record.closed)return Object.freeze(base);const vertices=record.vertices.length>1&&samePoint(record.vertices[0],record.vertices.at(-1))?record.vertices.slice(0,-1):record.vertices,signedArea=shoelace(vertices),selfIntersecting=hasSelfIntersection(vertices);return Object.freeze({...base,perimeter:length,signedArea,selfIntersecting,...(!selfIntersecting?{area:Math.abs(signedArea)}:{})})}
    if(record.type==="ellipse"){const majorRadius=Math.hypot(record.majorAxis.x,record.majorAxis.y),minorRadius=record.minorRadius;return Object.freeze({type:"ellipse",majorRadius,minorRadius,majorDiameter:majorRadius*2,minorDiameter:minorRadius*2,area:Math.PI*majorRadius*minorRadius})}
    return null
  }
  function samePoint(a,b){return a.x===b.x&&a.y===b.y}
  function shoelace(vertices){let twice=0;for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length];twice+=a.x*b.y-b.x*a.y}return twice/2}
  function onSegment(a,b,p,tolerance){return p.x>=Math.min(a.x,b.x)-tolerance&&p.x<=Math.max(a.x,b.x)+tolerance&&p.y>=Math.min(a.y,b.y)-tolerance&&p.y<=Math.max(a.y,b.y)+tolerance}
  function segmentsIntersect(a,b,c,d){const scale=Math.max(1,Math.abs(a.x),Math.abs(a.y),Math.abs(b.x),Math.abs(b.y),Math.abs(c.x),Math.abs(c.y),Math.abs(d.x),Math.abs(d.y)),tolerance=(window.CaderactIntersectionClassifier?.LINEAR_TOLERANCE||1e-9)*scale,cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x),o1=cross(a,b,c),o2=cross(a,b,d),o3=cross(c,d,a),o4=cross(c,d,b);if(((o1>tolerance&&o2< -tolerance)||(o1< -tolerance&&o2>tolerance))&&((o3>tolerance&&o4< -tolerance)||(o3< -tolerance&&o4>tolerance)))return true;return Math.abs(o1)<=tolerance&&onSegment(a,b,c,tolerance)||Math.abs(o2)<=tolerance&&onSegment(a,b,d,tolerance)||Math.abs(o3)<=tolerance&&onSegment(c,d,a,tolerance)||Math.abs(o4)<=tolerance&&onSegment(c,d,b,tolerance)}
  function hasSelfIntersection(vertices){const count=vertices.length;if(count<3)return false;for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){if(j===i+1||(i===0&&j===count-1))continue;if(segmentsIntersect(vertices[i],vertices[(i+1)%count],vertices[j],vertices[(j+1)%count]))return true}return false}
  function formatObject(result,field,unit,precision=3){const value=result?.[field];if(!Number.isFinite(value))return null;const labels={length:result.type==="polyline"?"Polyline Length":"Length",circumference:"Length",arcLength:"Arc Length",radius:"Radius",diameter:"Diameter",perimeter:"Perimeter",area:"Area"},label=labels[field];if(!label)return null;const formatted=field==="area"?window.CaderactUnits.formatArea(value,unit,precision):window.CaderactUnits.format(value,unit,precision);let summary=`${label} = ${formatted}`;if(field==="area"&&Number.isFinite(result.perimeter))summary+=`; Perimeter = ${window.CaderactUnits.format(result.perimeter,unit,precision)}`;return Object.freeze({field,label,value,formatted,summary})}
  window.CaderactMeasurement=Object.freeze({pointToPoint,format,measureRecord,formatObject})
})()
