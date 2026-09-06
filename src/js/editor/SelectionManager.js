// D3: transient stable-ID selection and pure projected Line hit testing.
(() => {
  const DEFAULT_HIT_TOLERANCE_PX = 8
  const result = (status, details = {}) => Object.freeze({ status, ...details })

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
    function subscribe(listener){if(typeof listener!=="function")throw new Error("Selection listener must be a function");listeners.add(listener);return()=>listeners.delete(listener)}
    return Object.freeze({selectOnly,toggle,clear,has:id=>selected.has(id),selectedIds:snapshot,pruneAgainstDocument,subscribe})
  }
  window.CaderactSelection=Object.freeze({createSelection,hitTestLines,DEFAULT_HIT_TOLERANCE_PX})
})()
