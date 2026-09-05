// A8: deterministic, versioned serialization for durable document content.
(() => {
  const FILE_VERSION = 1
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value)

  function invalid(message) { throw new Error(`Invalid Caderact file: ${message}`) }
  function sortById(values) { return Array.from(values).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) }
  function canonicalLayer(layer) {
    return { id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked }
  }
  function canonicalRecord(record) {
    if (record.type !== "line") return { id: record.id, type: record.type }
    return {
      id: record.id, type: record.type, layerId: record.layerId,
      start: { x: record.start?.x, y: record.start?.y, featureId: record.start?.featureId },
      end: { x: record.end?.x, y: record.end?.y, featureId: record.end?.featureId },
    }
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
    if (payload.fileVersion !== FILE_VERSION) invalid(`unsupported fileVersion ${String(payload.fileVersion)}`)
    const source = payload.document
    if (!isRecord(source)) invalid("missing document")
    if (!Array.isArray(source.layers)) invalid("layers must be an array")
    if (!Array.isArray(source.records)) invalid("records must be an array")

    function tableFrom(items, label, canonicalize) {
      const entries = [], ids = new Set()
      for (const item of items) {
        if (!isRecord(item)) invalid(`${label} entry must be an object`)
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
