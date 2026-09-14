// D2: transient three-point workflow for native horizontal/vertical dimensions.
(() => {
  const freezePoint=value=>Object.freeze({x:value.x,y:value.y})
  function orientation(first,second,placement){
    const minX=Math.min(first.x,second.x),maxX=Math.max(first.x,second.x),minY=Math.min(first.y,second.y),maxY=Math.max(first.y,second.y)
    const horizontalOffset=Math.max(0,placement.y>maxY?placement.y-maxY:minY-placement.y)
    const verticalOffset=Math.max(0,placement.x>maxX?placement.x-maxX:minX-placement.x)
    return horizontalOffset>=verticalOffset?"horizontal":"vertical"
  }
  function create({createRecord,commitRecords}){
    let points=[],candidate=null
    function preview(){if(points.length!==2||!candidate)return null;return Object.freeze({type:"dimension-linear",mode:orientation(points[0],points[1],candidate),firstPoint:points[0],secondPoint:points[1],dimensionLinePoint:candidate,textOverride:null})}
    function acceptPoint(value){const point=freezePoint(value);if(points.length===0){points=[point];candidate=null;return Object.freeze({status:"first-accepted",point})}if(points.length===1){const tolerance=Number.EPSILON*16*Math.max(1,Math.abs(point.x),Math.abs(point.y),Math.abs(points[0].x),Math.abs(points[0].y));if(Math.hypot(point.x-points[0].x,point.y-points[0].y)<=tolerance)return Object.freeze({status:"degenerate-points"});points=[...points,point];candidate=null;return Object.freeze({status:"second-accepted",point})}candidate=point;const geometry=preview(),record=createRecord(geometry),outcome=commitRecords([record]);if(outcome.status!=="committed")return Object.freeze({status:"commit-failed",outcome});points=[];candidate=null;return Object.freeze({status:"dimension-committed",record,outcome})}
    return Object.freeze({acceptPoint,updatePointer:value=>{candidate=value?freezePoint(value):null},clearPointer:()=>{candidate=null},cancel:()=>{points=[];candidate=null},preview,acceptedPoints:()=>Object.freeze(points.slice()),get phase(){return points.length===0?"first":points.length===1?"second":"placement"},get referencePoint(){return points.at(-1)||null}})
  }
  window.CaderactLinearDimensionDraftSession=Object.freeze({create,orientation})
})()
