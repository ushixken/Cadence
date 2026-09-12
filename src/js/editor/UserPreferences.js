(() => {
  const KEY = "caderact:user-preferences", VERSION = 1
  const defaults = Object.freeze({ gridVisible: true, gridSnapEnabled: false, orthoEnabled: false, polarEnabled: false, polarIncrementDegrees: 45 })
  const increments = new Set([5,10,15,30,45,90])
  function normalize(input = {}) { const next = { ...defaults }; for (const key of Object.keys(defaults)) if (key in input) next[key] = input[key]; next.gridVisible=Boolean(next.gridVisible);next.gridSnapEnabled=Boolean(next.gridSnapEnabled);next.orthoEnabled=Boolean(next.orthoEnabled);next.polarEnabled=Boolean(next.polarEnabled);if(!increments.has(next.polarIncrementDegrees))next.polarIncrementDegrees=defaults.polarIncrementDegrees;if(next.orthoEnabled)next.polarEnabled=false;return Object.freeze(next) }
  function create({ storage = window.localStorage } = {}) { let value=normalize();const listeners=new Set();try{const raw=storage?.getItem(KEY);if(raw){const payload=JSON.parse(raw);if(payload?.version===VERSION)value=normalize(payload.preferences)}}catch{}function emit(){for(const listener of listeners)listener(value)}function save(){try{storage?.setItem(KEY,JSON.stringify({version:VERSION,preferences:value}))}catch{}}function set(patch){value=normalize({...value,...patch});save();emit();return value}return Object.freeze({defaults,get value(){return value},set,reset:()=>set(defaults),subscribe(listener){listeners.add(listener);listener(value);return()=>listeners.delete(listener)}})}
  window.CaderactUserPreferences=Object.freeze({KEY,VERSION,defaults,normalize,create})
})()
