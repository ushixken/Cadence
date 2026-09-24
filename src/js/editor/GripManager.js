(() => {
  const freezePoint = point => Object.freeze({ x: point.x, y: point.y })
  const samePoint = (a, b) => a.x === b.x && a.y === b.y

  function discoverLineGrips(records, selectedIds) {
    const selected = new Set(selectedIds)
    const grips = []
    for (const record of records) {
      if (record?.type !== "line" || !selected.has(record.id)) continue
      for (const endpoint of ["start", "end"]) {
        const point = record[endpoint]
        grips.push(Object.freeze({ recordId: record.id, featureId: point.featureId,
          kind: "endpoint", endpoint, point: freezePoint(point) }))
      }
    }
    grips.sort((a, b) => a.recordId.localeCompare(b.recordId) || a.featureId.localeCompare(b.featureId))
    return Object.freeze(grips)
  }

  function discoverPolylineGrips(records, selectedIds) {
    const selected = new Set(selectedIds), grips = []
    for (const record of records) {
      if (record?.type !== "polyline" || !selected.has(record.id)) continue
      for (const vertex of record.vertices) grips.push(Object.freeze({ recordId: record.id,
        featureId: vertex.featureId, kind: "vertex", point: freezePoint(vertex) }))
    }
    grips.sort((a, b) => a.recordId.localeCompare(b.recordId) || a.featureId.localeCompare(b.featureId))
    return Object.freeze(grips)
  }

  function discoverGeometryGrips(records, selectedIds) {
    return Object.freeze([...discoverLineGrips(records, selectedIds), ...discoverPolylineGrips(records, selectedIds), ...discoverTextGrips(records,selectedIds), ...discoverDimensionGrips(records,selectedIds), ...discoverRegionGrips(records,selectedIds), ...discoverBlockGrips(records,selectedIds)]
      .sort((a, b) => a.recordId.localeCompare(b.recordId) || a.featureId.localeCompare(b.featureId)))
  }

  function discoverDimensionGrips(records,selectedIds){const selected=new Set(selectedIds),grips=[];for(const record of records){if(!record?.type?.startsWith("dimension-")||!selected.has(record.id))continue;const style=window.caderactDocumentSession?.reader.resolveDimensionStyle(record)||window.CaderactDocument.DEFAULT_DIMENSION_STYLE,presentation=window.CaderactDimensionGeometry.derive(record,style,{length:"mm"});if(!presentation.supported)continue;for(const descriptor of presentation.grips)grips.push(Object.freeze({recordId:record.id,featureId:descriptor.featureId,kind:descriptor.kind,point:freezePoint(descriptor.point)}))}return Object.freeze(grips)}
  function discoverTextGrips(records,selectedIds){const selected=new Set(selectedIds);return Object.freeze(records.filter(record=>record?.type==="text"&&selected.has(record.id)).map(record=>Object.freeze({recordId:record.id,featureId:record.insertionPoint.featureId,kind:"insertionPoint",point:freezePoint(record.insertionPoint)})))}
  function discoverRegionGrips(records,selectedIds){const selected=new Set(selectedIds);return Object.freeze(records.filter(record=>(record?.type==="region"||record?.type==="hatch")&&selected.has(record.id)).map(record=>Object.freeze({recordId:record.id,featureId:record.id+":centroid",kind:"centroid",point:window.CaderactRegionGeometry.centroid(record)})))}
  function discoverBlockGrips(records,selectedIds){const selected=new Set(selectedIds);return Object.freeze(records.filter(record=>record?.type==="block-instance"&&selected.has(record.id)).map(record=>Object.freeze({recordId:record.id,featureId:record.insertionPoint.featureId,kind:"insertionPoint",point:freezePoint(record.insertionPoint)})))}

  const lineAdapter = Object.freeze({
    discover: discoverLineGrips,
    preview(record, grip, point) {
      return Object.freeze({ ...record, [grip.endpoint]: Object.freeze({
        ...record[grip.endpoint], x: point.x, y: point.y,
      }) })
    },
    replacement(record, grip, point) {
      return { ...record, [grip.endpoint]: {
        ...record[grip.endpoint], x: point.x, y: point.y,
      } }
    },
    resolves(record, grip) {
      return record?.type === "line" && record[grip.endpoint]?.featureId === grip.featureId
    },
    currentPoint(record, grip) { return record[grip.endpoint] },
  })

  function polylineVertex(record, grip) {
    return record?.type === "polyline" ? record.vertices.find(vertex => vertex.featureId === grip.featureId) : null
  }
  const polylineAdapter = Object.freeze({
    discover: discoverPolylineGrips,
    preview(record, grip, point) {
      return Object.freeze({ ...record, vertices: Object.freeze(record.vertices.map(vertex =>
        vertex.featureId === grip.featureId ? Object.freeze({ ...vertex, x: point.x, y: point.y }) : vertex)) })
    },
    replacement(record, grip, point) {
      return { ...record, vertices: record.vertices.map(vertex =>
        vertex.featureId === grip.featureId ? { ...vertex, x: point.x, y: point.y } : vertex) }
    },
    resolves(record, grip) { return Boolean(polylineVertex(record, grip)) },
    currentPoint: polylineVertex,
  })
  function dimensionPoint(record,grip){return record?.type?.startsWith("dimension-")&&record[grip.kind]?.featureId===grip.featureId?record[grip.kind]:null}
  function dimensionReplacement(record,grip,point){return{...record,[grip.kind]:{...record[grip.kind],x:point.x,y:point.y}}}
  function validDimension(record){if(record.type==="dimension-linear")return Math.hypot(record.secondPoint.x-record.firstPoint.x,record.secondPoint.y-record.firstPoint.y)>0;if(record.type==="dimension-angular"){const rays=window.CaderactAngularDimensionDraftSession.validateRays(record.firstRayPoint,record.vertex,record.secondRayPoint),radius=Math.hypot(record.dimensionArcPoint.x-record.vertex.x,record.dimensionArcPoint.y-record.vertex.y);return rays.valid&&radius>0}if(record.type==="dimension-radial")return Math.hypot(record.dimensionPoint.x-record.centerPoint.x,record.dimensionPoint.y-record.centerPoint.y)>0;if(record.type==="dimension-ordinate")return Number.isFinite(record.featurePoint?.x)&&Number.isFinite(record.leaderPoint?.x);if(record.type==="dimension-arc-length")return Math.abs(record.sweep)>0&&Math.hypot(record.startPoint.x-record.centerPoint.x,record.startPoint.y-record.centerPoint.y)>0;if(record.type==="dimension-center-mark")return Math.hypot(record.sizePoint.x-record.centerPoint.x,record.sizePoint.y-record.centerPoint.y)>0;if(record.type==="dimension-center-line")return Math.hypot(record.secondPoint.x-record.firstPoint.x,record.secondPoint.y-record.firstPoint.y)>0;return false}
  const dimensionAdapter=Object.freeze({discover:discoverDimensionGrips,preview:(record,grip,point)=>Object.freeze(dimensionReplacement(record,grip,point)),replacement:dimensionReplacement,resolves:(record,grip)=>Boolean(dimensionPoint(record,grip)),currentPoint:dimensionPoint,valid:validDimension})
  const textAdapter=Object.freeze({discover:discoverTextGrips,preview:(record,grip,point)=>Object.freeze({...record,insertionPoint:Object.freeze({...record.insertionPoint,x:point.x,y:point.y})}),replacement:(record,grip,point)=>({...record,insertionPoint:{...record.insertionPoint,x:point.x,y:point.y}}),resolves:(record,grip)=>record?.type==="text"&&record.insertionPoint?.featureId===grip.featureId,currentPoint:record=>record.insertionPoint,valid:record=>window.CaderactAnnotationGeometry.validate(record).length===0})
  const regionAdapter=Object.freeze({discover:discoverRegionGrips,preview:(record,grip,point)=>window.CaderactGeometryTransform.translateRecord(record,point.x-grip.point.x,point.y-grip.point.y),replacement:(record,grip,point)=>{const current=window.CaderactRegionGeometry.centroid(record);return window.CaderactGeometryTransform.translateRecord(record,point.x-current.x,point.y-current.y)},resolves:(record,grip)=>(record?.type==="region"||record?.type==="hatch")&&grip.featureId===record.id+":centroid",currentPoint:record=>window.CaderactRegionGeometry.centroid(record),valid:record=>(record.type==="hatch"?window.CaderactHatchGeometry:window.CaderactRegionGeometry).validate(record).length===0})
  const blockAdapter=Object.freeze({discover:discoverBlockGrips,preview:(record,grip,point)=>window.CaderactGeometryTransform.translateRecord(record,point.x-record.insertionPoint.x,point.y-record.insertionPoint.y),replacement:(record,grip,point)=>window.CaderactGeometryTransform.translateRecord(record,point.x-record.insertionPoint.x,point.y-record.insertionPoint.y),resolves:(record,grip)=>record?.type==="block-instance"&&record.insertionPoint.featureId===grip.featureId,currentPoint:record=>record.insertionPoint})
  const geometryAdapter = Object.freeze({
    discover: discoverGeometryGrips,
    target(record) { return record?.type === "line" ? lineAdapter : record?.type === "polyline" ? polylineAdapter : record?.type==="text"?textAdapter:record?.type==="region"||record?.type==="hatch"?regionAdapter:record?.type==="block-instance"?blockAdapter:record?.type?.startsWith("dimension-")?dimensionAdapter:null },
    preview(record, grip, point) { return this.target(record).preview(record, grip, point) },
    replacement(record, grip, point) { return this.target(record).replacement(record, grip, point) },
    resolves(record, grip) { return Boolean(this.target(record)?.resolves(record, grip)) },
    currentPoint(record, grip) { return this.target(record)?.currentPoint(record, grip) },
    valid(record){return this.target(record)?.valid?.(record)!==false},
  })

  function hitTestGrips({ screenPoint, grips, worldToScreen, tolerance = 8 }) {
    let best = null
    for (const grip of grips) {
      const projected = worldToScreen(grip.point.x, grip.point.y)
      const dx = projected.x - screenPoint.x, dy = projected.y - screenPoint.y
      const distanceSquared = dx * dx + dy * dy
      if (distanceSquared > tolerance * tolerance) continue
      if (!best || distanceSquared < best.distanceSquared) best = { grip, distanceSquared }
    }
    return best ? Object.freeze({ hit: true, grip: best.grip, distanceSquared: best.distanceSquared }) : Object.freeze({ hit: false })
  }

  function createManager({ getRecords, getSelectedIds, worldToScreen, replaceRecord, adapter = geometryAdapter, requestRender = () => {} }) {
    let hovered = null, active = null
    const key = grip => grip ? `${grip.recordId}:${grip.featureId}` : null
    const grips = () => adapter.discover(getRecords(), getSelectedIds())
    function findRecord(id) { return getRecords().find(record => record.id === id) || null }
    function findCurrentGrip(ref) { return grips().find(grip => key(grip) === key(ref)) || null }
    function setHover(next) {
      const value = next || null
      if (key(value) === key(hovered)) return false
      hovered = value; requestRender(); return true
    }
    function hit(screenPoint) { return hitTestGrips({ screenPoint, grips: grips(), worldToScreen }) }
    function updateHover(screenPoint) { return active ? false : setHover(hit(screenPoint).grip) }
    function begin(screenPoint, pointerId) {
      const result = hit(screenPoint)
      if (!result.hit) return result
      const record = findRecord(result.grip.recordId)
      active = Object.freeze({ grip: result.grip, pointerId, originalRecord: record,
        previewPoint: result.grip.point })
      hovered = null; requestRender()
      return Object.freeze({ status: "grip-edit-started", grip: result.grip })
    }
    function update(point) {
      if (!active || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return Object.freeze({ status: "no-active-grip" })
      active = Object.freeze({ ...active, previewPoint: freezePoint(point) }); requestRender()
      return Object.freeze({ status: "grip-preview-updated", point: active.previewPoint })
    }
    function previewRecord() {
      if (!active) return null
      return adapter.preview(active.originalRecord, active.grip, active.previewPoint)
    }
    function finish() {
      if (!active) return Object.freeze({ status: "no-active-grip" })
      const session = active
      const current = findRecord(session.grip.recordId)
      if (!adapter.resolves(current, session.grip)) {
        active = null
        requestRender(); return Object.freeze({ status: "grip-target-missing" })
      }
      if (samePoint(adapter.currentPoint(current, session.grip), session.previewPoint)) {
        active = null
        requestRender(); return Object.freeze({ status: "no-op" })
      }
      const replacement = adapter.replacement(current, session.grip, session.previewPoint)
      if(adapter.valid?.(replacement)===false){requestRender();return Object.freeze({status:"invalid-grip-edit"})}
      active = null
      const outcome = replaceRecord(current.id, replacement)
      requestRender()
      return Object.freeze({ status: "grip-edit-committed", outcome })
    }
    function cancel() {
      if (!active) return Object.freeze({ status: "no-active-grip" })
      active = null; requestRender()
      return Object.freeze({ status: "grip-edit-cancelled" })
    }
    function reconcile() {
      let outcome = Object.freeze({ status: "grips-reconciled" })
      if (active && !findCurrentGrip(active.grip)) outcome = cancel()
      if (hovered && !findCurrentGrip(hovered)) setHover(null)
      return outcome
    }
    function displayGrips() {
      const hoverKey = key(hovered), activeKey = active ? key(active.grip) : null
      return Object.freeze(grips().map(grip => Object.freeze({ ...grip,
        point: activeKey === key(grip) ? active.previewPoint : grip.point,
        state: activeKey === key(grip) ? "active" : hoverKey === key(grip) ? "hover" : "idle",
      })))
    }
    return Object.freeze({ grips, hit, updateHover, begin, update, finish, cancel, reconcile, displayGrips, previewRecord,
      get active() { return active }, get isActive() { return Boolean(active) } })
  }

  window.CaderactGrips = Object.freeze({ discoverLineGrips, discoverPolylineGrips, discoverTextGrips, discoverDimensionGrips, discoverRegionGrips, discoverBlockGrips, discoverGeometryGrips,
    hitTestGrips, createManager, lineAdapter, polylineAdapter, textAdapter, dimensionAdapter, blockAdapter, geometryAdapter })
})()
