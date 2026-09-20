// D3: transient stable-ID selection and pure projected Line hit testing.
(() => {
  const DEFAULT_HIT_TOLERANCE_PX = 8
  const result = (status, details = {}) => Object.freeze({ status, ...details })
  function segmentDistance(point,x1,y1,x2,y2){
    const dx=x2-x1,dy=y2-y1,lengthSquared=dx*dx+dy*dy
    const t=lengthSquared===0?0:Math.max(0,Math.min(1,((point.x-x1)*dx+(point.y-y1)*dy)/lengthSquared))
    return Math.hypot(point.x-(x1+t*dx),point.y-(y1+t*dy))
  }

  function hitTestLines({ screenPoint, records = [], worldToScreen, tolerancePx = DEFAULT_HIT_TOLERANCE_PX }) {
    if (!Number.isFinite(screenPoint?.x) || !Number.isFinite(screenPoint?.y) || typeof worldToScreen !== "function") {
      return result("invalid-hit-test")
    }
    const hits = []
    for (const record of Array.from(records).filter(record => record?.type === "line").sort((a, b) => a.id.localeCompare(b.id))) {
      const start = worldToScreen(record.start.x, record.start.y), end = worldToScreen(record.end.x, record.end.y)
      if (![start.x,start.y,end.x,end.y].every(Number.isFinite)) continue
      const dx = end.x-start.x, dy = end.y-start.y, lengthSquared = dx*dx+dy*dy
      const projection = lengthSquared === 0 ? 0 : Math.max(0,Math.min(1,
        ((screenPoint.x-start.x)*dx+(screenPoint.y-start.y)*dy)/lengthSquared))
      const nearestX=start.x+projection*dx, nearestY=start.y+projection*dy
      const distancePx=Math.hypot(screenPoint.x-nearestX,screenPoint.y-nearestY)
      if (Number.isFinite(distancePx) && distancePx <= tolerancePx) hits.push({recordId:record.id,distancePx})
    }
    hits.sort((a,b)=>a.distancePx-b.distancePx||a.recordId.localeCompare(b.recordId))
    return hits.length ? result("hit",{hit:true,recordId:hits[0].recordId,distancePx:hits[0].distancePx}) : result("miss",{hit:false})
  }

  function hitTestRecords({ screenPoint, records = [], worldToScreen, screenToWorld, tolerancePx = DEFAULT_HIT_TOLERANCE_PX }) {
    if (!Number.isFinite(screenPoint?.x) || !Number.isFinite(screenPoint?.y) || typeof worldToScreen !== "function") {
      return result("invalid-hit-test")
    }
    const hits = []
    for (const record of Array.from(records).sort((a, b) => a.id.localeCompare(b.id))) {
      if (record?.type === "line") {
        const hit = hitTestLines({ screenPoint, records: [record], worldToScreen, tolerancePx })
        if (hit.hit) hits.push({ recordId: record.id, distancePx: hit.distancePx })
      } else if(record?.type === "polyline"){
        let distancePx=Infinity,count=record.closed?record.vertices.length:record.vertices.length-1
        for(let index=0;index<count;index++){const start=worldToScreen(record.vertices[index].x,record.vertices[index].y),end=worldToScreen(record.vertices[(index+1)%record.vertices.length].x,record.vertices[(index+1)%record.vertices.length].y);distancePx=Math.min(distancePx,segmentDistance(screenPoint,start.x,start.y,end.x,end.y))}
        if(distancePx<=tolerancePx)hits.push({recordId:record.id,distancePx})
      } else if (record?.type === "circle") {
        const center = worldToScreen(record.center.x, record.center.y)
        const radiusPoint = worldToScreen(record.center.x + record.radius, record.center.y)
        const radiusPx = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)
        const distancePx = Math.abs(Math.hypot(screenPoint.x - center.x, screenPoint.y - center.y) - radiusPx)
        if ([center.x, center.y, radiusPx, distancePx].every(Number.isFinite) && distancePx <= tolerancePx) {
          hits.push({ recordId: record.id, distancePx })
        }
      } else if (record?.type === "arc") {
        const center=worldToScreen(record.center.x,record.center.y), start=worldToScreen(record.start.x,record.start.y)
        const radiusPx=Math.hypot(start.x-center.x,start.y-center.y)
        const distancePx=Math.abs(Math.hypot(screenPoint.x-center.x,screenPoint.y-center.y)-radiusPx)
        const worldAngle=Math.atan2(-(screenPoint.y-center.y),screenPoint.x-center.x)
        const startAngle=Math.atan2(record.start.y-record.center.y,record.start.x-record.center.x)
        if ([center.x,center.y,radiusPx,distancePx,worldAngle,startAngle].every(Number.isFinite)
            && distancePx<=tolerancePx && window.CaderactArcGeometry.angleOnSweep(worldAngle,startAngle,record.sweep)) {
          hits.push({recordId:record.id,distancePx})
        }
      } else if(record?.type === "ellipse"){
        const center=worldToScreen(record.center.x,record.center.y)
        const axisEnd=worldToScreen(record.center.x+record.majorAxis.x,record.center.y+record.majorAxis.y)
        const minorEnd=worldToScreen(record.center.x-record.majorAxis.y/Math.hypot(record.majorAxis.x,record.majorAxis.y)*record.minorRadius,
          record.center.y+record.majorAxis.x/Math.hypot(record.majorAxis.x,record.majorAxis.y)*record.minorRadius)
        const projected={center,radiusX:Math.hypot(axisEnd.x-center.x,axisEnd.y-center.y),radiusY:Math.hypot(minorEnd.x-center.x,minorEnd.y-center.y),
          rotation:Math.atan2(axisEnd.y-center.y,axisEnd.x-center.x)}
        const segments=window.CaderactEllipseTessellation.createSegments(projected)
        let distancePx=Infinity
        for(let index=0;index<segments.length;index+=4)distancePx=Math.min(distancePx,segmentDistance(screenPoint,...segments.slice(index,index+4)))
        if(distancePx<=tolerancePx)hits.push({recordId:record.id,distancePx})
      } else if(record?.type==="region"||record?.type==="hatch"){
        let distancePx=Infinity
        for(const loop of record.loops)for(const edge of loop.edges){const sampled=window.CaderactRegionGeometry.sampleEdge(edge).map(world=>worldToScreen(world.x,world.y));for(let i=1;i<sampled.length;i++){const a=sampled[i-1],b=sampled[i];distancePx=Math.min(distancePx,segmentDistance(screenPoint,a.x,a.y,b.x,b.y))}}
        const worldPoint=typeof screenToWorld==="function"?screenToWorld(screenPoint.x,screenPoint.y):null,inside=worldPoint?window.CaderactRegionGeometry.classifyPoint(record,worldPoint)==="inside":false
        if(distancePx<=tolerancePx||inside)hits.push({recordId:record.id,distancePx:inside?0:distancePx})
      } else if(record?.type==="text"){
        const corners=window.CaderactAnnotationGeometry.projectedCorners(record,worldToScreen);if(corners.length){let distancePx=Infinity;for(let index=0;index<4;index++){const a=corners[index],b=corners[(index+1)%4];distancePx=Math.min(distancePx,segmentDistance(screenPoint,a.x,a.y,b.x,b.y))}let sign=null,inside=true;for(let index=0;index<4;index++){const a=corners[index],b=corners[(index+1)%4],cross=(b.x-a.x)*(screenPoint.y-a.y)-(b.y-a.y)*(screenPoint.x-a.x);if(Math.abs(cross)<1e-9)continue;const next=Math.sign(cross);if(sign===null)sign=next;else if(sign!==next){inside=false;break}}if(inside)distancePx=0;if(distancePx<=tolerancePx)hits.push({recordId:record.id,distancePx})}
      } else if(record?.type?.startsWith("dimension-")){
        const presentation=window.CaderactDimensionGeometry.derive(record,window.caderactDocumentSession?.reader.resolveDimensionStyle(record)||window.CaderactDocument.DEFAULT_DIMENSION_STYLE,window.caderactDocumentSession?.reader.units()||{length:"mm"})
        if(!presentation.supported)continue
        let distancePx=Infinity
        for(const [a,b] of presentation.lines){const start=worldToScreen(a.x,a.y),end=worldToScreen(b.x,b.y);distancePx=Math.min(distancePx,segmentDistance(screenPoint,start.x,start.y,end.x,end.y))}
        for(const arc of presentation.arcs||[]){const center=worldToScreen(arc.center.x,arc.center.y),start=worldToScreen(arc.start.x,arc.start.y),projected={center,radius:Math.hypot(start.x-center.x,start.y-center.y),startAngle:Math.atan2(start.y-center.y,start.x-center.x),sweep:-arc.sweep},segments=window.CaderactCircleTessellation.createArcSegments(projected);for(let index=0;index<segments.length;index+=4)distancePx=Math.min(distancePx,segmentDistance(screenPoint,...segments.slice(index,index+4)))}
        for(const triangle of presentation.triangles)for(let index=0;index<3;index++){const a=worldToScreen(triangle[index].x,triangle[index].y),b=worldToScreen(triangle[(index+1)%3].x,triangle[(index+1)%3].y);distancePx=Math.min(distancePx,segmentDistance(screenPoint,a.x,a.y,b.x,b.y))}
        const anchor=worldToScreen(presentation.text.point.x,presentation.text.point.y),unit=worldToScreen(presentation.text.point.x+1,presentation.text.point.y),scale=Math.hypot(unit.x-anchor.x,unit.y-anchor.y),rotation=-presentation.text.rotation,cosine=Math.cos(rotation),sine=Math.sin(rotation),rx=(screenPoint.x-anchor.x)*cosine+(screenPoint.y-anchor.y)*sine,ry=-(screenPoint.x-anchor.x)*sine+(screenPoint.y-anchor.y)*cosine,halfWidth=presentation.text.value.length*presentation.text.height*scale*.3,halfHeight=presentation.text.height*scale*.55,textDistance=Math.hypot(Math.max(0,Math.abs(rx)-halfWidth),Math.max(0,Math.abs(ry)-halfHeight))
        distancePx=Math.min(distancePx,textDistance)
        if(distancePx<=tolerancePx)hits.push({recordId:record.id,distancePx})
      }
    }
    hits.sort((a,b)=>a.distancePx-b.distancePx||a.recordId.localeCompare(b.recordId))
    return hits.length ? result("hit",{hit:true,recordId:hits[0].recordId,distancePx:hits[0].distancePx}) : result("miss",{hit:false})
  }

  function createSelection() {
    const selected = new Set(), listeners = new Set()
    const snapshot = () => Object.freeze(Array.from(selected).sort())
    function publish(status) {
      const ids=snapshot()
      for(const listener of listeners) try{listener(ids)}catch(error){console.warn("Caderact selection observer failed",error)}
      return result(status,{selectedIds:ids})
    }
    function selectOnly(recordId) {
      if(typeof recordId!=="string"||!recordId)return result("invalid-selection")
      if(selected.size===1&&selected.has(recordId))return result("selection-unchanged",{selectedIds:snapshot()})
      selected.clear();selected.add(recordId);return publish("selected")
    }
    function toggle(recordId) {
      if(typeof recordId!=="string"||!recordId)return result("invalid-selection")
      if(selected.has(recordId))selected.delete(recordId);else selected.add(recordId)
      return publish("selection-toggled")
    }
    function clear() {
      if(selected.size===0)return result("selection-unchanged",{selectedIds:snapshot()})
      selected.clear();return publish("selection-cleared")
    }
    function pruneAgainstDocument(records) {
      const valid=new Set(Array.from(records,record=>record.id));let changed=false
      for(const id of selected)if(!valid.has(id)){selected.delete(id);changed=true}
      return changed?publish("selection-pruned"):result("selection-unchanged",{selectedIds:snapshot()})
    }
    function applyRecordIds(recordIds,{toggle=false}={}){
      const ids=Array.from(new Set(recordIds)).filter(id=>typeof id==="string"&&id),sorted=Object.freeze(ids.slice().sort())
      if(toggle){if(ids.length===0)return result("selection-unchanged",{selectedIds:snapshot()});for(const id of ids)selected.has(id)?selected.delete(id):selected.add(id)}
      else{const current=snapshot();if(current.length===sorted.length&&current.every((id,index)=>id===sorted[index]))return result("selection-unchanged",{selectedIds:current});selected.clear();for(const id of ids)selected.add(id)}
      return publish(toggle?"selection-toggled":"selection-replaced")
    }
    function subscribe(listener){if(typeof listener!=="function")throw new Error("Selection listener must be a function");listeners.add(listener);return()=>listeners.delete(listener)}
    return Object.freeze({selectOnly,toggle,clear,applyRecordIds,has:id=>selected.has(id),selectedIds:snapshot,orderedIds:()=>Object.freeze(Array.from(selected)),pruneAgainstDocument,subscribe})
  }
  window.CaderactSelection=Object.freeze({createSelection,hitTestLines,hitTestRecords,DEFAULT_HIT_TOLERANCE_PX})
})()
