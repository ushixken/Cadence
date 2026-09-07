// D9: transient immutable-point Ellipse draft; publication occurs only at valid P3.
(() => {
  const copyPoint = point => Object.freeze({ x: point.x, y: point.y })
  function createSession({ createEllipse, commitRecords }) {
    let first = null, second = null, current = null
    function clear() { first = null; second = null; current = null }
    function acceptedPoints() { return Object.freeze([first, second].filter(Boolean).map(copyPoint)) }
    function updatePointer(point) { if (first) current = copyPoint(point) }
    function clearPointer() { current = null }
    function preview() {
      if (!first || !second || !current) return null
      const geometry = window.CaderactEllipseGeometry.fromAxisEndpoints(first, second, current)
      return geometry.valid ? geometry : null
    }
    function acceptPoint(point) {
      const accepted = copyPoint(point)
      if (!first) { first = accepted; current = accepted; return Object.freeze({ status: "first-axis-point-accepted" }) }
      if (!second) {
        const geometry = window.CaderactEllipseGeometry.fromAxisEndpoints(first, accepted, { x: first.x - (accepted.y-first.y), y: first.y + (accepted.x-first.x) })
        if (!geometry.valid) return Object.freeze({ status: "invalid-first-axis", reason: geometry.reason })
        second = accepted; current = accepted; return Object.freeze({ status: "second-axis-point-accepted" })
      }
      current = accepted
      const geometry = window.CaderactEllipseGeometry.fromAxisEndpoints(first, second, accepted)
      if (!geometry.valid) return Object.freeze({ status: "invalid-second-axis", reason: geometry.reason })
      const record = createEllipse(geometry)
      const outcome = commitRecords([record])
      if (outcome.status === "committed") clear()
      return outcome.status === "committed" ? Object.freeze({ status: "ellipse-committed", recordId: record.id }) : outcome
    }
    function finish() { clear(); return Object.freeze({ status: "no-op" }) }
    function cancel() { clear(); return Object.freeze({ status: "cancelled" }) }
    return Object.freeze({ acceptPoint, updatePointer, clearPointer, preview, acceptedPoints, finish, cancel,
      get firstPoint() { return first }, get secondPoint() { return second }, get currentPoint() { return second || first },
      get hasFirstPoint() { return first !== null }, get hasSecondPoint() { return second !== null } })
  }
  window.CaderactEllipseDraftSession = Object.freeze({ createSession })
})()
