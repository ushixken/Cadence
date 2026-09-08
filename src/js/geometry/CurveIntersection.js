// M6P2: pure model-space curve/curve intersection primitives. Every solver
// below works against the curve's UNBOUNDED support geometry (infinite line,
// full circle, full ellipse) and returns each intersection's parameter on
// that unbounded support; `intersect()` then filters by the curve's actual
// finite domain (CurveParameter.isParameterInDomain) so Trim only ever sees
// on-curve results while the unbounded values stay available for M7 Extend.
(() => {
  const { normalizeAngle } = window.CaderactArcGeometry
  const { arcAngleToParameter, isParameterInDomain } = window.CaderactCurveParameter
  const NUMERIC_EPSILON = 1e-9

  const point = (x, y) => Object.freeze({ x, y })
  const finite = value => Number.isFinite(value)

  function circleOf(curve) { return curve.kind === "arc" ? { center: curve.center, radius: curve.radius } : curve }

  // Native curve-native parameter (unbounded) for a raw angle against a
  // circle-shaped curve (circle keeps the angle; arc converts to its sweep
  // fraction so downstream domain checks stay in one representation).
  function angleParameter(curve, angle) { return curve.kind === "arc" ? arcAngleToParameter(curve, angle) : normalizeAngle(angle) }

  function lineDirection(line) { return { dx: line.end.x - line.start.x, dy: line.end.y - line.start.y } }

  // --- Line / Line -----------------------------------------------------
  function lineLineRaw(a, b) {
    const d1 = lineDirection(a), d2 = lineDirection(b)
    const denominator = d1.dx * d2.dy - d1.dy * d2.dx
    if (!finite(denominator) || Math.abs(denominator) <= NUMERIC_EPSILON) {
      return Object.freeze({ points: [], degenerate: "parallel-or-coincident" })
    }
    const dx = b.start.x - a.start.x, dy = b.start.y - a.start.y
    const t = (dx * d2.dy - dy * d2.dx) / denominator
    const u = (dx * d1.dy - dy * d1.dx) / denominator
    if (![t, u].every(finite)) return Object.freeze({ points: [], degenerate: "unstable" })
    return Object.freeze({ points: [Object.freeze({ point: point(a.start.x + d1.dx * t, a.start.y + d1.dy * t), paramA: t, paramB: u })] })
  }

  // --- Line / Circle-shaped (Circle or Arc's underlying circle) --------
  function lineCircleRaw(line, circleLike) {
    const { dx, dy } = lineDirection(line)
    const fx = line.start.x - circleLike.center.x, fy = line.start.y - circleLike.center.y
    const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - circleLike.radius * circleLike.radius
    const discriminant = b * b - 4 * a * c
    if (!finite(discriminant) || discriminant < -NUMERIC_EPSILON || a <= NUMERIC_EPSILON) return Object.freeze({ points: [] })
    const clamped = Math.max(discriminant, 0), root = Math.sqrt(clamped)
    const roots = clamped <= NUMERIC_EPSILON ? [-b / (2 * a)] : [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    return Object.freeze({ points: roots.filter(finite).map(t => {
      const p = point(line.start.x + dx * t, line.start.y + dy * t)
      const angle = normalizeAngle(Math.atan2(p.y - circleLike.center.y, p.x - circleLike.center.x))
      return Object.freeze({ point: p, paramA: t, angleB: angle })
    }) })
  }

  // --- Circle-shaped / Circle-shaped (Circle/Circle, Circle/Arc, Arc/Arc) --
  function circleCircleRaw(circleA, circleB) {
    const dx = circleB.center.x - circleA.center.x, dy = circleB.center.y - circleA.center.y
    const distance = Math.hypot(dx, dy)
    if (!(distance > NUMERIC_EPSILON)) return Object.freeze({ points: [], degenerate: "concentric" })
    if (distance > circleA.radius + circleB.radius + NUMERIC_EPSILON) return Object.freeze({ points: [] })
    if (distance < Math.abs(circleA.radius - circleB.radius) - NUMERIC_EPSILON) return Object.freeze({ points: [] })
    const a = (distance * distance + circleA.radius * circleA.radius - circleB.radius * circleB.radius) / (2 * distance)
    const heightSquared = circleA.radius * circleA.radius - a * a
    const height = Math.sqrt(Math.max(heightSquared, 0))
    const midX = circleA.center.x + (a * dx) / distance, midY = circleA.center.y + (a * dy) / distance
    const offsets = Math.abs(heightSquared) <= NUMERIC_EPSILON ? [0] : [-height, height]
    return Object.freeze({ points: offsets.map(offset => {
      const p = point(midX - (offset * dy) / distance, midY + (offset * dx) / distance)
      const angleA = normalizeAngle(Math.atan2(p.y - circleA.center.y, p.x - circleA.center.x))
      const angleB = normalizeAngle(Math.atan2(p.y - circleB.center.y, p.x - circleB.center.x))
      return Object.freeze({ point: p, angleA, angleB })
    }) })
  }

  // --- Ellipse local unit-circle frame ---------------------------------
  // Maps a model-space point into the ellipse's own (major, minor) unit
  // basis, i.e. the affine transform that carries the ellipse onto the unit
  // circle. Used to reduce Line/Ellipse to Line/unit-circle, and to evaluate
  // the ellipse's implicit function for the bounded numerical solvers below.
  function ellipseFrame(ellipse) {
    const majorHat = point(ellipse.majorAxis.x / ellipse.majorRadius, ellipse.majorAxis.y / ellipse.majorRadius)
    const minorHat = point(-majorHat.y, majorHat.x)
    return { majorHat, minorHat }
  }
  function toEllipseUnitSpace(ellipse, frame, worldPoint) {
    const relative = { x: worldPoint.x - ellipse.center.x, y: worldPoint.y - ellipse.center.y }
    return point(
      (relative.x * frame.majorHat.x + relative.y * frame.majorHat.y) / ellipse.majorRadius,
      (relative.x * frame.minorHat.x + relative.y * frame.minorHat.y) / ellipse.minorRadius,
    )
  }
  function fromEllipseUnitSpace(ellipse, frame, unitPoint) {
    return point(
      ellipse.center.x + (unitPoint.x * ellipse.majorRadius) * frame.majorHat.x + (unitPoint.y * ellipse.minorRadius) * frame.minorHat.x,
      ellipse.center.y + (unitPoint.x * ellipse.majorRadius) * frame.majorHat.y + (unitPoint.y * ellipse.minorRadius) * frame.minorHat.y,
    )
  }
  function ellipseImplicit(ellipse, frame, worldPoint) {
    const unit = toEllipseUnitSpace(ellipse, frame, worldPoint)
    return unit.x * unit.x + unit.y * unit.y - 1
  }

  // --- Line / Ellipse ----------------------------------------------------
  function lineEllipseRaw(line, ellipse) {
    const frame = ellipseFrame(ellipse)
    const unitStart = toEllipseUnitSpace(ellipse, frame, line.start), unitEnd = toEllipseUnitSpace(ellipse, frame, line.end)
    const unitLine = { start: unitStart, end: unitEnd }
    const solved = lineCircleRaw(unitLine, { center: point(0, 0), radius: 1 })
    return Object.freeze({ points: solved.points.map(hit => {
      const worldPoint = fromEllipseUnitSpace(ellipse, frame, hit.point)
      return Object.freeze({ point: worldPoint, paramA: hit.paramA, angleB: normalizeAngle(Math.atan2(hit.point.y, hit.point.x)) })
    }) })
  }

  // --- Circle-shaped / Ellipse, Ellipse / Ellipse: bounded deterministic --
  // numerical root finding. Sampling + bisection is robust, has a fixed cost,
  // and needs no derivative; documented as approximate for exact tangencies
  // (a sign-change scan can miss an even-order root that never crosses zero).
  const ELLIPSE_SAMPLE_COUNT = 720
  const BISECTION_ITERATIONS = 60

  function bisect(f, lowAngle, highAngle) {
    let low = lowAngle, high = highAngle, fLow = f(low)
    for (let i = 0; i < BISECTION_ITERATIONS; i++) {
      const mid = (low + high) / 2, fMid = f(mid)
      if (Math.sign(fMid) === Math.sign(fLow) || fLow === 0) { low = mid; fLow = fMid } else { high = mid }
    }
    return (low + high) / 2
  }

  function sampleRoots(f) {
    const TAU = Math.PI * 2, roots = []
    let previousAngle = 0, previousValue = f(0)
    for (let i = 1; i <= ELLIPSE_SAMPLE_COUNT; i++) {
      const angle = (i / ELLIPSE_SAMPLE_COUNT) * TAU
      const value = f(angle)
      if (previousValue === 0) roots.push(previousAngle)
      else if (Math.sign(value) !== Math.sign(previousValue) && finite(value) && finite(previousValue)) {
        roots.push(normalizeAngle(bisect(f, previousAngle, angle)))
      }
      previousAngle = angle; previousValue = value
    }
    return roots
  }

  function circleEllipseRaw(circleLike, ellipse) {
    const frame = ellipseFrame(ellipse)
    const f = angle => {
      const worldPoint = point(circleLike.center.x + Math.cos(angle) * circleLike.radius, circleLike.center.y + Math.sin(angle) * circleLike.radius)
      return ellipseImplicit(ellipse, frame, worldPoint)
    }
    const roots = sampleRoots(f)
    return Object.freeze({ points: roots.map(angleA => {
      const worldPoint = point(circleLike.center.x + Math.cos(angleA) * circleLike.radius, circleLike.center.y + Math.sin(angleA) * circleLike.radius)
      const unit = toEllipseUnitSpace(ellipse, frame, worldPoint)
      const angleB = normalizeAngle(Math.atan2(unit.y, unit.x))
      return Object.freeze({ point: worldPoint, angleA, angleB })
    }) })
  }

  function ellipseEllipseRaw(ellipseA, ellipseB) {
    const frameA = ellipseFrame(ellipseA), frameB = ellipseFrame(ellipseB)
    const f = angle => ellipseImplicit(ellipseB, frameB, window.CaderactEllipseGeometry.pointAt(ellipseA, angle))
    const roots = sampleRoots(f)
    return Object.freeze({ points: roots.map(angleA => {
      const worldPoint = window.CaderactEllipseGeometry.pointAt(ellipseA, angleA)
      const unit = toEllipseUnitSpace(ellipseB, frameB, worldPoint)
      const angleB = normalizeAngle(Math.atan2(unit.y, unit.x))
      return Object.freeze({ point: worldPoint, angleA, angleB })
    }) })
  }

  const RAW_SOLVERS = {
    "line:line": (a, b) => lineLineRaw(a, b),
    "line:circle": (a, b) => lineCircleRaw(a, circleOf(b)),
    "line:arc": (a, b) => lineCircleRaw(a, circleOf(b)),
    "line:ellipse": (a, b) => lineEllipseRaw(a, b),
    "circle:circle": (a, b) => circleCircleRaw(circleOf(a), circleOf(b)),
    "circle:arc": (a, b) => circleCircleRaw(circleOf(a), circleOf(b)),
    "arc:arc": (a, b) => circleCircleRaw(circleOf(a), circleOf(b)),
    "circle:ellipse": (a, b) => circleEllipseRaw(circleOf(a), b),
    "arc:ellipse": (a, b) => circleEllipseRaw(circleOf(a), b),
    "ellipse:ellipse": (a, b) => ellipseEllipseRaw(a, b),
  }

  // Normalizes a solver's mixed {paramA|angleA, paramB|angleB} output into
  // each curve's own native parameter (line -> t, circle/ellipse -> angle,
  // arc -> sweep fraction), and reports whether the point actually lies
  // within each curve's finite domain.
  function normalizeHit(curveA, curveB, hit) {
    const rawA = hit.paramA ?? hit.angleA, rawB = hit.paramB ?? hit.angleB
    const parameterA = curveA.kind === "line" ? rawA : angleParameter(curveA, rawA)
    const parameterB = curveB.kind === "line" ? rawB : angleParameter(curveB, rawB)
    return Object.freeze({
      point: hit.point, parameterA, parameterB,
      onA: isParameterInDomain(curveA, parameterA), onB: isParameterInDomain(curveB, parameterB),
    })
  }

  // Intersects two ATOMIC curves (never Polylines directly -- decompose via
  // CurveDescriptor.atomicCurves first and call this per segment pair).
  // Returns every root on the unbounded support with per-curve finite-domain
  // flags; callers that only want Trim-usable cuts should filter on
  // (onA && onB) or route through IntersectionClassifier for full handling.
  function intersectAtomic(curveA, curveB) {
    if (!curveA?.valid && curveA?.valid !== undefined) return Object.freeze({ valid: false, reason: "invalid-curve-a" })
    if (!curveB?.valid && curveB?.valid !== undefined) return Object.freeze({ valid: false, reason: "invalid-curve-b" })
    const key = `${curveA.kind}:${curveB.kind}`
    const reverseKey = `${curveB.kind}:${curveA.kind}`
    if (RAW_SOLVERS[key]) {
      const raw = RAW_SOLVERS[key](curveA, curveB)
      return Object.freeze({ valid: true, hits: Object.freeze((raw.points ?? []).map(hit => normalizeHit(curveA, curveB, hit))), degenerate: raw.degenerate ?? null })
    }
    if (RAW_SOLVERS[reverseKey]) {
      const raw = RAW_SOLVERS[reverseKey](curveB, curveA)
      return Object.freeze({ valid: true, hits: Object.freeze((raw.points ?? []).map(hit => normalizeHit(curveB, curveA, hit)).map(hit =>
        Object.freeze({ point: hit.point, parameterA: hit.parameterB, parameterB: hit.parameterA, onA: hit.onB, onB: hit.onA }))), degenerate: raw.degenerate ?? null })
    }
    return Object.freeze({ valid: false, reason: "unsupported-curve-pair" })
  }

  // Convenience orchestration that also decomposes Polyline records/
  // descriptors into their finite Line segments, so callers can pass whole
  // records (Line/Circle/Arc/Ellipse/Polyline) without pre-flattening.
  function intersect(recordA, recordB) {
    const flatA = window.CaderactCurveDescriptor.atomicCurves(recordA)
    const flatB = window.CaderactCurveDescriptor.atomicCurves(recordB)
    if (!flatA.valid) return Object.freeze({ valid: false, reason: "invalid-curve-a" })
    if (!flatB.valid) return Object.freeze({ valid: false, reason: "invalid-curve-b" })
    const results = []
    for (const curveA of flatA.curves) for (const curveB of flatB.curves) {
      const outcome = intersectAtomic(curveA, curveB)
      if (!outcome.valid) continue
      for (const hit of outcome.hits) {
        results.push(Object.freeze({ ...hit, segmentIndexA: curveA.segmentIndex ?? null, segmentIndexB: curveB.segmentIndex ?? null }))
      }
    }
    return Object.freeze({ valid: true, hits: Object.freeze(results) })
  }

  window.CaderactCurveIntersection = Object.freeze({
    intersect, intersectAtomic,
    lineLineRaw, lineCircleRaw, circleCircleRaw, lineEllipseRaw, circleEllipseRaw, ellipseEllipseRaw,
  })
})()
