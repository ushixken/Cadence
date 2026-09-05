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
    // A3: persistent document mutation is now gated by the Document Controller's
    // transaction core. This closure no longer publishes state directly; it hands
    // the controller a way to read/replace `state` and the existing A2 validator.
    const controller = window.DocumentController.createController({
      getDocument: () => state,
      assembleDocument: (baseDocument, objects) => ({ ...baseDocument, geometry: { objects } }),
      validate: validateDocument,
      onPublish: (newDocument) => { state = newDocument },
      freeze,
      // A4 state identities use the same opaque, non-recycling allocator as
      // document/geometry identities while remaining a separate ID namespace.
      allocateStateId: newId,
    })
    const reader = Object.freeze({
      snapshot: () => state,
      lines: () => Object.freeze(Object.values(state.geometry.objects)),
    })
    function publishOrThrow(transaction) {
      const outcome = transaction.publish()
      if (outcome.status === "validation-failed") throw new Error(outcome.errors.join("; "))
      return outcome
    }
    // Transitional (A3) Line integration: each accepted segment or session-cancel
    // uses one short, immediately-published transaction through the controller.
    // This is still not the final A5 whole-session draft architecture; the
    // viewport continues to call add()/remove() per accepted point/session,
    // exactly as it did in A2, but persistent writes now flow through the
    // transaction core instead of a private ad hoc publish().
    // Only the viewport owns this capability; consumers receive the reader.
    const legacyLineWriter = Object.freeze({
      add(start, end) {
        const transaction = controller.beginTransaction()
        const line = { id: newId(), type: "line", layerId: state.currentLayerId,
          start: { x: start?.x, y: start?.y, featureId: newId() },
          end: { x: end?.x, y: end?.y, featureId: newId() },
        }
        transaction.create(line.id, line)
        publishOrThrow(transaction)
        return line.id
      },
      remove(ids) {
        const transaction = controller.beginTransaction()
        for (const id of ids) transaction.remove(id)
        publishOrThrow(transaction)
      },
    })
    return Object.freeze({ reader, legacyLineWriter, controller })
  }
  window.CaderactDocument = Object.freeze({ createStore, validateDocument })
})()
