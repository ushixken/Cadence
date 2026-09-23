// DC1: pure Line + Line Fillet/Chamfer planning. No document, UI, ID, or
// renderer authority is used here.
(() => {
  const EPSILON = 1e-9
  const point = value => Object.freeze({ x: value.x, y: value.y })
  const add = (a, b, scale = 1) => point({ x: a.x + b.x * scale, y: a.y + b.y * scale })
  const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y })
  const dot = (a, b) => a.x * b.x + a.y * b.y
  const cross = (a, b) => a.x * b.y - a.y * b.x
  const length = value => Math.hypot(value.x, value.y)

  function failure(reason, details = {}) { return Object.freeze({ status: "invalid", reason, ...details }) }
  function finitePoint(value) { return value && Number.isFinite(value.x) && Number.isFinite(value.y) }
  function lineSnapshot(record) { return Object.freeze({ id: record.id, start: point(record.start), end: point(record.end) }) }

  function describeLine(record, pick) {
    if (record?.type !== "line" || !finitePoint(record.start) || !finitePoint(record.end)) return failure("unsupported-geometry")
    if (!finitePoint(pick)) return failure("invalid-pick")
    const vector = subtract(record.end, record.start), magnitude = length(vector)
    if (!(magnitude > EPSILON)) return failure("degenerate-line")
    return { status: "valid", record, pick, unit: { x: vector.x / magnitude, y: vector.y / magnitude } }
  }

  function intersection(first, second) {
    const denominator = cross(first.unit, second.unit)
    if (Math.abs(denominator) <= EPSILON) return failure("parallel-lines")
    const delta = subtract(second.record.start, first.record.start)
    const parameter = cross(delta, second.unit) / denominator
    return { status: "valid", point: add(first.record.start, first.unit, parameter) }
  }

  function selectedRay(description, corner) {
    const fromCorner = subtract(description.pick, corner), pickProjection = dot(fromCorner, description.unit)
    if (Math.abs(pickProjection) <= EPSILON) return failure("pick-at-corner")
    const direction = pickProjection > 0 ? description.unit : { x: -description.unit.x, y: -description.unit.y }
    const startDistance = dot(subtract(description.record.start, corner), direction)
    const endDistance = dot(subtract(description.record.end, corner), direction)
    const keepStart = startDistance >= endDistance
    const available = Math.max(startDistance, endDistance)
    if (!(available > EPSILON)) return failure("invalid-pick-side")
    return { status: "valid", direction, available, keepStart,
      keepPoint: point(keepStart ? description.record.start : description.record.end) }
  }

  function replacement(source, ray, cutPoint) {
    return Object.freeze({
      recordId: source.id,
      geometry: Object.freeze({ type: "line",
        start: ray.keepStart ? ray.keepPoint : point(cutPoint),
        end: ray.keepStart ? point(cutPoint) : ray.keepPoint }),
      endpointIntent: Object.freeze({
        start: ray.keepStart ? Object.freeze({ role: "preserve", featureId: source.start.featureId }) : Object.freeze({ role: "allocate" }),
        end: ray.keepStart ? Object.freeze({ role: "allocate" }) : Object.freeze({ role: "preserve", featureId: source.end.featureId }),
      }),
    })
  }

  function common(input) {
    const first = describeLine(input?.first, input?.firstPick), second = describeLine(input?.second, input?.secondPick)
    if (first.status !== "valid") return first
    if (second.status !== "valid") return second
    if (first.record.id === second.record.id) return failure("same-line")
    const hit = intersection(first, second)
    if (hit.status !== "valid") return hit
    const firstRay = selectedRay(first, hit.point), secondRay = selectedRay(second, hit.point)
    if (firstRay.status !== "valid") return firstRay
    if (secondRay.status !== "valid") return secondRay
    const cosine = Math.max(-1, Math.min(1, dot(firstRay.direction, secondRay.direction)))
    const angle = Math.acos(cosine)
    if (!(angle > EPSILON && angle < Math.PI - EPSILON)) return failure("parallel-lines")
    return { status: "valid", first, second, corner: hit.point, firstRay, secondRay, angle }
  }

  function planned(base, firstCut, secondCut, createdGeometry, operation) {
    const replacements = Object.freeze([
      replacement(base.first.record, base.firstRay, firstCut),
      replacement(base.second.record, base.secondRay, secondCut),
    ])
    return Object.freeze({ status: "planned", operation, sourceGeometry: Object.freeze([
      lineSnapshot(base.first.record), lineSnapshot(base.second.record),
    ]), replacements, createdGeometry,
      previewGeometry: Object.freeze({ replacements: Object.freeze(replacements.map(value => value.geometry)), createdGeometry }) })
  }

  function validateCutDistance(ray, distance) {
    if (!Number.isFinite(distance) || distance < 0) return failure("invalid-distance")
    if (distance > ray.available + EPSILON) return failure("distance-exceeds-line")
    if (Math.abs(distance - ray.available) <= EPSILON) return failure("degenerate-result")
    return { status: "valid" }
  }

  function planFillet(input = {}) {
    const radius = input.radius
    if (!Number.isFinite(radius) || radius < 0) return failure("invalid-radius")
    const base = common(input)
    if (base.status !== "valid") return base
    if (radius === 0) return planned(base, base.corner, base.corner, null, "fillet")
    const tangentDistance = radius / Math.tan(base.angle / 2)
    if (!Number.isFinite(tangentDistance) || tangentDistance <= EPSILON) return failure("impossible-radius")
    const firstCheck = validateCutDistance(base.firstRay, tangentDistance), secondCheck = validateCutDistance(base.secondRay, tangentDistance)
    if (firstCheck.status !== "valid" || secondCheck.status !== "valid") return failure("impossible-radius")
    const firstCut = add(base.corner, base.firstRay.direction, tangentDistance)
    const secondCut = add(base.corner, base.secondRay.direction, tangentDistance)
    const bisectorVector = { x: base.firstRay.direction.x + base.secondRay.direction.x, y: base.firstRay.direction.y + base.secondRay.direction.y }
    const bisectorLength = length(bisectorVector)
    if (!(bisectorLength > EPSILON)) return failure("impossible-radius")
    const centerDistance = radius / Math.sin(base.angle / 2)
    const center = add(base.corner, { x: bisectorVector.x / bisectorLength, y: bisectorVector.y / bisectorLength }, centerDistance)
    const fromCenterFirst = subtract(firstCut, center), fromCenterSecond = subtract(secondCut, center)
    const sweep = Math.atan2(cross(fromCenterFirst, fromCenterSecond), dot(fromCenterFirst, fromCenterSecond))
    if (!Number.isFinite(sweep) || Math.abs(sweep) <= EPSILON) return failure("degenerate-result")
    const arc = Object.freeze({ type: "arc", center, radius, start: firstCut, end: secondCut, sweep })
    return planned(base, firstCut, secondCut, arc, "fillet")
  }

  function planChamfer(input = {}) {
    const firstDistance = input.firstDistance, secondDistance = input.secondDistance
    const base = common(input)
    if (base.status !== "valid") return base
    const firstCheck = validateCutDistance(base.firstRay, firstDistance), secondCheck = validateCutDistance(base.secondRay, secondDistance)
    if (firstCheck.status !== "valid") return firstCheck
    if (secondCheck.status !== "valid") return secondCheck
    if (firstDistance <= EPSILON && secondDistance <= EPSILON) return failure("degenerate-result")
    const firstCut = add(base.corner, base.firstRay.direction, firstDistance)
    const secondCut = add(base.corner, base.secondRay.direction, secondDistance)
    if (length(subtract(secondCut, firstCut)) <= EPSILON) return failure("degenerate-result")
    return planned(base, firstCut, secondCut, Object.freeze({ type: "line", start: firstCut, end: secondCut }), "chamfer")
  }

  window.CaderactCornerModificationPlanner = Object.freeze({ EPSILON, planFillet, planChamfer })
})()
