// P5: shared, DOM-free numeric interpretation. Geometry commands decide which
// normalized forms make sense for their current phase; this module never writes.
(() => {
  const result = (status, details = {}) => Object.freeze({ status, ...details })
  const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y)

  function parseScalar(input, currentUnit) {
    const parsed = window.CaderactPointInput.parseNumberToken(input, currentUnit)
    return parsed.status === "number-parsed"
      ? result("precision-parsed", { kind: "scalar", value: parsed.value })
      : parsed
  }

  function parseAngle(input) {
    if (typeof input !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input.trim())) return result("invalid-input", { reason: "invalid-angle" })
    const degrees = Number(input.trim())
    return Number.isFinite(degrees) ? result("precision-parsed", { kind: "angle", degrees }) : result("invalid-input", { reason: "invalid-angle" })
  }

  function parse(input, currentUnit) {
    if (typeof input !== "string") return result("invalid-input", { reason: "invalid-input" })
    const text = input.trim()
    const polar = text.match(/^@\s*(.+?)\s*<\s*(.+?)\s*$/)
    if (polar) {
      const distance = parseScalar(polar[1], currentUnit), angle = parseAngle(polar[2])
      if (distance.status !== "precision-parsed") return distance
      if (angle.status !== "precision-parsed") return angle
      return result("precision-parsed", { kind: "polar", distance: distance.value, degrees: angle.degrees })
    }
    if (text.includes(",") || text.startsWith("@")) {
      const point = window.CaderactPointInput.parsePoint(text, currentUnit)
      return point.status === "point-parsed" ? result("precision-parsed", { kind: point.relative ? "relativePoint" : "point", point }) : point
    }
    return parseScalar(text, currentUnit)
  }

  function resolvePoint(input, { currentUnit, anchor = null, direction = null, allowDirectDistance = true } = {}) {
    const parsed = parse(input, currentUnit)
    if (parsed.status !== "precision-parsed") return parsed
    if (parsed.kind === "point" || parsed.kind === "relativePoint") return window.CaderactPointInput.resolvePoint(parsed.point, anchor)
    if (parsed.kind === "polar") {
      if (!finitePoint(anchor)) return result("invalid-input", { reason: "relative-point-without-anchor" })
      if (!(parsed.distance > 0)) return result("invalid-input", { reason: "invalid-distance" })
      const radians = parsed.degrees * Math.PI / 180
      const x = anchor.x + parsed.distance * Math.cos(radians), y = anchor.y + parsed.distance * Math.sin(radians)
      return Number.isFinite(x) && Number.isFinite(y) ? result("point-resolved", { kind: "polar", relative: true, x, y }) : result("invalid-input", { reason: "invalid-number" })
    }
    if (!allowDirectDistance || !finitePoint(anchor)) return result("invalid-input", { reason: "invalid-coordinate" })
    if (!(parsed.value > 0)) return result("invalid-input", { reason: "invalid-distance" })
    if (!finitePoint(direction)) return result("invalid-input", { reason: "direction-required" })
    const length = Math.hypot(direction.x, direction.y)
    if (!(length > 0) || !Number.isFinite(length)) return result("invalid-input", { reason: "direction-required" })
    const x = anchor.x + parsed.value * direction.x / length, y = anchor.y + parsed.value * direction.y / length
    return Number.isFinite(x) && Number.isFinite(y) ? result("point-resolved", { kind: "distance", relative: true, x, y }) : result("invalid-input", { reason: "invalid-number" })
  }

  window.CaderactPrecisionInput = Object.freeze({ parse, parseScalar, parseAngle, resolvePoint })
})()
