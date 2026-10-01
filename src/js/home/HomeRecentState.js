(() => {
  const STORAGE_KEY="caderact.home.recents.v1",LIMIT=12,SOURCES=new Set(["Caderact","DXF"])
  const storage=()=>{try{return window.localStorage}catch{return null}}
  function normalizeEntry(value){
    if(!value||typeof value!=="object")return null
    const name=typeof value.name==="string"?value.name.trim().slice(0,180):"",source=SOURCES.has(value.source)?value.source:null,lastOpened=Number(value.lastOpened),lastModified=value.lastModified===null?null:Number(value.lastModified)
    if(!name||!source||!Number.isFinite(lastOpened)||lastOpened<=0||!(lastModified===null||Number.isFinite(lastModified)&&lastModified>=0))return null
    return Object.freeze({id:`${source.toLowerCase()}:${name.toLowerCase()}`,name,source,lastOpened,lastModified})
  }
  function normalize(value){const entries=Array.isArray(value)?value:[],seen=new Set(),result=[];for(const candidate of entries){const entry=normalizeEntry(candidate);if(!entry||seen.has(entry.id))continue;seen.add(entry.id);result.push(entry);if(result.length===LIMIT)break}return Object.freeze(result.sort((a,b)=>b.lastOpened-a.lastOpened))}
  function create({persistence=storage()}={}){
    let value=[];try{value=normalize(JSON.parse(persistence?.getItem(STORAGE_KEY)||"[]"))}catch{value=Object.freeze([])}
    const listeners=new Set(),notify=()=>{for(const listener of listeners)listener(value)},write=()=>{try{persistence?.setItem(STORAGE_KEY,JSON.stringify(value))}catch{}}
    function record(entry){const normalized=normalizeEntry(entry);if(!normalized)return Object.freeze({status:"invalid-recent"});value=normalize([normalized,...value.filter(item=>item.id!==normalized.id)]);write();notify();return Object.freeze({status:"recorded",entry:normalized})}
    function clear(){value=Object.freeze([]);write();notify();return Object.freeze({status:"cleared"})}
    function subscribe(listener){listeners.add(listener);listener(value);return()=>listeners.delete(listener)}
    return Object.freeze({get value(){return value},record,clear,subscribe})
  }
  window.CaderactHomeRecentState=Object.freeze({STORAGE_KEY,LIMIT,normalize,create})
})()
