// D7: command-local three-point Arc draft; publication occurs only after valid P3.
(() => {
  const copyPoint = point => Object.freeze({ x: point.x, y: point.y })
  function createSession({ createArc, commitRecords }) {
    let first = null, second = null, current = null
    function clear() { first = null; second = null; current = null }
    function acceptedPoints() { return Object.freeze([first, second].filter(Boolean).map(copyPoint)) }
    function updatePointer(point) { if (first) current = copyPoint(point) }
    function clearPointer() { current = null }
    function preview() {
      if (!first || !second || !current) return null
      const derived = window.CaderactArcGeometry.fromThreePoints(first, second, current)
      return derived.valid ? derived : null
    }
    function acceptPoint(point) {
      const accepted = copyPoint(point)
      if (!first) { first = accepted; current = accepted; return Object.freeze({ status: "start-accepted" }) }
      if (!second) {
        if (accepted.x === first.x && accepted.y === first.y) return Object.freeze({ status: "repeated-point" })
        second = accepted; current = accepted; return Object.freeze({ status: "second-accepted" })
      }
      current = accepted
      const derived = window.CaderactArcGeometry.fromThreePoints(first, second, accepted)
      if (!derived.valid) return Object.freeze({ status: "invalid-arc", reason: derived.reason })
      const record = createArc(derived)
      const outcome = commitRecords([record])
      if (outcome.status === "committed") clear()
      return outcome.status === "committed" ? Object.freeze({ status: "arc-committed", recordId: record.id }) : outcome
    }
    function finish() { clear(); return Object.freeze({ status: "no-op" }) }
    function cancel() { clear(); return Object.freeze({ status: "cancelled" }) }
    return Object.freeze({ acceptPoint, updatePointer, clearPointer, preview, acceptedPoints, finish, cancel,
      get firstPoint() { return first }, get secondPoint() { return second }, get currentPoint() { return second || first },
      get hasFirstPoint() { return first !== null }, get hasSecondPoint() { return second !== null } })
  }
  window.CaderactArcDraftSession = Object.freeze({ createSession })
})()
