// D1: pure document-coordinate parsing and relative-point resolution.
(() => {
  const NUMBER_TOKEN = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-z]*)$/i
  const result = (status, details = {}) => Object.freeze({ status, ...details })

  function parseNumberToken(token, currentUnit) {
    if (typeof token !== "string") return result("invalid-input", { reason: "invalid-number" })
    const match = token.trim().match(NUMBER_TOKEN)
    if (!match) return result("invalid-input", { reason: "invalid-number" })
    const value = Number(match[1])
    if (!Number.isFinite(value)) return result("invalid-input", { reason: "invalid-number" })
    const suffix = match[2].toLowerCase()
    if (suffix && !window.CaderactUnits.isSupportedLengthUnit(suffix)) {
      return result("invalid-input", { reason: "unsupported-unit", unit: suffix })
    }
    try {
      const converted = suffix ? window.CaderactUnits.convert(value, suffix, currentUnit) : value
      if (!Number.isFinite(converted)) return result("invalid-input", { reason: "invalid-number" })
      return result("number-parsed", { value: converted, sourceUnit: suffix || null })
    } catch {
      return result("invalid-input", { reason: "unsupported-unit", unit: suffix || currentUnit })
    }
  }

  function parsePoint(input, currentUnit) {
    if (typeof input !== "string" || !window.CaderactUnits.isSupportedLengthUnit(currentUnit)) {
      return result("invalid-input", { reason: "invalid-coordinate" })
    }
    const source = input.trim()
    const relative = source.startsWith("@")
    const coordinateText = relative ? source.slice(1).trim() : source
    const components = coordinateText.split(",")
    if (components.length !== 2 || components.some(component => component.trim() === "")) {
      return result("invalid-input", { reason: "invalid-coordinate" })
    }
    const x = parseNumberToken(components[0], currentUnit)
    if (x.status !== "number-parsed") return x
    const y = parseNumberToken(components[1], currentUnit)
    if (y.status !== "number-parsed") return y
    return result("point-parsed", { kind: "point", relative, x: x.value, y: y.value })
  }

  function resolvePoint(parsed, anchor = null) {
    if (!parsed || parsed.status !== "point-parsed") return parsed || result("invalid-input", { reason: "invalid-coordinate" })
    if (parsed.relative && (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y))) {
      return result("invalid-input", { reason: "relative-point-without-anchor" })
    }
    const x = parsed.x + (parsed.relative ? anchor.x : 0)
    const y = parsed.y + (parsed.relative ? anchor.y : 0)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return result("invalid-input", { reason: "invalid-number" })
    return result("point-resolved", { kind: "point", relative: parsed.relative, x, y })
  }

  function parseAndResolve(input, { currentUnit, anchor = null } = {}) {
    return resolvePoint(parsePoint(input, currentUnit), anchor)
  }

  window.CaderactPointInput = Object.freeze({ parseNumberToken, parsePoint, resolvePoint, parseAndResolve })
})()
