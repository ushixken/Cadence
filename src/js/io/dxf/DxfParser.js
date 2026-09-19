// DXF1: bounded ASCII group-code parser producing a neutral ParsedDxf value.
(() => {
  const BINARY_SENTINEL = "AutoCAD Binary DXF"
  const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

  class DxfParseError extends Error {
    constructor(message, diagnostics) { super(message); this.name = "DxfParseError"; this.diagnostics = diagnostics }
  }
  function fail(collector, code, message, details = {}) {
    collector.add({ severity: "error", code, message, ...details })
    throw new DxfParseError(message, collector.snapshot())
  }
  function finiteNumber(pair, collector, label) {
    const value = pair?.value?.trim()
    if (!value || !NUMBER.test(value)) fail(collector, "DXF_INVALID_NUMBER", `${label} must be a finite number.`, {
      sourceIndex: pair?.sourceIndex,
    })
    const number = Number(value)
    if (!Number.isFinite(number)) fail(collector, "DXF_INVALID_NUMBER", `${label} must be a finite number.`, {
      sourceIndex: pair?.sourceIndex,
    })
    return number
  }
  function integer(pair, collector, label) {
    const value = finiteNumber(pair, collector, label)
    if (!Number.isInteger(value)) fail(collector, "DXF_INVALID_INTEGER", `${label} must be an integer.`, {
      sourceIndex: pair?.sourceIndex,
    })
    return value
  }
  function tokenize(text, limits, collector) {
    if (typeof text !== "string") fail(collector, "DXF_INVALID_TEXT", "DXF input must be text.")
    if (text.startsWith(BINARY_SENTINEL) || text.includes("\u0000")) {
      fail(collector, "DXF_BINARY_UNSUPPORTED", "Binary DXF is not supported in DXF1.")
    }
    if (text.length > limits.maxTextLength) fail(collector, "DXF_TEXT_LIMIT", "DXF text exceeds the configured size limit.")
    const lines = text.split(/\r\n|\n|\r/)
    if (lines.at(-1) === "") lines.pop()
    if (lines.length % 2 !== 0) fail(collector, "DXF_MALFORMED_PAIR", "DXF input contains an incomplete group-code pair.", {
      sourceIndex: lines.length,
    })
    if (lines.length / 2 > limits.maxGroupPairs) fail(collector, "DXF_GROUP_PAIR_LIMIT", "DXF group-pair limit exceeded.")
    const pairs = []
    for (let index = 0; index < lines.length; index += 2) {
      const codeText = lines[index].trim()
      if (!/^\d+$/.test(codeText)) fail(collector, "DXF_INVALID_GROUP_CODE", "DXF group code must be a non-negative integer.", {
        sourceIndex: index + 1,
      })
      const code = Number(codeText)
      if (!Number.isSafeInteger(code) || code > 1071) fail(collector, "DXF_INVALID_GROUP_CODE", "DXF group code is outside the supported range.", {
        sourceIndex: index + 1,
      })
      const value = lines[index + 1]
      if (value.length > limits.maxStringLength) fail(collector, "DXF_STRING_LIMIT", "DXF value exceeds the configured string limit.", {
        sourceIndex: index + 2,
      })
      pairs.push(Object.freeze({ code, value, sourceIndex: index + 1 }))
    }
    return Object.freeze(pairs)
  }
  function first(entity, code) { return entity.pairs.find(pair => pair.code === code) }
  function exactlyOne(entity, code, collector, label) {
    const pairs = entity.pairs.filter(pair => pair.code === code)
    if (pairs.length !== 1) fail(collector, "DXF_MALFORMED_LINE", `LINE requires exactly one ${label} value.`, {
      section: "ENTITIES", entityType: "LINE", handle: entity.handle, sourceIndex: entity.sourceIndex,
    })
    return pairs[0]
  }
  function parseLine(entity, collector) {
    const x1 = finiteNumber(exactlyOne(entity, 10, collector, "start X"), collector, "LINE start X")
    const y1 = finiteNumber(exactlyOne(entity, 20, collector, "start Y"), collector, "LINE start Y")
    const x2 = finiteNumber(exactlyOne(entity, 11, collector, "end X"), collector, "LINE end X")
    const y2 = finiteNumber(exactlyOne(entity, 21, collector, "end Y"), collector, "LINE end Y")
    const z1Pair = first(entity, 30), z2Pair = first(entity, 31)
    const z1 = z1Pair ? finiteNumber(z1Pair, collector, "LINE start Z") : 0
    const z2 = z2Pair ? finiteNumber(z2Pair, collector, "LINE end Z") : 0
    const exPair = first(entity, 210), eyPair = first(entity, 220), ezPair = first(entity, 230)
    const extrusion = {
      x: exPair ? finiteNumber(exPair, collector, "LINE extrusion X") : 0,
      y: eyPair ? finiteNumber(eyPair, collector, "LINE extrusion Y") : 0,
      z: ezPair ? finiteNumber(ezPair, collector, "LINE extrusion Z") : 1,
    }
    if (z1 !== 0 || z2 !== 0 || extrusion.x !== 0 || extrusion.y !== 0 || extrusion.z !== 1) {
      collector.add({ severity: "warning", code: "DXF_LINE_NON_PLANAR", message: "Skipped a non-planar or non-default-extrusion LINE.",
        section: "ENTITIES", entityType: "LINE", handle: entity.handle, sourceIndex: entity.sourceIndex })
      return null
    }
    return Object.freeze({ type: "LINE", start: Object.freeze({ x: x1, y: y1 }), end: Object.freeze({ x: x2, y: y2 }),
      handle: entity.handle || null, layer: first(entity, 8)?.value?.trim() || "0", sourceIndex: entity.sourceIndex })
  }
  function parseEntities(pairs, limits, collector) {
    const entities = []
    let index = 0, entityCount = 0
    while (index < pairs.length) {
      const start = pairs[index]
      if (start.code !== 0) fail(collector, "DXF_MALFORMED_ENTITIES", "ENTITIES data must begin with an entity type.", {
        section: "ENTITIES", sourceIndex: start.sourceIndex,
      })
      const type = start.value.trim().toUpperCase()
      index += 1
      const body = []
      while (index < pairs.length && pairs[index].code !== 0) body.push(pairs[index++])
      entityCount += 1
      if (entityCount > limits.maxEntities) fail(collector, "DXF_ENTITY_LIMIT", "DXF entity limit exceeded.", {
        section: "ENTITIES", entityType: type, sourceIndex: start.sourceIndex,
      })
      const entity = { type, pairs: body, handle: body.find(pair => pair.code === 5)?.value?.trim() || null, sourceIndex: start.sourceIndex }
      if (type === "LINE") {
        const line = parseLine(entity, collector)
        if (line) entities.push(line)
      } else {
        collector.add({ severity: "warning", code: "DXF_UNSUPPORTED_ENTITY", message: `Skipped unsupported ${type || "unnamed"} entity.`,
          section: "ENTITIES", entityType: type || undefined, handle: entity.handle, sourceIndex: start.sourceIndex })
      }
    }
    return entities
  }
  function parseHeader(pairs, collector) {
    let acadVersion = null, insertionUnits = null
    for (let index = 0; index < pairs.length; index += 1) {
      const pair = pairs[index]
      if (pair.code !== 9) continue
      const name = pair.value.trim().toUpperCase()
      let end = index + 1
      while (end < pairs.length && pairs[end].code !== 9) end += 1
      const values = pairs.slice(index + 1, end)
      if (name === "$ACADVER") acadVersion = values.find(value => value.code === 1)?.value?.trim() || null
      if (name === "$INSUNITS") {
        const unitPair = values.find(value => value.code === 70)
        if (!unitPair) fail(collector, "DXF_INVALID_INSUNITS", "$INSUNITS is missing its integer value.", { section: "HEADER", sourceIndex: pair.sourceIndex })
        insertionUnits = integer(unitPair, collector, "$INSUNITS")
      }
      index = end - 1
    }
    if (!acadVersion) collector.add({ severity: "warning", code: "DXF_ACADVER_MISSING", message: "$ACADVER is missing; DXF1 will parse only its version-neutral subset.", section: "HEADER" })
    return Object.freeze({ acadVersion, insertionUnits })
  }
  function parse(text, options = {}) {
    const limits = window.CaderactDxfLimits.resolve(options.limits)
    const collector = window.CaderactDxfDiagnostics.createCollector(limits.maxDiagnostics)
    const pairs = tokenize(text, limits, collector)
    const sections = new Map()
    let index = 0, sawEof = false
    while (index < pairs.length) {
      const pair = pairs[index]
      if (pair.code === 0 && pair.value.trim().toUpperCase() === "EOF") { sawEof = true; index += 1; break }
      if (pair.code !== 0 || pair.value.trim().toUpperCase() !== "SECTION") {
        fail(collector, "DXF_INVALID_STRUCTURE", "Expected SECTION or EOF.", { sourceIndex: pair.sourceIndex })
      }
      const namePair = pairs[index + 1]
      if (!namePair || namePair.code !== 2 || !namePair.value.trim()) fail(collector, "DXF_INVALID_SECTION", "SECTION is missing its name.", { sourceIndex: pair.sourceIndex })
      const name = namePair.value.trim().toUpperCase()
      index += 2
      const content = []
      while (index < pairs.length && !(pairs[index].code === 0 && pairs[index].value.trim().toUpperCase() === "ENDSEC")) content.push(pairs[index++])
      if (index >= pairs.length) fail(collector, "DXF_UNTERMINATED_SECTION", `${name} section is not terminated.`, { section: name, sourceIndex: pair.sourceIndex })
      index += 1
      if (sections.has(name)) fail(collector, "DXF_DUPLICATE_SECTION", `Duplicate ${name} section.`, { section: name, sourceIndex: pair.sourceIndex })
      sections.set(name, Object.freeze(content))
      if (!["HEADER", "TABLES", "ENTITIES"].includes(name)) collector.add({ severity: "warning", code: "DXF_UNSUPPORTED_SECTION",
        message: `Skipped unsupported ${name} section.`, section: name, sourceIndex: pair.sourceIndex })
    }
    if (!sawEof) fail(collector, "DXF_EOF_MISSING", "DXF input is missing EOF.")
    if (index !== pairs.length) fail(collector, "DXF_TRAILING_DATA", "DXF input contains data after EOF.", { sourceIndex: pairs[index].sourceIndex })
    if (!sections.has("ENTITIES")) fail(collector, "DXF_ENTITIES_MISSING", "DXF input is missing the ENTITIES section.")
    const source = sections.has("HEADER") ? parseHeader(sections.get("HEADER"), collector) : Object.freeze({ acadVersion: null, insertionUnits: null })
    if (!sections.has("HEADER")) collector.add({ severity: "warning", code: "DXF_HEADER_MISSING", message: "DXF input has no HEADER section." })
    const entities = parseEntities(sections.get("ENTITIES"), limits, collector)
    return Object.freeze({ kind: "ParsedDxf", source, entities: Object.freeze(entities), diagnostics: collector.snapshot(), limits })
  }

  window.CaderactDxfParser = Object.freeze({ parse, DxfParseError })
})()
