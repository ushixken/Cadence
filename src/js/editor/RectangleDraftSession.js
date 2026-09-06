// D4: command-local axis-aligned Rectangle draft. The four Line records are
// constructed and published together only after a valid opposite corner.
(() => {
  function copyPoint(point) { return Object.freeze({ x: point.x, y: point.y }) }

  function deriveEdges(first, opposite) {
    if (!first || !opposite || first.x === opposite.x || first.y === opposite.y) return Object.freeze([])
    const a = copyPoint(first)
    const b = copyPoint({ x: opposite.x, y: first.y })
    const c = copyPoint(opposite)
    const d = copyPoint({ x: first.x, y: opposite.y })
    return Object.freeze([
      Object.freeze({ start: a, end: b }), Object.freeze({ start: b, end: c }),
      Object.freeze({ start: c, end: d }), Object.freeze({ start: d, end: a }),
    ])
  }

  function createSession({ createSegment, commitSegments }) {
    let firstCorner = null
    let pointerPoint = null

    function clear() { firstCorner = null; pointerPoint = null }
    function updatePointer(point) { if (firstCorner !== null) pointerPoint = copyPoint(point) }
    function clearPointer() { pointerPoint = null }
    function previewEdges() { return deriveEdges(firstCorner, pointerPoint) }
    function acceptedPoints() { return Object.freeze(firstCorner ? [copyPoint(firstCorner)] : []) }

    function acceptPoint(point) {
      const accepted = copyPoint(point)
      if (firstCorner === null) {
        firstCorner = accepted
        pointerPoint = accepted
        return Object.freeze({ status: "first-corner" })
      }
      const edges = deriveEdges(firstCorner, accepted)
      pointerPoint = accepted
      if (edges.length !== 4) return Object.freeze({ status: "degenerate-rectangle" })
      const records = edges.map(edge => createSegment(edge.start, edge.end))
      const outcome = commitSegments(records)
      if (outcome.status === "committed") clear()
      return outcome.status === "committed"
        ? Object.freeze({ status: "rectangle-committed", recordIds: Object.freeze(records.map(record => record.id)) })
        : outcome
    }

    function finish() { clear(); return Object.freeze({ status: "no-op" }) }
    function cancel() { clear(); return Object.freeze({ status: "cancelled" }) }

    return Object.freeze({
      acceptPoint, updatePointer, clearPointer, previewEdges, acceptedPoints, finish, cancel,
      get hasFirstCorner() { return firstCorner !== null },
      get firstCorner() { return firstCorner },
      get pointerPoint() { return pointerPoint },
    })
  }

  window.CaderactRectangleDraftSession = Object.freeze({ createSession, deriveEdges })
})()
