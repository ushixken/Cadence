// Caderact's validated document schema and document-specific record gateway.
(() => {
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value)
  const has = (table, key) => Object.prototype.hasOwnProperty.call(table, key)
  const normalizeLayerName = value => typeof value === "string" ? value.trim() : ""
  const layerNameKey = value => normalizeLayerName(value).toLowerCase()
  const fields = values => Object.freeze(values)
  const V1_FIELDS = Object.freeze({
    fileEnvelope: fields(["fileVersion", "document"]),
    persistedDocument: fields(["id", "name", "formatVersion", "units", "defaultLayerId", "currentLayerId", "layers", "records"]),
    document: fields(["id", "name", "formatVersion", "units", "geometry", "layers", "defaultLayerId", "currentLayerId"]),
    geometry: fields(["objects"]),
    units: fields(["length"]),
    layer: fields(["id", "name", "visible", "locked"]),
    line: fields(["id", "type", "layerId", "start", "end"]),
    endpoint: fields(["x", "y", "featureId"]),
  })
  function unknownFields(value, allowedFields) {
    if (!isRecord(value)) return []
    const allowed = new Set(allowedFields)
    return Reflect.ownKeys(value)
      .filter(key => Object.prototype.propertyIsEnumerable.call(value, key) && !allowed.has(key))
      .map(String)
      .sort()
  }

  function validateDocument(value) {
    const errors = [], ids = new Set()
    function closedShape(candidate, allowedFields, label) {
      const unknown = unknownFields(candidate, allowedFields)
      if (unknown.length) errors.push(`${label}: unknown field${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`)
    }
    function identity(id, label) {
      if (typeof id !== "string" || id.trim() === "") errors.push(`${label}: missing ID`)
      else if (ids.has(id)) errors.push(`${label}: duplicate ID ${id}`)
      else ids.add(id)
    }
    function point(value, label) {
      if (!isRecord(value) || !Number.isFinite(value.x) || !Number.isFinite(value.y)) errors.push(`${label}: invalid finite point`)
    }
    if (!isRecord(value)) return ["Invalid document"]
    closedShape(value, V1_FIELDS.document, "document")
    identity(value.id, "document")
    if (value.formatVersion !== 1) errors.push("Unsupported formatVersion")
    if (typeof value.name !== "string") errors.push("Invalid document name")
    closedShape(value.units, V1_FIELDS.units, "document units")
    if (!isRecord(value.units) || !window.CaderactUnits.isSupportedLengthUnit(value.units.length)) errors.push("Invalid document length unit")
    closedShape(value.geometry, V1_FIELDS.geometry, "document geometry")
    const layers = value.layers, objects = value.geometry?.objects
    const layerNames = new Set()
    if (!isRecord(layers)) errors.push("Invalid layer table")
    else for (const [key, layer] of Object.entries(layers)) {
      if (!isRecord(layer)) { errors.push("Invalid layer"); continue }
      closedShape(layer, V1_FIELDS.layer, "layer")
      identity(layer.id, "layer")
      if (key !== layer.id) errors.push("Layer key/ID mismatch")
      const normalizedName = normalizeLayerName(layer.name), nameKey = layerNameKey(layer.name)
      if (!normalizedName || normalizedName !== layer.name || typeof layer.visible !== "boolean" || typeof layer.locked !== "boolean") errors.push("Invalid layer fields")
      else if (layerNames.has(nameKey)) errors.push(`Duplicate layer name ${layer.name}`)
      else layerNames.add(nameKey)
    }
    if (typeof value.defaultLayerId !== "string" || !isRecord(layers) || !has(layers, value.defaultLayerId)) errors.push("Invalid defaultLayerId")
    if (typeof value.currentLayerId !== "string" || !isRecord(layers) || !has(layers, value.currentLayerId)) errors.push("Invalid currentLayerId")
    if (!isRecord(objects)) errors.push("Invalid object table")
    else for (const [key, line] of Object.entries(objects)) {
      if (!isRecord(line)) { errors.push("Invalid object"); continue }
      closedShape(line, V1_FIELDS.line, "Line")
      identity(line.id, "object")
      if (key !== line.id) errors.push("Object key/ID mismatch")
      if (line.type !== "line") errors.push("Unsupported object type")
      if (typeof line.layerId !== "string" || !isRecord(layers) || !has(layers, line.layerId)) errors.push("Invalid layer reference")
      point(line.start, "Line start"); point(line.end, "Line end")
      closedShape(line.start, V1_FIELDS.endpoint, "Line start")
      closedShape(line.end, V1_FIELDS.endpoint, "Line end")
      identity(line.start?.featureId, "start feature")
      identity(line.end?.featureId, "end feature")
    }
    return errors
  }

  function freeze(value) {
    for (const child of Object.values(value)) if (isRecord(child)) freeze(child)
    return Object.freeze(value)
  }

  function copyValue(value) {
    if (value === null || typeof value !== "object") return value
    if (Array.isArray(value)) return value.map(copyValue)
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyValue(child)]))
  }

  function createStore({ document: initialDocument, initiallySaved = false } = {}) {
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
    let state
    if (initialDocument !== undefined) {
      const candidate = copyValue(initialDocument), errors = validateDocument(candidate)
      if (errors.length) throw new Error(`Invalid initial document: ${errors.join("; ")}`)
      allocated.add(candidate.id)
      for (const layer of Object.values(candidate.layers)) allocated.add(layer.id)
      for (const record of Object.values(candidate.geometry.objects)) {
        allocated.add(record.id)
        allocated.add(record.start.featureId)
        allocated.add(record.end.featureId)
      }
      state = freeze(candidate)
    } else {
      const id = newId(), layerId = newId()
      state = freeze({ id, name: "Untitled", formatVersion: 1, units: { length: "mm" },
        geometry: { objects: {} },
        layers: { [layerId]: { id: layerId, name: "Default", visible: true, locked: false } },
        defaultLayerId: layerId,
        currentLayerId: layerId,
      })
    }
    // A3: persistent document mutation is now gated by the Document Controller's
    // transaction core. This closure no longer publishes state directly; it hands
    // the controller a way to read/replace `state` and the existing A2 validator.
    const controller = window.DocumentController.createController({
      getDocument: () => state,
      getCollections: document => ({ records: document.geometry.objects, layers: document.layers, settings: { units: document.units } }),
      assembleDocument: (baseDocument, collections) => ({
        ...baseDocument,
        geometry: { objects: collections.records },
        layers: collections.layers,
        units: collections.settings.units,
      }),
      validate: validateDocument,
      onPublish: (newDocument) => { state = newDocument },
      freeze,
      // A4 state identities use the same opaque, non-recycling allocator as
      // document/geometry identities while remaining a separate ID namespace.
      allocateStateId: newId,
    })
    if (initiallySaved) controller.markStateSaved(controller.captureStateToken())
    const reader = Object.freeze({
      snapshot: () => state,
      // A6 command-agnostic committed-record view. Sorting by stable ID makes
      // enumeration independent of object-table insertion/reconstruction order.
      records: () => Object.freeze(Object.values(state.geometry.objects).sort((a, b) => a.id.localeCompare(b.id))),
      layers: () => Object.freeze(Object.values(state.layers).sort((a, b) => a.id.localeCompare(b.id))),
      layer: layerId => state.layers[layerId] || null,
      units: () => state.units,
      // Compatibility query for current Line-oriented callers; render code uses
      // records() and performs its own supported-type projection.
      lines: () => Object.freeze(Object.values(state.geometry.objects).filter(record => record.type === "line")),
    })
    // Schema-aware, command-agnostic record gateway. Commands may construct
    // immutable records before publication, while atomic creation remains
    // controlled by one short document transaction.
    function updateRecordProperties(recordId, properties) {
      const transaction = controller.beginTransaction()
      try {
        const record = transaction.read(recordId)
        if (record === null) { transaction.rollback(); return Object.freeze({ status: "missing-record", recordId }) }
        transaction.replace(recordId, { ...record, ...properties, id: record.id })
        return transaction.publish()
      } catch (error) { if (transaction.isOpen) transaction.rollback(); throw error }
    }
    const recordGateway = Object.freeze({
      createLine(start, end) {
        return freeze({ id: newId(), type: "line", layerId: state.currentLayerId,
          start: { x: start?.x, y: start?.y, featureId: newId() },
          end: { x: end?.x, y: end?.y, featureId: newId() },
        })
      },
      createAll(records) {
        let transaction
        try {
          transaction = controller.beginTransaction()
          for (const record of records) transaction.create(record.id, record)
          return transaction.publish()
        } catch (error) {
          if (transaction?.isOpen) transaction.rollback()
          return Object.freeze({ status: "commit-failed", message: error.message })
        }
      },
      replace(recordId, record) {
        const transaction = controller.beginTransaction()
        try { transaction.replace(recordId, record); return transaction.publish() }
        catch (error) { if (transaction.isOpen) transaction.rollback(); throw error }
      },
      updateProperties(recordId, properties) {
        return updateRecordProperties(recordId, properties)
      },
      setLayer(recordId, layerId) {
        if (!has(state.layers, layerId)) return Object.freeze({ status: "unknown-layer", layerId })
        return updateRecordProperties(recordId, { layerId })
      },
    })
    function layerByName(name) {
      const key = layerNameKey(name)
      return Object.values(state.layers).find(layer => layerNameKey(layer.name) === key) || null
    }
    const layerGateway = Object.freeze({
      create(name) {
        const normalizedName = normalizeLayerName(name)
        if (!normalizedName) return Object.freeze({ status: "invalid-layer-name" })
        if (layerByName(normalizedName)) return Object.freeze({ status: "duplicate-layer-name", name: normalizedName })
        const layer = freeze({ id: newId(), name: normalizedName, visible: true, locked: false })
        const transaction = controller.beginTransaction()
        transaction.createIn("layers", layer.id, layer)
        return transaction.publish()
      },
      rename(layerId, name) {
        const layer = state.layers[layerId], normalizedName = normalizeLayerName(name)
        if (!layer) return Object.freeze({ status: "unknown-layer", layerId })
        if (!normalizedName) return Object.freeze({ status: "invalid-layer-name" })
        if (layerNameKey(layer.name) === layerNameKey(normalizedName)) return Object.freeze({ status: "no-op", changes: Object.freeze([]) })
        if (layerByName(normalizedName)) return Object.freeze({ status: "duplicate-layer-name", name: normalizedName })
        const transaction = controller.beginTransaction()
        transaction.replaceIn("layers", layerId, { ...layer, name: normalizedName })
        return transaction.publish()
      },
      remove(layerId) {
        const layer = state.layers[layerId]
        if (!layer) return Object.freeze({ status: "unknown-layer", layerId })
        if (layerId === state.defaultLayerId) return Object.freeze({ status: "default-layer-required", layerId })
        if (Object.values(state.geometry.objects).some(record => record.layerId === layerId)) {
          return Object.freeze({ status: "layer-in-use", layerId })
        }
        const transaction = controller.beginTransaction()
        transaction.removeIn("layers", layerId)
        return transaction.publish()
      },
    })
    const unitGateway = Object.freeze({
      setLengthUnit(unit) {
        if (!window.CaderactUnits.isSupportedLengthUnit(unit)) return Object.freeze({ status: "unsupported-unit", unit })
        if (state.units.length === unit) return Object.freeze({ status: "no-op", changes: Object.freeze([]) })
        const transaction = controller.beginTransaction()
        transaction.replaceIn("settings", "units", { ...state.units, length: unit })
        return transaction.publish()
      },
    })
    return Object.freeze({ reader, recordGateway, layerGateway, unitGateway, controller })
  }
  window.CaderactDocument = Object.freeze({ createStore, validateDocument, V1_FIELDS, unknownFields })
})()
