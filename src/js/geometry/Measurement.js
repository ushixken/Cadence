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
  window.CaderactMeasurement=Object.freeze({pointToPoint,format})
})()
