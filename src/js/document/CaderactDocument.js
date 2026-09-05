// Stage 2: a data boundary, not the future transaction/history controller.
(() => {
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value)
  const has = (table, key) => Object.prototype.hasOwnProperty.call(table, key)

  function validateDocument(value) {
    const errors = [], ids = new Set()
    function identity(id, label) {
      if (typeof id !== "string" || id.trim() === "") errors.push(`${label}: missing ID`)
      else if (ids.has(id)) errors.push(`${label}: duplicate ID ${id}`)
      else ids.add(id)
    }
    function point(value, label) {
      if (!isRecord(value) || !Number.isFinite(value.x) || !Number.isFinite(value.y)) errors.push(`${label}: invalid finite point`)
    }
    if (!isRecord(value)) return ["Invalid document"]
    identity(value.id, "document")
    if (value.formatVersion !== 1) errors.push("Unsupported formatVersion")
    if (typeof value.name !== "string") errors.push("Invalid document name")
    const layers = value.layers, objects = value.geometry?.objects
    if (!isRecord(layers)) errors.push("Invalid layer table")
    else for (const [key, layer] of Object.entries(layers)) {
      if (!isRecord(layer)) { errors.push("Invalid layer"); continue }
      identity(layer.id, "layer")
      if (key !== layer.id) errors.push("Layer key/ID mismatch")
      if (typeof layer.name !== "string" || typeof layer.visible !== "boolean" || typeof layer.locked !== "boolean") errors.push("Invalid layer fields")
    }
    if (typeof value.currentLayerId !== "string" || !isRecord(layers) || !has(layers, value.currentLayerId)) errors.push("Invalid currentLayerId")
    if (!isRecord(objects)) errors.push("Invalid object table")
    else for (const [key, line] of Object.entries(objects)) {
      if (!isRecord(line)) { errors.push("Invalid object"); continue }
      identity(line.id, "object")
      if (key !== line.id) errors.push("Object key/ID mismatch")
      if (line.type !== "line") errors.push("Unsupported object type")
      if (typeof line.layerId !== "string" || !isRecord(layers) || !has(layers, line.layerId)) errors.push("Invalid layer reference")
      point(line.start, "Line start"); point(line.end, "Line end")
      identity(line.start?.featureId, "start feature")
      identity(line.end?.featureId, "end feature")
    }
    return errors
  }

  function freeze(value) {
    for (const child of Object.values(value)) if (isRecord(child)) freeze(child)
    return Object.freeze(value)
  }

  function createStore() {
    // Retain allocated identities after cancellation. Random IDs do not encode order.
    const allocated = new Set()
    function newId() {
      const bytes = new Uint8Array(16)
      for (let attempt = 0; attempt < 8; attempt++) {
        crypto.getRandomValues(bytes)
        const id = "id_" + Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")
        if (!allocated.has(id)) { allocated.add(id); return id }
      }
      throw new Error("Unable to allocate a unique ID")
    }
    const id = newId(), layerId = newId()
    let state = freeze({ id, name: "Untitled", formatVersion: 1,
      geometry: { objects: {} },
      layers: { [layerId]: { id: layerId, name: "Default", visible: true, locked: false } },
      currentLayerId: layerId,
    })
    function publish(objects) {
      const candidate = { ...state, geometry: { objects } }
      const errors = validateDocument(candidate)
      if (errors.length) throw new Error(errors.join("; "))
      state = freeze(candidate)
    }
    const reader = Object.freeze({
      snapshot: () => state,
      lines: () => Object.freeze(Object.values(state.geometry.objects)),
    })
    // Temporary, narrow capability for the existing immediate-write Line command.
    // Only the viewport owns it; consumers receive the reader instead.
    const legacyLineWriter = Object.freeze({
      add(start, end) {
        const line = { id: newId(), type: "line", layerId: state.currentLayerId,
          start: { x: start?.x, y: start?.y, featureId: newId() },
          end: { x: end?.x, y: end?.y, featureId: newId() },
        }
        publish({ ...state.geometry.objects, [line.id]: line })
        return line.id
      },
      remove(ids) {
        const objects = { ...state.geometry.objects }
        for (const id of ids) delete objects[id]
        publish(objects)
      },
    })
    return Object.freeze({ reader, legacyLineWriter })
  }
  window.CaderactDocument = Object.freeze({ createStore, validateDocument })
})()
