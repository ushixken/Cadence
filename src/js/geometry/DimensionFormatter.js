// Pure presentation formatting for native dimensions.
(() => {
  function fixed(value, precision) {
    const text = value.toFixed(precision)
    return Number(text) === 0 ? (0).toFixed(precision) : text
  }
  function format(measurement, style, units, controls = null) {
    const record=controls&&typeof controls==="object"?controls:null,override=record?record.textOverride:controls
    if (typeof override === "string" && override !== "") return override
    const angular = measurement.kind === "angular"
    const precision = angular ? style.angularPrecision : style.linearPrecision
    const radialPrefix=measurement.radialMode==="radius"?"R":measurement.radialMode==="diameter"?"Ø":""
    const body = angular ? `${fixed(measurement.value * 180 / Math.PI, precision)}°`
      : `${radialPrefix}${fixed(measurement.value, precision)}${style.showUnit ? ` ${units.length}` : ""}`
    const prefix=record?.prefixOverride??style.prefix,suffix=record?.suffixOverride??style.suffix,base=`${prefix}${body}${suffix}`,mode=record?.toleranceMode??"none"
    if(mode==="symmetric")return`${base} ±${fixed(record.toleranceUpper,precision)}`
    if(mode==="deviation")return`${base} +${fixed(record.toleranceUpper,precision)} / -${fixed(record.toleranceLower,precision)}`
    return base
  }
  window.CaderactDimensionFormatter = Object.freeze({ format })
})()
