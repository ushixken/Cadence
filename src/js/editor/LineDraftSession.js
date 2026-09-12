// A5: command-local Line draft. Nothing in this session is authoritative
// document state until finish() successfully publishes all segments at once.
(() => {
  function copyPoint(point) { return Object.freeze({ x: point.x, y: point.y }) }
  function samePoint(a, b) { return a?.x === b?.x && a?.y === b?.y }

  function createSession({ createSegment, commitSegments }) {
    let currentPoint = null
    let pointerPoint = null
    const segments = []

    function acceptPoint(point) {
      const accepted = copyPoint(point)
      if (currentPoint === null) {
        currentPoint = accepted
        pointerPoint = accepted
        return Object.freeze({ status: "first-point" })
      }
      const segment = createSegment(currentPoint, accepted)
      segments.push(segment)
      currentPoint = accepted
      pointerPoint = accepted
      return Object.freeze({ status: "segment-added", segmentId: segment.id })
    }

    function updatePointer(point) {
      if (currentPoint !== null) pointerPoint = copyPoint(point)
    }
    function clearPointer() { pointerPoint = null }
    function preview() {
      if (currentPoint === null || pointerPoint === null) return null
      return Object.freeze({ start: currentPoint, end: pointerPoint })
    }
    function draftSegments() { return Object.freeze(segments.slice()) }

    function stepUndo() {
      if (segments.length === 0) return Object.freeze({ status: "no-step" })
      const removed = segments.pop()
      currentPoint = copyPoint(removed.start)
      return Object.freeze({ status: "step-undone", segmentId: removed.id })
    }

    function clear() {
      segments.length = 0
      currentPoint = null
      pointerPoint = null
    }
    function finish() {
      if (segments.length === 0) return Object.freeze({ status: "no-op" })
      const outcome = commitSegments(segments)
      if (outcome.status === "committed") clear()
      return outcome
    }
    function canClose() {
      const points = acceptedPoints()
      if (points.length < 3) return false
      return new Set(points.map(point => `${point.x}:${point.y}`)).size >= 3
    }
    function close() {
      if (!canClose()) return Object.freeze({ status: "close-unavailable" })
      const firstPoint = segments[0].start
      if (!samePoint(currentPoint, firstPoint)) {
        const closingSegment = createSegment(currentPoint, firstPoint)
        segments.push(closingSegment)
        currentPoint = copyPoint(firstPoint)
        pointerPoint = currentPoint
      }
      return finish()
    }
    function cancel() {
      clear()
      return Object.freeze({ status: "cancelled" })
    }

    function acceptedPoints() {
      if (currentPoint === null) return Object.freeze([])
      const points = segments.map(segment => copyPoint(segment.start))
      points.push(copyPoint(currentPoint))
      return Object.freeze(points)
    }

    return Object.freeze({
      acceptPoint, updatePointer, clearPointer, preview, draftSegments, acceptedPoints,
      stepUndo, finish, close, cancel,
      get segmentCount() { return segments.length },
      get hasFirstPoint() { return currentPoint !== null },
      get firstPoint() { return segments[0]?.start || currentPoint },
      get currentPoint() { return currentPoint },
      get canClose() { return canClose() },
    })
  }

  window.CaderactLineDraftSession = Object.freeze({ createSession })
})()
