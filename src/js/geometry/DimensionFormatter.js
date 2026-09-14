// Pure presentation formatting for native dimensions.
(() => {
  function fixed(value, precision) {
    const text = value.toFixed(precision)
    return Number(text) === 0 ? (0).toFixed(precision) : text
  }
  function format(measurement, style, units, override = null) {
    if (typeof override === "string" && override !== "") return override
    const angular = measurement.kind === "angular"
    const precision = angular ? style.angularPrecision : style.linearPrecision
    const radialPrefix=measurement.radialMode==="radius"?"R":measurement.radialMode==="diameter"?"Ø":""
    const body = angular ? `${fixed(measurement.value * 180 / Math.PI, precision)}°`
      : `${radialPrefix}${fixed(measurement.value, precision)}${style.showUnit ? ` ${units.length}` : ""}`
    return `${style.prefix}${body}${style.suffix}`
  }
  window.CaderactDimensionFormatter = Object.freeze({ format })
})()
