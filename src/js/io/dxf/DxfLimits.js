// DXF1: centralized resource limits for untrusted ASCII DXF input.
(() => {
  const DEFAULTS = Object.freeze({
    maxTextLength: 8 * 1024 * 1024,
    maxGroupPairs: 500000,
    maxStringLength: 16384,
    maxEntities: 100000,
    maxTableEntries: 10000,
    maxDiagnostics: 100,
  })

  function resolve(overrides = {}) {
    const limits = { ...DEFAULTS, ...overrides }
    for (const [name, value] of Object.entries(limits)) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid DXF limit ${name}`)
    }
    return Object.freeze(limits)
  }

  window.CaderactDxfLimits = Object.freeze({ DEFAULTS, resolve })
})()
