// DXF3: pure conversion from neutral DXF appearance values to Caderact's vocabulary.
(() => {
  const NATIVE_LINEWEIGHTS = Object.freeze([0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1])
  const DXF_LINEWEIGHTS = Object.freeze(new Set([-3,-2,-1,0,5,9,13,15,18,20,25,30,35,40,50,53,60,70,80,90,100,106,120,140,158,200,211]))
  const BASIC_ACI = Object.freeze({ 1:[255,0,0], 2:[255,255,0], 3:[0,255,0], 4:[0,255,255],
    5:[0,0,255], 6:[255,0,255], 7:[255,255,255], 8:[128,128,128], 9:[192,192,192],
    250:[51,51,51], 251:[80,80,80], 252:[105,105,105], 253:[130,130,130], 254:[190,190,190], 255:[255,255,255] })
  const hex = value => value.toString(16).padStart(2, "0")
  function rgbHex(red, green, blue) { return `#${hex(red)}${hex(green)}${hex(blue)}` }
  function aciToHex(index) {
    if (!Number.isInteger(index) || index < 1 || index > 255) return null
    if (BASIC_ACI[index]) return rgbHex(...BASIC_ACI[index])
    const offset = index - 10, hue = Math.floor(offset / 10) * 15, shade = offset % 10
    const value = [1,1,.8,.8,.6,.6,.5,.5,.3,.3][shade]
    const saturation = shade % 2 ? .5 : 1
    const chroma = value * saturation, segment = hue / 60, x = chroma * (1 - Math.abs(segment % 2 - 1)), match = value - chroma
    let rgb
    if (segment < 1) rgb=[chroma,x,0]; else if(segment<2)rgb=[x,chroma,0]; else if(segment<3)rgb=[0,chroma,x]
    else if(segment<4)rgb=[0,x,chroma]; else if(segment<5)rgb=[x,0,chroma]; else rgb=[chroma,0,x]
    return rgbHex(...rgb.map(channel => Math.floor((channel + match) * 255 + 1e-9)))
  }
  function trueColorToHex(value) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffff) return null
    return `#${value.toString(16).padStart(6, "0")}`
  }
  function linetype(name) {
    const key = String(name || "BYLAYER").trim().toUpperCase().replaceAll("_", "-")
    if (key === "BYLAYER") return Object.freeze({ value:null, loss:null })
    if (key === "BYBLOCK") return Object.freeze({ value:null, loss:"byblock" })
    if (key === "CONTINUOUS") return Object.freeze({ value:"continuous", loss:null })
    if (["DASHED","HIDDEN","HIDDEN2"].includes(key)) return Object.freeze({ value:"dashed", loss:null })
    if (["DOT","DOTTED"].includes(key)) return Object.freeze({ value:"dotted", loss:null })
    if (["DASHDOT","DASH-DOT"].includes(key)) return Object.freeze({ value:"dash-dot", loss:null })
    return Object.freeze({ value:null, loss:"unsupported" })
  }
  function nearestLineweight(code) {
    const millimeters = code / 100
    return NATIVE_LINEWEIGHTS.reduce((best, candidate) => Math.abs(candidate-millimeters) < Math.abs(best-millimeters) ? candidate : best)
  }
  function lineweight(code, { layer = false } = {}) {
    if (!DXF_LINEWEIGHTS.has(code)) return Object.freeze({ value:layer ? .25 : null, loss:"invalid" })
    if (code === -1) return layer ? Object.freeze({value:.25,loss:"layer-inheritance"}) : Object.freeze({value:null,loss:null})
    if (code === -2) return Object.freeze({value:layer ? .25 : null,loss:"byblock"})
    if (code === -3) return Object.freeze({value:.25,loss:null})
    const value=nearestLineweight(code),exact=value===code/100
    return Object.freeze({value,loss:exact?null:"nearest"})
  }
  window.CaderactDxfProperties=Object.freeze({aciToHex,trueColorToHex,linetype,lineweight,DXF_LINEWEIGHTS,NATIVE_LINEWEIGHTS})
})()
