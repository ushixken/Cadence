// L4: renderer-neutral persistent object-property vocabulary and pure resolution.
(() => {
  const PROPERTY_KEYS=Object.freeze(["color","linetype","lineweight"])
  const LINETYPES=Object.freeze(["continuous","dashed","dotted","dash-dot"])
  const LINEWEIGHTS=Object.freeze([0.13,0.18,0.25,0.35,0.5,0.7,1])
  const DEFAULT_LAYER_PROPERTIES=Object.freeze({color:"#e8edf4",linetype:"continuous",lineweight:0.25})
  const BY_LAYER_PROPERTIES=Object.freeze({color:null,linetype:null,lineweight:null})
  const MIXED=Symbol("Caderact mixed property value")
  const has=(value,key)=>Object.prototype.hasOwnProperty.call(value,key)
  const validColor=value=>typeof value==="string"&&/^#[0-9a-fA-F]{6}$/.test(value)
  const validLinetype=value=>LINETYPES.includes(value)
  const validLineweight=value=>Number.isFinite(value)&&LINEWEIGHTS.includes(value)
  function validatePatch(patch){
    if(!patch||typeof patch!=="object"||Array.isArray(patch))return Object.freeze({valid:false,reason:"invalid-property-patch"})
    const keys=Object.keys(patch)
    if(!keys.length)return Object.freeze({valid:false,reason:"empty-property-patch"})
    if(keys.some(key=>!PROPERTY_KEYS.includes(key)))return Object.freeze({valid:false,reason:"unknown-property"})
    for(const key of keys){const value=patch[key];if(value===null)continue;if(key==="color"&&!validColor(value))return Object.freeze({valid:false,reason:"invalid-color"});if(key==="linetype"&&!validLinetype(value))return Object.freeze({valid:false,reason:"invalid-linetype"});if(key==="lineweight"&&!validLineweight(value))return Object.freeze({valid:false,reason:"invalid-lineweight"})}
    return Object.freeze({valid:true,patch:Object.freeze(Object.fromEntries(keys.map(key=>[key,patch[key]])))})
  }
  function recordProperties(record){return Object.freeze(Object.fromEntries(PROPERTY_KEYS.map(key=>[key,has(record||{},key)?record[key]:null]))) }
  function layerProperties(layer){return Object.freeze(Object.fromEntries(PROPERTY_KEYS.map(key=>[key,has(layer||{},key)?layer[key]:DEFAULT_LAYER_PROPERTIES[key]]))) }
  function effective(record,layer,key){const value=recordProperties(record)[key];return value===null?layerProperties(layer)[key]:value}
  function aggregate(records){const values={};for(const key of PROPERTY_KEYS){const propertyValues=Array.from(records||[],record=>recordProperties(record)[key]);values[key]=propertyValues.length===0?null:propertyValues.every(value=>Object.is(value,propertyValues[0]))?propertyValues[0]:MIXED}return Object.freeze(values)}
  window.CaderactObjectProperties=Object.freeze({PROPERTY_KEYS,LINETYPES,LINEWEIGHTS,DEFAULT_LAYER_PROPERTIES,BY_LAYER_PROPERTIES,MIXED,validColor,validLinetype,validLineweight,validatePatch,recordProperties,layerProperties,effectiveColor:(record,layer)=>effective(record,layer,"color"),effectiveLinetype:(record,layer)=>effective(record,layer,"linetype"),effectiveLineweight:(record,layer)=>effective(record,layer,"lineweight"),aggregate})
})()
