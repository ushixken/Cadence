// DXF1: neutral-DXF to isolated canonical Caderact document mapping.
(() => {
  const INSUNITS = Object.freeze({ 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m" })

  class DxfImportError extends Error {
    constructor(message, diagnostics) { super(message); this.name = "DxfImportError"; this.diagnostics = Object.freeze(diagnostics) }
  }
  function reject(parsed, code, message) {
    throw new DxfImportError(message, [...parsed.diagnostics, Object.freeze({ severity: "error", code, message, section: "HEADER" })])
  }
  function createStore(text, options = {}) {
    const parsed = window.CaderactDxfParser.parse(text, options)
    const code = parsed.source.insertionUnits
    if (code === null || code === 0) reject(parsed, "DXF_UNITS_REQUIRED", "DXF1 requires a supported, non-unitless $INSUNITS value.")
    const unit = INSUNITS[code]
    if (!unit || !window.CaderactUnits.isSupportedLengthUnit(unit)) reject(parsed, "DXF_UNITS_UNSUPPORTED", `DXF1 does not support $INSUNITS value ${code}.`)

    const draft = window.CaderactDocument.createStore()
    const defaultLayer = draft.reader.layers()[0]
    const layerOutcome = draft.layerGateway.rename(defaultLayer.id, "0")
    if (!['committed', 'no-op'].includes(layerOutcome.status)) reject(parsed, "DXF_LAYER_MAPPING_FAILED", "Unable to create DXF Layer 0.")
    const unitOutcome = draft.unitGateway.setLengthUnit(unit)
    if (!['committed', 'no-op'].includes(unitOutcome.status)) reject(parsed, "DXF_UNIT_MAPPING_FAILED", "Unable to apply DXF drawing units.")
    const records = parsed.entities.map(entity => draft.recordGateway.createLine(entity.start, entity.end))
    if (records.length) {
      const outcome = draft.recordGateway.createAll(records)
      if (outcome.status !== "committed") throw new DxfImportError(outcome.message || "Unable to create imported LINE records.", parsed.diagnostics)
    }
    const store = window.CaderactDocument.createStore({ document: draft.reader.snapshot(), initiallySaved: false })
    return Object.freeze({ store, parsed, diagnostics: parsed.diagnostics, importedCount: records.length, unit })
  }

  window.CaderactDxfImport = Object.freeze({ createStore, INSUNITS, DxfImportError })
})()
