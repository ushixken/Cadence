// D5A: connected transient Polyline vertices; one native record is allocated only at publication.
(() => {
  const copyPoint=point=>Object.freeze({x:point.x,y:point.y})
  const samePoint=(a,b)=>a?.x===b?.x&&a?.y===b?.y
  function createSession({createPolyline,commitRecords}){
    const points=[];let pointerPoint=null,persistentClose=false
    function clear(){points.length=0;pointerPoint=null;persistentClose=false}
    function acceptPoint(point){const accepted=copyPoint(point);if(!points.length){points.push(accepted);pointerPoint=accepted;return Object.freeze({status:"first-point"})}if(samePoint(points.at(-1),accepted))return Object.freeze({status:"repeated-point"});points.push(accepted);pointerPoint=accepted;return Object.freeze({status:"segment-added"})}
    function updatePointer(point){if(points.length)pointerPoint=copyPoint(point)}
    function clearPointer(){pointerPoint=null}
    function preview(){return points.length&&pointerPoint?Object.freeze({start:points.at(-1),end:pointerPoint}):null}
    function closingPreview(){if(!persistentClose||points.length<2)return null;const start=pointerPoint||points.at(-1);return Object.freeze({start,end:points[0]})}
    function previewEdges(){return Object.freeze([preview(),closingPreview()].filter(Boolean))}
    function draftSegments(){const result=[];for(let i=1;i<points.length;i++)result.push(Object.freeze({start:points[i-1],end:points[i]}));return Object.freeze(result)}
    function acceptedPoints(){return Object.freeze(points.map(copyPoint))}
    function canonicalPoints(closed){const result=points.slice();if(closed&&result.length>1&&samePoint(result[0],result.at(-1)))result.pop();return result}
    function publish(status,closed){const vertices=canonicalPoints(closed),minimum=closed?3:2;if(vertices.length<minimum)return Object.freeze({status:closed?"close-unavailable":"no-op"});const record=createPolyline(vertices,closed),outcome=commitRecords([record]);if(outcome.status!=="committed")return outcome;clear();return Object.freeze({status,recordId:record.id})}
    function finish(){return publish("polyline-committed",persistentClose)}
    function close(){return publish("polyline-closed",true)}
    function stepUndo(){pointerPoint=null;if(!points.length)return Object.freeze({status:"no-step"});points.pop();return Object.freeze({status:"step-undone",pointOnly:points.length===0})}
    function cancel(){clear();return Object.freeze({status:"cancelled"})}
    function setPersistentClose(enabled){persistentClose=Boolean(enabled);return Object.freeze({status:"option-updated",persistentClose})}
    return Object.freeze({acceptPoint,updatePointer,clearPointer,preview,closingPreview,previewEdges,draftSegments,acceptedPoints,finish,close,stepUndo,cancel,setPersistentClose,
      get pointCount(){return points.length},get segmentCount(){return Math.max(0,points.length-1)},get hasFirstPoint(){return points.length>0},get firstPoint(){return points[0]||null},get currentPoint(){return points.at(-1)||null},get canClose(){return canonicalPoints(true).length>=3},get persistentClose(){return persistentClose}})
  }
  window.CaderactPolylineDraftSession=Object.freeze({createSession,samePoint})
})()
