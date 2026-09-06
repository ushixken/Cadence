// D8: finite side-count/center/radius-point Polygon draft publishing ordinary Lines.
(() => {
  const copy=point=>Object.freeze({x:point.x,y:point.y})
  function createSession({createSegment,commitSegments}){
    let sideCount=null,center=null,radiusPoint=null
    function clear(){sideCount=null;center=null;radiusPoint=null}
    function acceptSideCount(value){const parsed=window.CaderactPolygonGeometry.parseSideCount(value);if(parsed.valid)sideCount=parsed.value;return parsed}
    function updatePointer(point){if(center)radiusPoint=copy(point)}
    function clearPointer(){radiusPoint=null}
    function geometry(){return window.CaderactPolygonGeometry.derive(center,radiusPoint,sideCount)}
    function previewEdges(){return geometry()?.edges||Object.freeze([])}
    function acceptedPoints(){return Object.freeze(center?[copy(center)]:[])}
    function acceptPoint(point){
      if(sideCount===null)return Object.freeze({status:"side-count-required"})
      const accepted=copy(point)
      if(!center){center=accepted;radiusPoint=accepted;return Object.freeze({status:"center-accepted"})}
      radiusPoint=accepted;const derived=geometry()
      if(!derived)return Object.freeze({status:"zero-radius"})
      const records=derived.edges.map(edge=>createSegment(edge.start,edge.end)),outcome=commitSegments(records)
      if(outcome.status==="committed")clear()
      return outcome.status==="committed"?Object.freeze({status:"polygon-committed",recordIds:Object.freeze(records.map(record=>record.id))}):outcome
    }
    function finish(){clear();return Object.freeze({status:"no-op"})}
    function cancel(){clear();return Object.freeze({status:"cancelled"})}
    return Object.freeze({acceptSideCount,acceptPoint,updatePointer,clearPointer,geometry,previewEdges,acceptedPoints,finish,cancel,
      get sideCount(){return sideCount},get center(){return center},get radiusPoint(){return radiusPoint},
      get hasSideCount(){return sideCount!==null},get hasCenter(){return center!==null}})
  }
  window.CaderactPolygonDraftSession=Object.freeze({createSession})
})()
