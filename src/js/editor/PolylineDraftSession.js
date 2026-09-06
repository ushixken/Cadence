// D5: connected, command-local Polyline draft. Segments remain transient until
// finish() or close() publishes the whole path in one transaction.
(() => {
  function copyPoint(point) { return Object.freeze({ x: point.x, y: point.y }) }
  function samePoint(a, b) { return a?.x === b?.x && a?.y === b?.y }

  function createSession({ createSegment, commitSegments }) {
    const points = []
    const segments = []
    let pointerPoint = null

    function clear() { points.length = 0; segments.length = 0; pointerPoint = null }
    function acceptPoint(point) {
      const accepted = copyPoint(point)
      if (points.length === 0) {
        points.push(accepted); pointerPoint = accepted
        return Object.freeze({ status: "first-point" })
      }
      const latest = points[points.length - 1]
      if (samePoint(latest, accepted)) return Object.freeze({ status: "repeated-point" })
      const segment = createSegment(latest, accepted)
      segments.push(segment); points.push(accepted); pointerPoint = accepted
      return Object.freeze({ status: "segment-added", segmentId: segment.id })
    }
    function updatePointer(point) { if (points.length > 0) pointerPoint = copyPoint(point) }
    function clearPointer() { pointerPoint = null }
    function preview() {
      if (points.length === 0 || pointerPoint === null) return null
      return Object.freeze({ start: points[points.length - 1], end: pointerPoint })
    }
    function draftSegments() { return Object.freeze(segments.slice()) }
    function acceptedPoints() { return Object.freeze(points.map(copyPoint)) }

    function publish(status) {
      if (segments.length === 0) return Object.freeze({ status: "no-op" })
      const outcome = commitSegments(segments)
      if (outcome.status === "committed") {
        const recordIds = Object.freeze(segments.map(segment => segment.id))
        clear()
        return Object.freeze({ status, recordIds })
      }
      return outcome
    }
    function finish() { return publish("polyline-committed") }
    function close() {
      if (segments.length === 0) return Object.freeze({ status: "close-unavailable" })
      const first = points[0], latest = points[points.length - 1]
      if (!samePoint(first, latest)) {
        const closing = createSegment(latest, first)
        segments.push(closing); points.push(first); pointerPoint = first
      }
      return publish("polyline-closed")
    }
    function stepUndo() {
      pointerPoint = null
      if (segments.length > 0) {
        const removed = segments.pop(); points.pop()
        return Object.freeze({ status: "step-undone", segmentId: removed.id })
      }
      if (points.length === 1) {
        points.pop()
        return Object.freeze({ status: "step-undone", pointOnly: true })
      }
      return Object.freeze({ status: "no-step" })
    }
    function cancel() { clear(); return Object.freeze({ status: "cancelled" }) }

    return Object.freeze({
      acceptPoint, updatePointer, clearPointer, preview, draftSegments, acceptedPoints,
      finish, close, stepUndo, cancel,
      get pointCount() { return points.length }, get segmentCount() { return segments.length },
      get hasFirstPoint() { return points.length > 0 },
      get firstPoint() { return points[0] || null }, get currentPoint() { return points.at(-1) || null },
      get canClose() { return segments.length > 0 },
    })
  }

  window.CaderactPolylineDraftSession = Object.freeze({ createSession, samePoint })
})()
