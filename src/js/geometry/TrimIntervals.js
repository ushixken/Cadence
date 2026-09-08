// M6P2: pure topological/mathematical trim-interval helpers. These never
// touch document records, IDs, or transactions -- they only compute which
// parameter ranges on a target curve survive removing the interval containing
// a clicked parameter, given a set of already-classified cut parameters.
(() => {
  const TAU = Math.PI * 2
  const { PARAMETER_TOLERANCE } = window.CaderactIntersectionClassifier
  const isClosed = curve => curve.kind === "circle" || curve.kind === "ellipse"

  // Sorts and deduplicates actionable cut parameters on a target curve.
  // Closed curves sort by angle (arbitrary seam at 0); open curves sort
  // numerically. Near-duplicate parameters (including ones effectively equal
  // once wrapped, e.g. an angle at ~0 and one at ~TAU) collapse to one.
  function sortedUniqueParameters(curve, parameters) {
    const normalize = p => (isClosed(curve) ? ((p % TAU) + TAU) % TAU : p)
    const sorted = parameters.map(normalize).filter(Number.isFinite).sort((a, b) => a - b)
    const unique = []
    for (const parameter of sorted) {
      const previous = unique[unique.length - 1]
      if (previous === undefined || Math.abs(parameter - previous) > PARAMETER_TOLERANCE) unique.push(parameter)
    }
    if (isClosed(curve) && unique.length > 1 && TAU - unique[unique.length - 1] + unique[0] <= PARAMETER_TOLERANCE) unique.pop()
    return Object.freeze(unique)
  }

  // Builds the parameter intervals the sorted cut parameters carve out of the
  // target curve. For open curves (Line, Arc) the curve's own endpoints (0
  // and 1) always bound the outermost intervals. For closed curves (Circle,
  // Ellipse) intervals wrap continuously; `end` is expressed as start plus
  // the forward angular distance so it may exceed TAU for the wrap interval,
  // keeping containment tests a single unwrapped comparison.
  function buildIntervals(curve, sortedParameters) {
    if (sortedParameters.length === 0) return Object.freeze([])
    if (isClosed(curve)) {
      if (sortedParameters.length === 1) return Object.freeze([Object.freeze({ start: sortedParameters[0], end: sortedParameters[0] + TAU })])
      const intervals = []
      for (let i = 0; i < sortedParameters.length; i++) {
        const start = sortedParameters[i], rawEnd = sortedParameters[(i + 1) % sortedParameters.length]
        const end = rawEnd > start ? rawEnd : rawEnd + TAU
        intervals.push(Object.freeze({ start, end }))
      }
      return Object.freeze(intervals)
    }
    const boundaries = [0, ...sortedParameters, 1].filter((p, index, all) => index === 0 || p - all[index - 1] > PARAMETER_TOLERANCE)
    const intervals = []
    for (let i = 0; i < boundaries.length - 1; i++) intervals.push(Object.freeze({ start: boundaries[i], end: boundaries[i + 1] }))
    return Object.freeze(intervals)
  }

  function intervalContains(curve, interval, parameter, epsilon = PARAMETER_TOLERANCE) {
    if (!isClosed(curve)) return parameter >= interval.start - epsilon && parameter <= interval.end + epsilon
    const unwrapped = interval.start + (((parameter - interval.start) % TAU) + TAU) % TAU
    return unwrapped <= interval.end + epsilon
  }

  // Finds the index of the interval that contains the clicked parameter (the
  // segment of the target the user actually picked). Returns -1 if the click
  // does not fall within any interval (e.g. exactly on a boundary with
  // rounding pushed it out, or no intervals exist).
  function findContainingInterval(curve, intervals, clickedParameter) {
    for (let index = 0; index < intervals.length; index++) if (intervalContains(curve, intervals[index], clickedParameter)) return index
    return -1
  }

  // The intervals that remain on the target after removing the one containing
  // the clicked parameter -- i.e. what Trim keeps once the clicked span is cut.
  function survivingIntervals(intervals, containingIndex) {
    if (containingIndex < 0 || containingIndex >= intervals.length) return intervals
    return Object.freeze(intervals.filter((_, index) => index !== containingIndex))
  }

  window.CaderactTrimIntervals = Object.freeze({
    sortedUniqueParameters, buildIntervals, findContainingInterval, survivingIntervals, intervalContains,
  })
})()
