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
    if(record.type==="circle")return Object.freeze({type:"circle",radius:record.radius,diameter:record.radius*2,circumference:Math.PI*2*record.radius})
    if(record.type==="arc"){const sweepRadians=record.sweep,sweepDegrees=sweepRadians*180/Math.PI;return Object.freeze({type:"arc",radius:record.radius,diameter:record.radius*2,sweepRadians,sweepDegrees,arcLength:Math.abs(sweepRadians)*record.radius})}
    if(record.type==="polyline"){let length=0;const count=record.closed?record.vertices.length:Math.max(0,record.vertices.length-1);for(let index=0;index<count;index++){const a=record.vertices[index],b=record.vertices[(index+1)%record.vertices.length];length+=Math.hypot(b.x-a.x,b.y-a.y)}return Object.freeze({type:"polyline",length,vertexCount:record.vertices.length,closed:Boolean(record.closed)})}
    if(record.type==="ellipse"){const majorRadius=Math.hypot(record.majorAxis.x,record.majorAxis.y),minorRadius=record.minorRadius;return Object.freeze({type:"ellipse",majorRadius,minorRadius,majorDiameter:majorRadius*2,minorDiameter:minorRadius*2})}
    return null
  }
  function formatObject(result,field,unit,precision=3){const value=result?.[field];if(!Number.isFinite(value))return null;const labels={length:result.type==="polyline"?"Polyline Length":"Length",circumference:"Length",arcLength:"Arc Length",radius:"Radius",diameter:"Diameter"},label=labels[field];if(!label)return null;const formatted=window.CaderactUnits.format(value,unit,precision);return Object.freeze({field,label,value,formatted,summary:`${label} = ${formatted}`})}
  window.CaderactMeasurement=Object.freeze({pointToPoint,format,measureRecord,formatObject})
})()
