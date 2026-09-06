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

  function createManager({ getRecords, getSelectedIds, worldToScreen, replaceRecord, adapter = lineAdapter, requestRender = () => {} }) {
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
      active = null
      const current = findRecord(session.grip.recordId)
      if (!adapter.resolves(current, session.grip)) {
        requestRender(); return Object.freeze({ status: "grip-target-missing" })
      }
      if (samePoint(adapter.currentPoint(current, session.grip), session.previewPoint)) {
        requestRender(); return Object.freeze({ status: "no-op" })
      }
      const replacement = adapter.replacement(current, session.grip, session.previewPoint)
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

  window.CaderactGrips = Object.freeze({ discoverLineGrips, hitTestGrips, createManager, lineAdapter })
})()
