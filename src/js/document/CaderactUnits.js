// A9: command-agnostic document length-unit utilities.
(() => {
  const MILLIMETERS_PER_UNIT = Object.freeze({ mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 })
  const supportedLengthUnits = Object.freeze(Object.keys(MILLIMETERS_PER_UNIT))

  function isSupportedLengthUnit(unit) {
    return typeof unit === "string" && Object.hasOwn(MILLIMETERS_PER_UNIT, unit)
  }
  function requireUnit(unit) {
    if (!isSupportedLengthUnit(unit)) throw new Error(`Unsupported length unit ${String(unit)}`)
  }
  function conversionFactor(fromUnit, toUnit) {
    requireUnit(fromUnit); requireUnit(toUnit)
    return MILLIMETERS_PER_UNIT[fromUnit] / MILLIMETERS_PER_UNIT[toUnit]
  }
  function convert(value, fromUnit, toUnit) {
    if (!Number.isFinite(value)) throw new Error("Measurement must be finite")
    requireUnit(fromUnit); requireUnit(toUnit)
    const converted = value * MILLIMETERS_PER_UNIT[fromUnit] / MILLIMETERS_PER_UNIT[toUnit]
    if (!Number.isFinite(converted)) throw new Error("Converted measurement must be finite")
    return converted
  }
  function format(value, unit, precision = 3) {
    if (!Number.isFinite(value)) throw new Error("Measurement must be finite")
    requireUnit(unit)
    if (!Number.isInteger(precision) || precision < 0 || precision > 15) throw new Error("Precision must be an integer from 0 to 15")
    const fixed = value.toFixed(precision)
    return `${Number(fixed) === 0 ? (0).toFixed(precision) : fixed} ${unit}`
  }
  function formatArea(value,unit,precision=3){
    if(!Number.isFinite(value))throw new Error("Measurement must be finite")
    requireUnit(unit)
    if(!Number.isInteger(precision)||precision<0||precision>15)throw new Error("Precision must be an integer from 0 to 15")
    const fixed=value.toFixed(precision)
    return `${Number(fixed)===0?(0).toFixed(precision):fixed} ${unit}²`
  }

  window.CaderactUnits = Object.freeze({
    supportedLengthUnits, isSupportedLengthUnit, conversionFactor, convert, format, formatArea,
  })
})()
