// DXF1: renderer- and UI-neutral structured diagnostics.
(() => {
  function createCollector(maxDiagnostics) {
    const diagnostics = []
    const keys = new Map()
    let omittedCount = 0

    function add(value) {
      const diagnostic = {
        severity: value.severity,
        code: value.code,
        message: value.message,
        ...(value.section ? { section: value.section } : {}),
        ...(value.entityType ? { entityType: value.entityType } : {}),
        ...(value.handle ? { handle: value.handle } : {}),
        ...(Number.isInteger(value.sourceIndex) ? { sourceIndex: value.sourceIndex } : {}),
      }
      const key = [diagnostic.severity, diagnostic.code, diagnostic.message, diagnostic.section,
        diagnostic.entityType].join("\u0000")
      const existing = keys.get(key)
      if (existing !== undefined) {
        diagnostics[existing] = { ...diagnostics[existing], count: (diagnostics[existing].count || 1) + 1 }
        return diagnostics[existing]
      }
      if (diagnostics.length >= maxDiagnostics) { omittedCount += 1; return null }
      keys.set(key, diagnostics.length)
      diagnostics.push(diagnostic)
      return diagnostic
    }
    function snapshot() {
      const values = diagnostics.map(value => Object.freeze({ ...value }))
      if (omittedCount > 0) values.push(Object.freeze({
        severity: "warning", code: "DXF_DIAGNOSTIC_LIMIT",
        message: `${omittedCount} additional diagnostic${omittedCount === 1 ? " was" : "s were"} omitted.`,
        count: omittedCount,
      }))
      return Object.freeze(values)
    }
    return Object.freeze({ add, snapshot, get omittedCount() { return omittedCount } })
  }

  window.CaderactDxfDiagnostics = Object.freeze({ createCollector })
})()
