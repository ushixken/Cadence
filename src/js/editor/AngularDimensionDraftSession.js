// D4: transient four-point workflow for native angular dimensions.
(() => {
  const ANGULAR_TOLERANCE=1e-12
  const freezePoint=value=>Object.freeze({x:value.x,y:value.y})
  function pointTolerance(...points){return Number.EPSILON*16*Math.max(1,...points.flatMap(point=>[Math.abs(point.x),Math.abs(point.y)]))}
  function samePoint(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<=pointTolerance(a,b)}
  function validateRays(firstRayPoint,vertex,secondRayPoint){
    if(samePoint(firstRayPoint,vertex)||samePoint(secondRayPoint,vertex))return Object.freeze({valid:false,reason:"degenerate-ray"})
    const measurement=window.CaderactMeasurement.measureIncludedAngle(firstRayPoint,vertex,secondRayPoint)
    if(!measurement.valid||measurement.angleRadians<=ANGULAR_TOLERANCE)return Object.freeze({valid:false,reason:"zero-angle"})
    if(Math.PI-measurement.angleRadians<=ANGULAR_TOLERANCE)return Object.freeze({valid:false,reason:"straight-angle"})
    return Object.freeze({valid:true,measurement})
  }
  function create({createRecord,commitRecords}){
    let points=[],candidate=null
    function preview(){if(points.length!==3||!candidate)return null;const rays=validateRays(...points),radius=Math.hypot(candidate.x-points[1].x,candidate.y-points[1].y);if(!rays.valid||radius<=pointTolerance(points[1],candidate))return null;return Object.freeze({type:"dimension-angular",firstRayPoint:points[0],vertex:points[1],secondRayPoint:points[2],dimensionArcPoint:candidate,textOverride:null})}
    function acceptPoint(value){
      const point=freezePoint(value)
      if(points.length===0){points=[point];candidate=null;return Object.freeze({status:"first-ray-accepted",point})}
      if(points.length===1){if(samePoint(points[0],point))return Object.freeze({status:"degenerate-first-ray"});points=[...points,point];candidate=null;return Object.freeze({status:"vertex-accepted",point})}
      if(points.length===2){const rays=validateRays(points[0],points[1],point);if(!rays.valid)return Object.freeze({status:rays.reason});points=[...points,point];candidate=null;return Object.freeze({status:"second-ray-accepted",point,measurement:rays.measurement})}
      candidate=point;const geometry=preview();if(!geometry)return Object.freeze({status:"invalid-placement-radius"});const record=createRecord(geometry),outcome=commitRecords([record]);if(outcome.status!=="committed")return Object.freeze({status:"commit-failed",outcome});points=[];candidate=null;return Object.freeze({status:"dimension-committed",record,outcome})
    }
    return Object.freeze({acceptPoint,updatePointer:value=>{candidate=value?freezePoint(value):null},clearPointer:()=>{candidate=null},cancel:()=>{points=[];candidate=null},preview,acceptedPoints:()=>Object.freeze(points.slice()),get phase(){return ["first-ray","vertex","second-ray","placement"][points.length]},get referencePoint(){return points.at(-1)||null}})
  }
  window.CaderactAngularDimensionDraftSession=Object.freeze({create,validateRays,ANGULAR_TOLERANCE})
})()
