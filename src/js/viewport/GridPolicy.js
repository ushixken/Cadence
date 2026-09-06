(() => {
  const minimumByLengthUnit = Object.freeze({
    mm: 1,
    cm: 0.1,
    m: 0.001,
    in: 1 / 16,
    ft: 1 / 192,
  })

  function minimumGridSpacing(lengthUnit) {
    const spacing = minimumByLengthUnit[lengthUnit]
    if (!Number.isFinite(spacing) || spacing <= 0) throw new Error(`Unsupported grid length unit: ${lengthUnit}`)
    return spacing
  }

  window.CaderactGridPolicy = Object.freeze({ minimumGridSpacing, minimumByLengthUnit })
})()
