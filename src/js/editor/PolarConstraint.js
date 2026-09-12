// P2: model-space polar tracking with a fixed angular acquisition window.
(() => {
  const DEFAULT_INCREMENT_DEGREES = 45
  const ACQUISITION_TOLERANCE_DEGREES = 10
  const radians = degrees => degrees * Math.PI / 180
  const normalize = angle => Math.atan2(Math.sin(angle), Math.cos(angle))
  function constrain(point, reference, incrementDegrees = DEFAULT_INCREMENT_DEGREES) {
    if (![point?.x, point?.y, reference?.x, reference?.y].every(Number.isFinite)) return Object.freeze({ point: Object.freeze({ ...point }), tracked: false })
    const dx = point.x - reference.x, dy = point.y - reference.y, distance = Math.hypot(dx, dy)
    if (distance === 0) return Object.freeze({ point: Object.freeze({ ...point }), tracked: false })
    const increment = radians(incrementDegrees), rawAngle = Math.atan2(dy, dx), index = Math.floor(rawAngle / increment + 0.5), angle = index * increment
    if (Math.abs(normalize(rawAngle - angle)) > radians(ACQUISITION_TOLERANCE_DEGREES)) return Object.freeze({ point: Object.freeze({ ...point }), tracked: false })
    return Object.freeze({ point: Object.freeze({ x: reference.x + distance * Math.cos(angle), y: reference.y + distance * Math.sin(angle) }), tracked: true, angle })
  }
  window.CaderactPolarConstraint = Object.freeze({ DEFAULT_INCREMENT_DEGREES, ACQUISITION_TOLERANCE_DEGREES, constrain })
})()
