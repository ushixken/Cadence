// DXF4: pure, bounded decoding for the Unicode escape form used by DXF strings.
(() => {
  function decode(value) {
    return value.replace(/\\U\+([0-9a-fA-F]{4})/g, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
  }
  window.CaderactDxfText = Object.freeze({ decode })
})()
