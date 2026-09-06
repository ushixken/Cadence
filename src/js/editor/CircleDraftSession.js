// D6: command-local center/radius-point Circle draft. Exact semantic geometry
// is published only after a non-zero radius is accepted.
(() => {
  function copyPoint(point) { return Object.freeze({ x: point.x, y: point.y }) }
  function radiusBetween(center, radiusPoint) { return Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y) }

  function createSession({ createCircle, commitRecords }) {
    let center = null
    let radiusPoint = null

    function clear() { center = null; radiusPoint = null }
    function updatePointer(point) { if (center !== null) radiusPoint = copyPoint(point) }
    function clearPointer() { radiusPoint = null }
    function preview() {
      if (center === null || radiusPoint === null) return null
      const radius = radiusBetween(center, radiusPoint)
      return Number.isFinite(radius) && radius > 0 ? Object.freeze({ center, radius }) : null
    }
    function acceptedPoints() { return Object.freeze(center ? [copyPoint(center)] : []) }
    function acceptPoint(point) {
      const accepted = copyPoint(point)
      if (center === null) {
        center = accepted; radiusPoint = accepted
        return Object.freeze({ status: "center-accepted" })
      }
      const radius = radiusBetween(center, accepted)
      radiusPoint = accepted
      if (!Number.isFinite(radius) || radius <= 0) return Object.freeze({ status: "zero-radius" })
      const record = createCircle(center, radius)
      const outcome = commitRecords([record])
      if (outcome.status === "committed") clear()
      return outcome.status === "committed"
        ? Object.freeze({ status: "circle-committed", recordId: record.id })
        : outcome
    }
    function finish() { clear(); return Object.freeze({ status: "no-op" }) }
    function cancel() { clear(); return Object.freeze({ status: "cancelled" }) }

    return Object.freeze({
      acceptPoint, updatePointer, clearPointer, preview, acceptedPoints, finish, cancel,
      get hasCenter() { return center !== null }, get center() { return center }, get radiusPoint() { return radiusPoint },
      get radius() { return center && radiusPoint ? radiusBetween(center, radiusPoint) : null },
    })
  }

  window.CaderactCircleDraftSession = Object.freeze({ createSession, radiusBetween })
})()
