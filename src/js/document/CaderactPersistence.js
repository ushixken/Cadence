// A8: deterministic, versioned serialization for durable document content.
(() => {
  const FILE_VERSION = 1
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value)

  function invalid(message) { throw new Error(`Invalid Caderact file: ${message}`) }
  function rejectUnknown(value, allowedFields, label) {
    const unknown = window.CaderactDocument.unknownFields(value, allowedFields)
    if (unknown.length) invalid(`${label} contains unknown field${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`)
  }
  function sortById(values) { return Array.from(values).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) }
  function canonicalLayer(layer) {
    return { id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked }
  }
  function canonicalRecord(record) {
    if (record.type === "line") return {
      id: record.id, type: record.type, layerId: record.layerId,
      start: { x: record.start?.x, y: record.start?.y, featureId: record.start?.featureId },
      end: { x: record.end?.x, y: record.end?.y, featureId: record.end?.featureId },
    }
    if (record.type === "circle") return {
      id: record.id, type: record.type, layerId: record.layerId,
      center: { x: record.center?.x, y: record.center?.y }, radius: record.radius,
    }
    if (record.type === "arc") return {
      id: record.id, type: record.type, layerId: record.layerId,
      center: { x: record.center?.x, y: record.center?.y }, radius: record.radius,
      start: { x: record.start?.x, y: record.start?.y, featureId: record.start?.featureId },
      end: { x: record.end?.x, y: record.end?.y, featureId: record.end?.featureId }, sweep: record.sweep,
    }
    return { id: record.id, type: record.type }
  }
  function payloadFor(document) {
    const errors = window.CaderactDocument.validateDocument(document)
    if (errors.length) invalid(errors.join("; "))
    return {
      fileVersion: FILE_VERSION,
      document: {
        id: document.id,
        name: document.name,
        formatVersion: document.formatVersion,
        units: { length: document.units.length },
        defaultLayerId: document.defaultLayerId,
        currentLayerId: document.currentLayerId,
        layers: sortById(Object.values(document.layers)).map(canonicalLayer),
        records: sortById(Object.values(document.geometry.objects)).map(canonicalRecord),
      },
    }
  }
  function serializeDocument(document) { return JSON.stringify(payloadFor(document)) }

  function parsePayload(serialized) {
    if (typeof serialized !== "string") invalid("serialized input must be a JSON string")
    let payload
    try { payload = JSON.parse(serialized) } catch { invalid("malformed JSON") }
    if (!isRecord(payload)) invalid("root must be an object")
    const fields = window.CaderactDocument.V1_FIELDS
    rejectUnknown(payload, fields.fileEnvelope, "root")
    if (payload.fileVersion !== FILE_VERSION) invalid(`unsupported fileVersion ${String(payload.fileVersion)}`)
    const source = payload.document
    if (!isRecord(source)) invalid("missing document")
    rejectUnknown(source, fields.persistedDocument, "document")
    if (!isRecord(source.units)) invalid("units must be an object")
    rejectUnknown(source.units, fields.units, "units")
    if (!Array.isArray(source.layers)) invalid("layers must be an array")
    if (!Array.isArray(source.records)) invalid("records must be an array")

    function tableFrom(items, label, canonicalize) {
      const entries = [], ids = new Set()
      for (const item of items) {
        if (!isRecord(item)) invalid(`${label} entry must be an object`)
        if (label === "layer") rejectUnknown(item, fields.layer, "layer entry")
        if (label === "record") {
          if (item.type === "line") {
            rejectUnknown(item, fields.line, "Line record")
            if (!isRecord(item.start) || !isRecord(item.end)) invalid("Line endpoints must be objects")
            rejectUnknown(item.start, fields.endpoint, "Line start")
            rejectUnknown(item.end, fields.endpoint, "Line end")
          } else if (item.type === "circle") {
            rejectUnknown(item, fields.circle, "Circle record")
            if (!isRecord(item.center)) invalid("Circle center must be an object")
            rejectUnknown(item.center, fields.coordinate, "Circle center")
          } else if (item.type === "arc") {
            rejectUnknown(item, fields.arc, "Arc record")
            if (!isRecord(item.center) || !isRecord(item.start) || !isRecord(item.end)) invalid("Arc center and endpoints must be objects")
            rejectUnknown(item.center, fields.coordinate, "Arc center")
            rejectUnknown(item.start, fields.endpoint, "Arc start")
            rejectUnknown(item.end, fields.endpoint, "Arc end")
          } else invalid(`unsupported record type ${String(item.type)}`)
        }
        if (typeof item.id !== "string" || item.id.trim() === "") invalid(`${label} entry is missing an ID`)
        if (ids.has(item.id)) invalid(`duplicate ${label} ID ${item.id}`)
        ids.add(item.id); entries.push([item.id, canonicalize(item)])
      }
      return Object.fromEntries(entries)
    }

    const layers = tableFrom(source.layers, "layer", canonicalLayer)
    const objects = tableFrom(source.records, "record", canonicalRecord)
    const candidate = {
      id: source.id,
      name: source.name,
      formatVersion: source.formatVersion,
      units: { length: source.units?.length },
      geometry: { objects },
      layers,
      defaultLayerId: source.defaultLayerId,
      currentLayerId: source.currentLayerId,
    }
    const errors = window.CaderactDocument.validateDocument(candidate)
    if (errors.length) invalid(errors.join("; "))
    return candidate
  }

  function deserializeDocument(serialized) { return parsePayload(serialized) }
  function loadStore(serialized) {
    return window.CaderactDocument.createStore({ document: parsePayload(serialized), initiallySaved: true })
  }
  function captureSave(reader, controller) {
    const token = controller.captureStateToken()
    const serialized = serializeDocument(reader.snapshot())
    return Object.freeze({
      serialized, stateId: token.stateId, revision: token.revision,
      acknowledge: () => controller.markStateSaved(token),
    })
  }

  window.CaderactPersistence = Object.freeze({
    FILE_VERSION, serializeDocument, deserializeDocument, loadStore, captureSave,
  })
})()
