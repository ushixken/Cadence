// UX13: retain the exact displayed presentation during a theme-to-Custom handoff.
(() => {
  const roles = Object.freeze({backgroundColor:'background',geometryColor:'geometry',previewColor:'geometry',gridColor:'gridMinor',majorGridColor:'gridMajor',gridBoundaryColor:'gridMajor',xAxisColor:'axisX',yAxisColor:'axisY',snapMarkerColor:'osnap',selectionColor:'selection',trackingGuideColor:'tracking',trackingMarkerColor:'tracking',gripColor:'grip',gripHoverColor:'gripHover',gripActiveColor:'selection',selectionWindowColor:'selection',selectionCrossingColor:'tracking',draftPointColor:'geometry',acceptedDraftColor:'geometry',moveSourceGhostColor:'geometry',moveGuideColor:'osnap',rotateCenterMarkerColor:'osnap',rotateReferenceMarkerColor:'tracking',rotateTargetMarkerColor:'selection'})
  const tokens = Object.freeze({'--surface-viewport':'background','--cad-grip':'grip','--cad-grip-hover':'gripHover','--cad-osnap':'osnap','--cad-track':'tracking','--cad-crosshair':'crosshair','--surface-viewport-hud':'dynamicSurface','--surface-viewport-field':'dynamicSurface','--cad-hud-text':'dynamicText','--cad-hud-muted':'dynamicText','--cad-hud-border':'dynamicSurface','--cad-hud-field-border':'dynamicSurface','--cad-hud-active':'dynamicText','--cad-hud-tag':'dynamicText'})
  const valid = value => typeof value==='string' && (/^#[\da-f]{6}$/i.test(value)||/^rgba?\(\s*[\d.]+[, ]+[\d.]+[, ]+[\d.]+(?:\s*[,/]\s*[\d.]+)?\s*\)$/.test(value))
  function normalize(value) {
    if(!value||typeof value!=='object')return null
    const colors={},renderer={},css={}
    for(const role of new Set(Object.values(roles).concat(Object.values(tokens))))if(/^#[\da-f]{6}$/i.test(value.colors?.[role]))colors[role]=value.colors[role].toLowerCase()
    for(const key of Object.keys(roles))if(valid(value.renderer?.[key]))renderer[key]=value.renderer[key]
    for(const key of Object.keys(tokens))if(valid(value.css?.[key]))css[key]=value.css[key]
    return Object.freeze({colors:Object.freeze(colors),renderer:Object.freeze(renderer),css:Object.freeze(css)})
  }
  function preserved(value,colors,kind) {
    const map=kind==='renderer'?roles:tokens,result={}
    for(const [key,role] of Object.entries(map))if(value?.[kind]?.[key]&&value.colors[role]===colors[role])result[key]=value[kind][key]
    return result
  }
  function hex(value,fallback) {
    if(/^#[\da-f]{6}$/i.test(value||''))return value.toLowerCase()
    const channels=String(value).match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/)
    return channels?'#'+channels.slice(1,4).map(v=>Math.round(Number(v)).toString(16).padStart(2,'0')).join(''):fallback
  }
  window.CaderactCanvasAppearance=Object.freeze({roles,tokens,normalize,preserved,hex})
})()
